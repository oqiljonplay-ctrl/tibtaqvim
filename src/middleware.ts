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

/**
 * /admin/super uchun ikkinchi himoya qatlami.
 * super_admin roli yetarli emas — sa_key cookie ham bo'lishi kerak.
 * sa_key qiymati SUPERADMIN_KEY env var bilan tekshiriladi.
 * /admin/super/auth — gate'siz (foydalanuvchi key kiritadi).
 * SUPERADMIN_KEY set qilinmagan bo'lsa (dev), gate skip qilinadi.
 */
function checkSuperAdminGate(req: NextRequest): boolean {
  const pathname = req.nextUrl.pathname;

  // /admin/super/auth — gate yo'q (foydalanuvchi key kiritadi)
  if (pathname === "/admin/super/auth" || pathname.startsWith("/admin/super/auth/")) {
    return true;
  }

  // Faqat /admin/super/* uchun ishlaydi
  if (!pathname.startsWith("/admin/super")) {
    return true;
  }

  const expected = (process.env.SUPERADMIN_KEY ?? "").trim();
  // Dev: SUPERADMIN_KEY set qilinmagan bo'lsa, gate'ni skip qil
  if (!expected) return true;

  const saKey = (req.cookies.get("sa_key")?.value ?? "").trim();
  return saKey === expected;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/" || PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

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

  // Role-based access
  for (const [path, roles] of Object.entries(ROLE_PATHS)) {
    if (pathname.startsWith(path) && !roles.includes(payload.role)) {
      const home = ROLE_HOME[payload.role] ?? "/login";
      return NextResponse.redirect(new URL(home, req.url));
    }
  }

  // SuperAdmin sa_key gate (ikkinchi qatlam)
  if (!checkSuperAdminGate(req)) {
    return NextResponse.redirect(new URL("/admin/super/auth", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg).*)"],
};
