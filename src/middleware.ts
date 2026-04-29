import { NextRequest, NextResponse } from "next/server";
import { verifyTokenEdge } from "@/lib/auth-edge";

const PUBLIC_PATHS = ["/login", "/webapp", "/api/services", "/api/book", "/api/slots", "/api/webhook"];

const ROLE_PATHS: Record<string, string[]> = {
  "/admin/super": ["super_admin"],
  "/admin": ["super_admin", "clinic_admin"],
  "/doctor": ["doctor", "clinic_admin", "super_admin"],
  "/reception": ["receptionist", "clinic_admin", "super_admin"],
};

const ROLE_HOME: Record<string, string> = {
  super_admin: "/admin",
  clinic_admin: "/admin",
  doctor: "/doctor",
  receptionist: "/reception",
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/" || PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // SuperAdmin developer gate — /admin/super/auth sahifasi ochiq
  if (pathname.startsWith("/admin/super") && pathname !== "/admin/super/auth") {
    const saKey = req.cookies.get("sa_key")?.value;
    const expected = process.env.SUPERADMIN_KEY;
    if (!expected || saKey !== expected) {
      return NextResponse.redirect(new URL("/admin/super/auth", req.url));
    }
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
