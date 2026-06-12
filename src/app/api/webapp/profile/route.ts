import { NextRequest } from "next/server";
import { ok, error } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/utils/phone";
import { resolveWebappTelegramId } from "@/lib/telegram/webapp-auth";
import { linkPhoneToTelegramUser } from "@/lib/identity";

// PATCH /api/webapp/profile
// Body: { telegramId, firstName?, lastName?, fatherName?, region?, district?, phone?, onboardingStep? }
export async function PATCH(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return error("JSON parse xatosi", 400); }

  const {
    telegramId: rawTelegramId,
    firstName, lastName, fatherName, region, district,
    phone, onboardingStep,
  } = body ?? {};

  const VALID_ONBOARDING_STEPS = ["contact", "profile", "done"];
  if (onboardingStep !== undefined && !VALID_ONBOARDING_STEPS.includes(onboardingStep)) {
    return error("onboardingStep qiymati noto'g'ri", 400);
  }

  const auth = resolveWebappTelegramId(req, rawTelegramId ? String(rawTelegramId) : null);
  if (!auth) return error("Autentifikatsiya talab qilinadi", 401);
  const { telegramId } = auth;

  const isPhoneOnly = phone !== undefined && !firstName;
  const isStepOnly = onboardingStep !== undefined && !firstName && !phone;
  if (!isPhoneOnly && !isStepOnly) {
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
    try {
      normalizedPhone = normalizePhone(phone.trim());
    } catch {
      return error("Telefon formati noto'g'ri (+998XXXXXXXXX)", 400);
    }
    if (!/^\+998\d{9}$/.test(normalizedPhone)) {
      return error("Telefon +998XXXXXXXXX formatida bo'lishi kerak", 400);
    }
  }

  const user = await prisma.user.findUnique({
    where: { telegramId },
    select: { id: true, firstName: true },
  });
  if (!user) return error("Foydalanuvchi topilmadi", 404);

  // ── Phone ulash: linkPhoneToTelegramUser orqali (xavfsiz, crash yo'q) ──────
  if (normalizedPhone) {
    const linkResult = await linkPhoneToTelegramUser(telegramId, normalizedPhone);

    if (linkResult.status === "error") {
      return error(linkResult.message, 500);
    }
    if (linkResult.status === "conflict_two_telegram") {
      return error("Bu telefon raqami boshqa foydalanuvchiga tegishli", 409);
    }
    if (linkResult.status === "conflict_staff_account") {
      return error("Bu raqam xodim akkauntiga tegishli", 409);
    }
    if (linkResult.status === "already_has_different") {
      return error("Profilingizda boshqa telefon ulangan", 409);
    }
    // "already" yoki "ok" — davom etamiz (profile maydonlarini ham yangilaymiz)
  }

  // ── Profil maydonlarini yangilash ─────────────────────────────────────────
  const newFirstName = firstName ? firstName.trim() : user.firstName;
  const newLastName = lastName !== undefined ? (lastName ? lastName.trim() || null : null) : undefined;
  const newFatherName = fatherName !== undefined ? (fatherName ? fatherName.trim() || null : null) : undefined;
  const newRegion = region !== undefined ? (region ? region.trim() || null : null) : undefined;
  const newDistrict = district !== undefined ? (district ? district.trim() || null : null) : undefined;

  try {
    const updated = await prisma.user.update({
      where: { telegramId },
      data: {
        firstName: newFirstName,
        ...(newLastName !== undefined ? { lastName: newLastName } : {}),
        ...(newFatherName !== undefined ? { fatherName: newFatherName } : {}),
        ...(newRegion !== undefined ? { region: newRegion } : {}),
        ...(newDistrict !== undefined ? { district: newDistrict } : {}),
        ...(onboardingStep !== undefined ? { onboardingStep } : {}),
      },
      select: {
        id: true, firstName: true, lastName: true, fatherName: true,
        region: true, district: true, phone: true, tibId: true, onboardingStep: true,
      },
    });

    // Ism o'zgarganda aktiv bronlardagi patientName ni sinxronlash
    if (!isPhoneOnly && !isStepOnly) {
      prisma.appointment.updateMany({
        where: { user: { telegramId }, status: { not: "cancelled" } },
        data: {
          patientName: [updated.firstName, updated.lastName, updated.fatherName]
            .filter(Boolean).join(" "),
        },
      }).catch(() => {});
    }

    return ok({
      ...updated,
      fullName: [updated.firstName, updated.lastName, updated.fatherName]
        .filter(Boolean).join(" "),
    });
  } catch (err: any) {
    return error("Server xatosi", 500);
  }
}
