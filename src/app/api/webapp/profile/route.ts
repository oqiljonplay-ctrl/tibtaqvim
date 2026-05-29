import { NextRequest } from "next/server";
import { ok, error } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

// PATCH /api/webapp/profile
// Body: { telegramId, firstName, lastName?, fatherName?, region?, district? }
// Auth: telegramId tekshirish (webapp — JWT yo'q, telegramId ownership)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { telegramId, firstName, lastName, fatherName, region, district } = body ?? {};

    if (!telegramId) return error("telegramId talab qilinadi", 400);
    if (!firstName || typeof firstName !== "string" || firstName.trim().length === 0) {
      return error("Ism bo'sh bo'lmasin", 400);
    }

    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: { id: true },
    });
    if (!user) return error("Foydalanuvchi topilmadi", 404);

    const updated = await prisma.user.update({
      where: { telegramId },
      data: {
        firstName: firstName.trim(),
        lastName: lastName ? lastName.trim() || null : null,
        fatherName: fatherName ? fatherName.trim() || null : null,
        region: region ? region.trim() || null : null,
        district: district ? district.trim() || null : null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        fatherName: true,
        region: true,
        district: true,
        phone: true,
        tibId: true,
      },
    });

    return ok({
      ...updated,
      fullName: [updated.firstName, updated.lastName, updated.fatherName]
        .filter(Boolean)
        .join(" "),
    });
  } catch {
    return error("Server xatosi", 500);
  }
}
