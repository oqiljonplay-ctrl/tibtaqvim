import { logger } from "@/lib/logger";

interface ConfirmationData {
  patientName: string;
  date: string;
  doctorName?: string;
  queueNumber?: number | null;
  slotTime?: string | null;
  serviceName?: string;
  tibId?: string | null;
}

export function buildConfirmationMessage(data: ConfirmationData): string {
  const {
    patientName, date, doctorName, queueNumber,
    slotTime, serviceName, tibId,
  } = data;

  const lines = [
    "✅ *Qabul tasdiqlandi*",
    "",
    `👤 Ism: *${patientName}*`,
    `📅 Sana: *${date}*`,
    serviceName ? `📋 Xizmat: *${serviceName}*` : "",
    queueNumber
      ? `🔢 Navbat: *${queueNumber}*`
      : "📋 Navbat: ro'yxatga qo'shildingiz",
    doctorName ? `👨‍⚕️ Shifokor: *${doctorName}*` : "",
    slotTime ? `🕐 Vaqt: *${slotTime}*` : "",
    tibId ? `🆔 ID: *${tibId}*` : "",
    "",
    tibId
      ? "📍 Klinikaga kelganda ushbu kodni ko'rsating"
      : "Klinikaga o'z vaqtida keling! 🏥",
  ].filter(Boolean).join("\n");

  return lines;
}

// API orqali Telegram xabar yuborish (webapp bronlar uchun)
export async function sendTelegramConfirmation(
  telegramId: string,
  message: string
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: telegramId, text: message, parse_mode: "Markdown" }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) logger.warn("Telegram confirmation send failed", { telegramId, status: res.status });
  } catch {
    // Telegram xatosi bronni buzmasin
    logger.warn("Telegram confirmation error (non-critical)", { telegramId });
  }
}
