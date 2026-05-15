import { logger } from "@/lib/logger";

interface ConfirmationData {
  patientName: string;
  date: string;
  doctorName?: string;
  queueNumber?: number | null;
  slotTime?: string | null;
  serviceName?: string;
  tibId?: string | null;
  queueMode?: "live" | "online" | "slot";
}

export function buildConfirmationMessage(data: ConfirmationData): string {
  const {
    patientName, date, doctorName, queueNumber,
    slotTime, serviceName, tibId, queueMode,
  } = data;

  const isLive = queueMode === "live";

  const lines = [
    "✅ *Qabul tasdiqlandi*",
    "",
    `👤 Ism: *${patientName}*`,
    `📅 Sana: *${date}*`,
    serviceName ? `📋 Xizmat: *${serviceName}*` : "",
    doctorName ? `👨‍⚕️ Shifokor: *${doctorName}*` : "",
    slotTime ? `🕐 Vaqt: *${slotTime}*` : "",
    tibId ? `🆔 ID: *${tibId}*` : "",
    "",
    isLive
      ? "💵 *Rejim:* Kunlik ro'yxatga kirish"
      : (queueNumber ? `🔢 Navbat: *#${queueNumber}*` : "📋 Navbat: ro'yxatga qo'shildingiz"),
    "",
    isLive
      ? "⚠️ Klinikaga kelib kassadan jonli navbat raqami oling"
      : (tibId ? "📍 Klinikaga kelganda ushbu kodni ko'rsating" : "Klinikaga o'z vaqtida keling! 🏥"),
  ].filter(Boolean).join("\n");

  return lines;
}

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
    logger.warn("Telegram confirmation error (non-critical)", { telegramId });
  }
}
