import TelegramBot, { Message } from "node-telegram-bot-api";
import { fetchServices } from "../api";
import { userState } from "../state";

const DEFAULT_CLINIC_ID = process.env.DEFAULT_CLINIC_ID || "";
const WEBAPP_URL = process.env.NEXT_PUBLIC_WEBAPP_URL || "";

const typeEmojis: Record<string, string> = {
  doctor_queue: "👨‍⚕️",
  diagnostic: "🔬",
  home_service: "🏠",
};

export async function handleStart(bot: TelegramBot, msg: Message) {
  const chatId = msg.chat.id;
  userState.set(chatId, { step: "select_service", clinicId: DEFAULT_CLINIC_ID });

  const today = new Date().toISOString().split("T")[0];
  const services = await fetchServices(DEFAULT_CLINIC_ID, today);

  if (!services.length) {
    await bot.sendMessage(chatId, "⚠️ Hozirda mavjud xizmatlar yo'q. Keyinroq urinib ko'ring.");
    return;
  }

  const serviceButtons = services.map((s: any) => {
    const emoji = typeEmojis[s.type] ?? "🏥";
    const limitInfo = s.dailyLimit
      ? s.isAvailable ? ` (${s.todayCount}/${s.dailyLimit})` : " ❌ To'ldi"
      : "";
    return [{
      text: `${emoji} ${s.name}${limitInfo}`,
      callback_data: s.isAvailable !== false ? `svc:${s.id}:${s.type}` : `full:${s.id}`,
    }];
  });

  // WebApp URL sozlangan bo'lsa — qulay interfeys tugmasi qo'shiladi
  const webAppRow = WEBAPP_URL
    ? [[{ text: "📱 Onlayn bron (Web App)", web_app: { url: WEBAPP_URL } }]]
    : [];

  const keyboard = [...webAppRow, ...serviceButtons];

  await bot.sendMessage(
    chatId,
    `🏥 *ClinicBot ga xush kelibsiz!*\n\nQaysi xizmatdan foydalanmoqchisiz?`,
    { parse_mode: "Markdown", reply_markup: { inline_keyboard: keyboard } }
  );
}
