import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword, signToken } from "@/lib/auth";
import { error, unauthorized } from "@/lib/api-response";
import { rateLimit } from "@/lib/rate-limit";
import { normalizePhone } from "@/lib/utils/phone";

// Brute-force himoyasi: 1 daqiqada 5 urinish
const AUTH_LIMIT = 5;
const AUTH_WINDOW_MS = 60_000;

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`auth:${ip}`, AUTH_LIMIT, AUTH_WINDOW_MS)) {
    return error("Juda ko'p urinish. 1 daqiqa kuting.", 429);
  }

  try {
    const { phone: rawPhone, identifier: rawIdentifier, password, clinicId } = await req.json();

    const rawLogin = rawIdentifier || rawPhone;
    if (!rawLogin || !password) {
      return error("Login va parol kerak");
    }

    // username (tib_admin_... yoki tib_badmin_...) yoki telefon raqam bo'yicha qidirish
    const isUsername = /^tib_(b?admin)_/.test(rawLogin.trim());
    const phone = isUsername ? null : normalizePhone(rawLogin);

    const user = await prisma.user.findFirst({
      where: {
        OR: isUsername
          ? [{ username: rawLogin.trim() }]
          : [{ phone: phone! }, { username: rawLogin.trim() }],
        ...(clinicId ? { clinicId } : {}),
        isActive: true,
        role: { not: "patient" },
      },
    });

    if (!user || !user.passwordHash) {
      return unauthorized("Invalid credentials");
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) return unauthorized("Invalid credentials");

    const token = signToken({
      userId: user.id,
      clinicId: user.clinicId,
      branchId: user.branchId ?? null,
      role: user.role,
    });

    const response = NextResponse.json({
      success: true,
      data: { user: { id: user.id, role: user.role, clinicId: user.clinicId, branchId: user.branchId ?? null, firstName: user.firstName } },
    });
    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24,
      path: "/",
    });
    return response;
  } catch {
    return error("Server error", 500);
  }
}
