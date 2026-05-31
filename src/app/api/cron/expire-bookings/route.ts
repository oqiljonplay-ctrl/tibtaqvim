import { NextRequest } from "next/server";
import { ok, error, unauthorized } from "@/lib/api-response";
import { expireBookings } from "@/lib/workflow/appointment-workflow";
import { sendTelegramConfirmation } from "@/lib/services/confirmation.service";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const TZ = process.env.CLINIC_TIMEZONE || "Asia/Tashkent";

function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
  if (req.headers.get("x-cron-secret") === secret) return true;
  return false;
}

// Toshkent vaqtida bugungi sanani "YYYY-MM-DD" sifatida qaytaradi
function getTodayTashkent(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: TZ });
}

async function notifyExpiredBookings(expiredIds: string[]): Promise<void> {
  if (expiredIds.length === 0) return;

  const appts = await prisma.appointment.findMany({
    where: { id: { in: expiredIds } },
    select: {
      id: true,
      date: true,
      service: { select: { name: true } },
      doctor: { select: { firstName: true, lastName: true } },
      user: { select: { telegramId: true } },
    },
  });

  for (const appt of appts) {
    if (!appt.user?.telegramId) continue;

    const doctorName = appt.doctor
      ? `${appt.doctor.firstName} ${appt.doctor.lastName}`
      : "shifokor";
    const dateStr = appt.date.toLocaleDateString("uz-UZ", {
      timeZone: TZ,
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const msg =
      `⏰ *Broningiz muddati o'tdi*\n\n` +
      `📋 Xizmat: ${appt.service?.name ?? "—"}\n` +
      `👨‍⚕️ Shifokor: ${doctorName}\n` +
      `📅 Sana: ${dateStr}\n\n` +
      `Bu bron avtomatik bekor qilindi. Qayta bron qilishingiz mumkin.`;

    try {
      await sendTelegramConfirmation(appt.user.telegramId, msg);
      // Rate limit oldini olish: 50ms oraliq
      await new Promise((r) => setTimeout(r, 50));
    } catch {
      // Xabar xatosi bronni ta'sirlamasin
    }
  }
}

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return unauthorized();

  try {
    const todayStr = getTodayTashkent();
    const result = await expireBookings(todayStr);

    logger.info("[cron/expire-bookings] done", {
      expired: result.expiredIds.length,
      date: todayStr,
    });

    // Telegram xabarlari — async, xato bo'lsa cron javobini to'xtatmasin
    notifyExpiredBookings(result.expiredIds).catch((err) => {
      logger.error("[cron/expire-bookings] notify error", { error: String(err) });
    });

    return ok({ expired: result.expiredIds.length, date: todayStr });
  } catch (err) {
    logger.error("[cron/expire-bookings] error", { error: String(err) });
    return error("Server xatosi", 500);
  }
}
