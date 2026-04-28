import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword, signToken } from "@/lib/auth";
import { ok, error, unauthorized } from "@/lib/api-response";
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
    const { phone: rawPhone, password, clinicId } = await req.json();

    if (!rawPhone || !password) {
      return error("Phone and password required");
    }

    const phone = normalizePhone(rawPhone);

    const user = await prisma.user.findFirst({
      where: {
        phone,
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
      role: user.role,
    });

    return ok({ token, user: { id: user.id, role: user.role, clinicId: user.clinicId, firstName: user.firstName } });
  } catch {
    return error("Server error", 500);
  }
}
