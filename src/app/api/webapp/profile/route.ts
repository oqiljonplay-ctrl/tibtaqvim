import { NextRequest } from "next/server";
import { ok, error } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/utils/phone";

// PATCH /api/webapp/profile
// Body: { telegramId, firstName, lastName?, fatherName?, region?, district? }
// Auth: telegramId tekshirish (webapp — JWT yo'q, telegramId ownership)
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { telegramId, firstName, lastName, fatherName, region, district, phone } = body ?? {};

    if (!telegramId) return error("telegramId talab qilinadi", 400);

    // Phone-only so'rovda firstName majburiy emas
    const isPhoneOnly = phone !== undefined && !firstName;
    if (!isPhoneOnly) {
      if (!firstName || typeof firstName !== "string" || firstName.trim().length === 0) {
        return error("Ism bo'sh bo'lmasin", 400);
      }
    }

    // Phone validatsiya
    let normalizedPhone: string | undefined = undefined;
    if (phone !== undefined && phone !== null) {
      if (typeof phone !== "string" || phone.trim().length === 0) {
        return error("Telefon format noto'g'ri", 400);
      }
      normalizedPhone = normalizePhone(phone.trim());
      if (!/^\+998\d{9}$/.test(normalizedPhone)) {
        return error("Telefon +998XXXXXXXXX formatida bo'lishi kerak", 400);
      }
    }

    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: { id: true, firstName: true },
    });
    if (!user) return error("Foydalanuvchi topilmadi", 404);

    const newFirstName = firstName ? firstName.trim() : user.firstName;
    const newLastName = lastName !== undefined ? (lastName ? lastName.trim() || null : null) : undefined;
    const newFatherName = fatherName !== undefined ? (fatherName ? fatherName.trim() || null : null) : undefined;
    const newRegion = region !== undefined ? (region ? region.trim() || null : null) : undefined;
    const newDistrict = district !== undefined ? (district ? district.trim() || null : null) : undefined;

    const updated = await prisma.user.update({
      where: { telegramId },
      data: {
        firstName: newFirstName,
        ...(newLastName !== undefined ? { lastName: newLastName } : {}),
        ...(newFatherName !== undefined ? { fatherName: newFatherName } : {}),
        ...(newRegion !== undefined ? { region: newRegion } : {}),
        ...(newDistrict !== undefined ? { district: newDistrict } : {}),
        ...(normalizedPhone !== undefined ? { phone: normalizedPhone } : {}),
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

    // Ism o'zgarganda aktiv bronlardagi patientName ni sinxronlash
    if (!isPhoneOnly) {
      await prisma.appointment.updateMany({
        where: { user: { telegramId }, status: { not: "cancelled" } },
        data: {
          patientName: [updated.firstName, updated.lastName, updated.fatherName]
            .filter(Boolean).join(" "),
        },
      });
    }

    return ok({
      ...updated,
      fullName: [updated.firstName, updated.lastName, updated.fatherName]
        .filter(Boolean)
        .join(" "),
    });
  } catch (err: any) {
    if (err?.code === "P2002" && err?.meta?.target?.includes?.("phone")) {
      return error("Bu telefon raqami boshqa hisobda ro'yxatdan o'tgan", 409);
    }
    return error("Server xatosi", 500);
  }
}
