import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/**
 * Atomic merge: guestUser → telegramUser
 *
 * Safe guard: faqat guest.telegramId === null bo'lganda chaqirilsin.
 * Caller shu shartni tekshirishi shart, bu funksiya shunchaki merge qiladi.
 *
 * Transaction:
 *   1. appointments  → userId reassign
 *   2. payments      → userId reassign
 *   3. dependents    → userId reassign
 *   4. user_clinics  → userId reassign (unique conflict: duplicate → delete)
 *   5. audit log
 *   6. telegramUser.phone = phone
 *   7. guestUser     → delete
 */
export async function mergeGuestToTelegramUser(
  telegramUserId: string,
  guestUserId: string,
  phone: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // 1. Bronlarni reassign
    await tx.appointment.updateMany({
      where: { userId: guestUserId },
      data:  { userId: telegramUserId },
    });

    // 2. Payment'larni reassign
    await tx.payment.updateMany({
      where: { userId: guestUserId },
      data:  { userId: telegramUserId },
    });

    // 3. Dependents reassign
    await tx.dependent.updateMany({
      where: { userId: guestUserId },
      data:  { userId: telegramUserId },
    });

    // 4. UserClinic reassign — @@unique([userId, clinicId]) conflict e'tibor
    const guestClinics = await tx.userClinic.findMany({
      where: { userId: guestUserId },
      select: { id: true, clinicId: true },
    });

    for (const uc of guestClinics) {
      const exists = await tx.userClinic.findUnique({
        where: { userId_clinicId: { userId: telegramUserId, clinicId: uc.clinicId } },
        select: { id: true },
      });
      if (exists) {
        await tx.userClinic.delete({ where: { id: uc.id } });
      } else {
        await tx.userClinic.update({
          where: { id: uc.id },
          data:  { userId: telegramUserId },
        });
      }
    }

    // 5. Audit log
    const tgUser = await tx.user.findUnique({
      where: { id: telegramUserId },
      select: { tibId: true },
    });
    await tx.telegramIdHistory.create({
      data: {
        userId:        telegramUserId,
        tibId:         tgUser?.tibId ?? "unknown",
        oldTelegramId: null,
        newTelegramId: "merge-guest",
        reason:        "merge-guest-to-telegram",
      },
    });

    // 6. telegramUser'ga phone qo'shish
    await tx.user.update({
      where: { id: telegramUserId },
      data:  { phone },
    });

    // 7. guestUser o'chirish (cascade: telegram_id_history, user_clinics tozalanadi)
    await tx.user.delete({ where: { id: guestUserId } });
  });

  logger.info("[user-merge] guest merged to telegram user", {
    telegramUserId,
    guestUserId,
    phone,
  });
}
