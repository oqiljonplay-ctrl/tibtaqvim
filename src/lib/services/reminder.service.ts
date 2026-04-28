import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export interface ReminderResult {
  sent: number;
  failed: number;
  messages: string[];
}

async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;

  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
        signal: controller.signal,
      });
      if (res.ok) return true;
      // 4xx xatolar qayta urinishsiz qaytarish
      if (res.status >= 400 && res.status < 500) return false;
    } catch {
      // timeout yoki tarmoq xatosi — ikkinchi urinish bo'lsa davom etsin
      if (attempt === 1) return false;
    } finally {
      clearTimeout(timer);
    }
  }
  return false;
}

const TZ = process.env.CLINIC_TIMEZONE || "Asia/Tashkent";

function localDateString(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toLocaleDateString("sv-SE", { timeZone: TZ }); // YYYY-MM-DD
}

export async function sendDayBeforeReminders(): Promise<ReminderResult> {
  const tomorrowStr = localDateString(1);
  const tomorrow = new Date(tomorrowStr);
  tomorrow.setHours(0, 0, 0, 0);

  const appointments = await prisma.appointment.findMany({
    where: {
      date: tomorrow,
      status: "booked",
      notifiedDayBefore: false,
    },
    include: {
      service: { select: { name: true } },
      user: { select: { telegramId: true, firstName: true } },
      slot: { select: { startTime: true } },
    },
  });

  let sent = 0, failed = 0;
  const messages: string[] = [];

  for (const appt of appointments) {
    if (!appt.user?.telegramId) continue;

    const timeInfo = appt.slot ? `\n🕐 Vaqt: *${appt.slot.startTime}*` : "";
    const text = [
      `🔔 *Eslatma!*`,
      ``,
      `Ertaga klinikada qabulingiz bor:`,
      `📋 Xizmat: *${appt.service.name}*`,
      `📅 Sana: *${tomorrow.toLocaleDateString("uz-UZ", { day: "numeric", month: "long" })}*`,
      timeInfo,
      appt.queueNumber ? `🔢 Navbat: *${appt.queueNumber}*` : "",
      ``,
      `O'z vaqtida keling! 🏥`,
    ].filter(Boolean).join("\n");

    const ok = await sendTelegramMessage(appt.user.telegramId, text);
    if (ok) {
      sent++;
      await prisma.appointment.update({
        where: { id: appt.id },
        data: { notifiedDayBefore: true },
      });
    } else {
      failed++;
    }
    messages.push(`${appt.patientName}: ${ok ? "✅" : "❌"}`);
  }

  logger.info("Day-before reminders sent", { sent, failed, total: appointments.length });
  return { sent, failed, messages };
}

export async function sendTwoHourReminders(): Promise<ReminderResult> {
  const now = new Date();
  const inTwoHours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const todayStr = localDateString(0);
  const today = new Date(todayStr); today.setHours(0, 0, 0, 0);

  const appointments = await prisma.appointment.findMany({
    where: {
      date: today,
      status: "booked",
      notifiedTwoHours: false,
      slot: {
        startTime: {
          gte: now.toTimeString().slice(0, 5),
          lte: inTwoHours.toTimeString().slice(0, 5),
        },
      },
    },
    include: {
      service: { select: { name: true } },
      user: { select: { telegramId: true } },
      slot: { select: { startTime: true } },
    },
  });

  let sent = 0, failed = 0;
  const messages: string[] = [];

  for (const appt of appointments) {
    if (!appt.user?.telegramId || !appt.slot) continue;

    const text = [
      `⏰ *2 soatdan keyin qabulingiz!*`,
      ``,
      `📋 Xizmat: *${appt.service.name}*`,
      `🕐 Vaqt: *${appt.slot.startTime}*`,
      ``,
      `Tayyor bo'ling! 🏥`,
    ].join("\n");

    const ok = await sendTelegramMessage(appt.user.telegramId, text);
    if (ok) {
      sent++;
      await prisma.appointment.update({
        where: { id: appt.id },
        data: { notifiedTwoHours: true },
      });
    } else {
      failed++;
    }
    messages.push(`${appt.patientName}: ${ok ? "✅" : "❌"}`);
  }

  logger.info("Two-hour reminders sent", { sent, failed });
  return { sent, failed, messages };
}
