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

    const newFirstName = firstName.trim();
    const newLastName = lastName ? lastName.trim() || null : null;
    const newFatherName = fatherName ? fatherName.trim() || null : null;
    const newRegion = region ? region.trim() || null : null;
    const newDistrict = district ? district.trim() || null : null;

    const [updated] = await prisma.$transaction([
      // 1. Users jadvalini yangilash
      prisma.user.update({
        where: { telegramId },
        data: {
          firstName: newFirstName,
          lastName: newLastName,
          fatherName: newFatherName,
          region: newRegion,
          district: newDistrict,
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
      }),
      // 2. Aktiv (bekor qilinmagan) bronlarda patientName ni sinxronlash
      prisma.appointment.updateMany({
        where: {
          user: { telegramId },
          status: { not: "cancelled" },
        },
        data: {
          patientName: [newFirstName, newLastName, newFatherName].filter(Boolean).join(" "),
        },
      }),
    ]);

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
