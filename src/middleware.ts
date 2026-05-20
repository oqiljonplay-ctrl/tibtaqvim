import { NextRequest, NextResponse } from "next/server";
import { verifyTokenEdge } from "@/lib/auth-edge";

const PUBLIC_PATHS = [
  "/login",
  "/webapp",
  "/api/services",
  "/api/book",
  "/api/slots",
  "/api/webhook",
  "/api/clinics",
];

/**
 * Sahifalar va ularga ruxsat etilgan role'lar.
 * branch_admin — Faza 3'da qo'shilgan, /admin va uning subroute'lariga kira oladi
 * (lekin permissions.ts helper'lari clinicId/branchId scope tekshiradi)
 */
const ROLE_PATHS: Record<string, string[]> = {
  "/admin/super": ["super_admin"],
  "/admin": ["super_admin", "clinic_admin", "branch_admin"],
  "/doctor": ["doctor", "clinic_admin", "branch_admin", "super_admin"],
  "/reception": ["receptionist", "clinic_admin", "branch_admin", "super_admin"],
  "/stats": ["super_admin", "clinic_admin", "branch_admin", "doctor"],
};

const ROLE_HOME: Record<string, string> = {
  super_admin: "/admin/super",
  clinic_admin: "/admin",
  branch_admin: "/admin",
  doctor: "/doctor",
  receptionist: "/reception",
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public sahifalar va asosiy /
  if (pathname === "/" || PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // API route'lar uchun authentication har route'da alohida tekshiriladi
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Token tekshiruvi
  const token = req.cookies.get("auth_token")?.value;
  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("returnUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const payload = await verifyTokenEdge(token);
  if (!payload) {
    const res = NextResponse.redirect(new URL("/login", req.url));
    res.cookies.delete("auth_token");
    return res;
  }

  // Role-based access control
  for (const [path, roles] of Object.entries(ROLE_PATHS)) {
    if (pathname.startsWith(path) && !roles.includes(payload.role)) {
      const home = ROLE_HOME[payload.role] ?? "/login";
      return NextResponse.redirect(new URL(home, req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg).*)"],
};
