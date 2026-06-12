import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword, signToken } from "@/lib/auth";

import { error, unauthorized } from "@/lib/api-response";
import { rateLimit } from "@/lib/rate-limit";
import { normalizePhone } from "@/lib/utils/phone";
import { getEmployeeByUserId } from "@/lib/services/em-id.service";

// Brute-force himoyasi: 2-qavatli — 5/daqiqa + 20/soat
// 5/min: qisqa portlarni bloklaydi; 20/soat: uzoq sessiya brute-force'ni bloklaydi
const AUTH_LIMIT_MIN = 5;
const AUTH_WINDOW_MIN = 60_000;
const AUTH_LIMIT_HOUR = 20;
const AUTH_WINDOW_HOUR = 3_600_000;

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const [perMin, perHour] = await Promise.all([
    rateLimit(`auth:min:${ip}`, AUTH_LIMIT_MIN, AUTH_WINDOW_MIN),
    rateLimit(`auth:hour:${ip}`, AUTH_LIMIT_HOUR, AUTH_WINDOW_HOUR),
  ]);
  if (!perMin || !perHour) {
    return error("Juda ko'p urinish. Keyinroq qayta urining.", 429);
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
    if (!valid) {
      try {
        await prisma.auditLog.create({
          data: {
            actorId: user.id,
            action: "auth.login_failed",
            payload: { role: user.role },
            clinicId: user.clinicId,
          },
        });
      } catch {}
      return unauthorized("Invalid credentials");
    }

    try {
      await prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: "auth.login",
          payload: { role: user.role, clinicId: user.clinicId ?? null },
          clinicId: user.clinicId,
        },
      });
    } catch {}

    const token = signToken({
      userId: user.id,
      clinicId: user.clinicId,
      branchId: user.branchId ?? null,
      role: user.role,
    });

    const employee = await getEmployeeByUserId(user.id);
    const needsEmVerify = !!employee;

    const response = NextResponse.json({
      success: true,
      data: {
        user: { id: user.id, role: user.role, clinicId: user.clinicId, branchId: user.branchId ?? null, firstName: user.firstName },
        needsEmVerify,
      },
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
