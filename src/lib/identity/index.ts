import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/utils/phone";
import { mergeGuestToTelegramUser } from "@/lib/services/user-merge.service";
import { logger } from "@/lib/logger";

export type LinkPhoneResult =
  | { status: "ok"; phone: string }
  | { status: "already" }
  | { status: "already_has_different"; currentPhone: string }
  | { status: "conflict_two_telegram" }
  | { status: "conflict_staff_account" }
  | { status: "error"; message: string };

/**
 * Telegramga ulangan userni phone bilan bog'laydi.
 * Xavfsiz tartib: guest o'chirilgandan KEYIN phone set qilinadi (UNIQUE to'qnashuvi yo'q).
 * Caller uchun hech qachon throw qilmaydi — structured result qaytaradi.
 */
export async function linkPhoneToTelegramUser(
  telegramId: string,
  rawPhone: string,
): Promise<LinkPhoneResult> {
  try {
    let phone: string;
    try {
      phone = normalizePhone(rawPhone);
    } catch {
      return { status: "error", message: "Telefon formati noto'g'ri (+998XXXXXXXXX)" };
    }

    const u = await prisma.user.findUnique({
      where: { telegramId },
      select: { id: true, phone: true },
    });
    if (!u) return { status: "error", message: "Foydalanuvchi topilmadi" };

    // Allaqachon bir xil telefon bor
    if (u.phone === phone) return { status: "already" };

    // Boshqa telefon allaqachon ulangan (kam holat — log qilamiz, o'zgartirmaymiz)
    if (u.phone && u.phone !== phone) {
      logger.warn("[identity] user already has different phone", {
        telegramId,
        currentPhone: u.phone,
        newPhone: phone,
      });
      return { status: "already_has_different", currentPhone: u.phone };
    }

    // Bu telefon boshqa yozuvda bormi?
    const g = await prisma.user.findUnique({
      where: { phone },
      select: { id: true, telegramId: true },
    });

    if (!g) {
      // Hech kim bunday telefonga ega emas — to'g'ridan set
      await prisma.user.update({
        where: { id: u.id },
        data: { phone },
      });
      logger.info("[identity] phone linked to telegram user", { telegramId, phone });
      return { status: "ok", phone };
    }

    if (g.telegramId === null) {
      // HIMOYA: xodim akkauntini guest deb merge qilish TAQIQLANADI
      const phoneOwner = await prisma.user.findUnique({
        where: { id: g.id },
        select: {
          role: true,
          employee: { select: { id: true } },
          staff: { select: { id: true } },
          doctor: { select: { id: true } },
        },
      });
      if (
        phoneOwner &&
        (phoneOwner.role !== "patient" || phoneOwner.employee || phoneOwner.staff || phoneOwner.doctor)
      ) {
        logger.warn("[identity] merge blocked: phone belongs to staff account", {
          telegramId, phone, guestId: g.id, role: phoneOwner.role,
        });
        return { status: "conflict_staff_account" } as const;
      }

      // Guest (telegramId yo'q) — xavfsiz merge: avval guest o'chir, keyin phone set
      await mergeGuestToTelegramUser(u.id, g.id, phone);
      logger.info("[identity] guest merged to telegram user", { telegramId, phone, guestId: g.id });
      return { status: "ok", phone };
    }

    // Ikki haqiqiy Telegram user bitta raqamda — avtomatik merge qilmaymiz
    logger.warn("[identity] phone conflict: two telegram users", {
      telegramId,
      conflictTelegramId: g.telegramId,
      phone,
    });
    return { status: "conflict_two_telegram" };
  } catch (err) {
    logger.error("[identity] linkPhoneToTelegramUser failed", { telegramId, error: String(err) });
    return { status: "error", message: "Server xatosi" };
  }
}

/**
 * Booking uchun userId hal qilish.
 * telegramId ma'lum bo'lsa → o'sha yozuv (ghost yaratilmaydi).
 * telegramId yo'q → null (caller phone-upsert qiladi — registratura uchun).
 */
export async function resolveBookingUserId(
  telegramId: string | null | undefined,
): Promise<string | null> {
  if (!telegramId) return null;
  try {
    const u = await prisma.user.findUnique({
      where: { telegramId: String(telegramId) },
      select: { id: true },
    });
    return u?.id ?? null;
  } catch {
    return null;
  }
}
