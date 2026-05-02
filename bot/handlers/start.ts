import TelegramBot, { Message } from "node-telegram-bot-api";
import { fetchServices, fetchUserByTelegramId, registerUserAtStart } from "../api";
import { userState } from "../state";
import {
  mkServiceKeyboard,
  mkWelcomeBackKeyboard,
  mkWebAppReplyKeyboard,
  mkContactKeyboard,
} from "../helpers/render";

const DEFAULT_CLINIC_ID = process.env.DEFAULT_CLINIC_ID || "";
const WEBAPP_URL =
  process.env.NEXT_PUBLIC_WEBAPP_URL ||
  (process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/webapp` : "") ||
  "https://tibtaqvim.vercel.app/webapp";

export async function handleStart(bot: TelegramBot, msg: Message) {
  const chatId = msg.chat.id;

  const today = new Date().toISOString().split("T")[0];
  const tgFirstName = msg.from?.first_name || "Foydalanuvchi";

  const [{ services }, savedUser, regResult] = await Promise.all([
    fetchServices(DEFAULT_CLINIC_ID, today),
    fetchUserByTelegramId(chatId),
    registerUserAtStart(chatId, tgFirstName),
  ]);

  const tibId = savedUser?.tibId || regResult?.tibId;

  // "Profilim" tugmasini har doim ko'rsatamiz
  if (WEBAPP_URL) {
    await bot.sendMessage(chatId, "👤 *Profilingizni ko'rish uchun:*", {
      parse_mode: "Markdown",
      reply_markup: mkWebAppReplyKeyboard(chatId) as any,
    });
  }

  if (!services.length) {
    await bot.sendMessage(chatId, "⚠️ Hozirda mavjud xizmatlar yo'q. Keyinroq urinib ko'ring.");
    return;
  }

  // Qaytib kelgan user — phoneси bor
  if (savedUser?.phone) {
    const idLine = tibId ? `\n🆔 ID: *${tibId}*` : "";
    const sent = await bot.sendMessage(
      chatId,
      `👋 *Qaytib keldingiz!*\n\n👤 Ism: *${savedUser.firstName}*\n📞 Tel: *${savedUser.phone}*${idLine}\n\nUshbu ma'lumotlardan foydalanasizmi?`,
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: mkWelcomeBackKeyboard() } }
    );
    userState.set(chatId, {
      step: "welcome_back",
      clinicId: DEFAULT_CLINIC_ID,
      messageId: sent.message_id,
      _services: services,
      _createdAt: Date.now(),
      patientName: savedUser.firstName,
      patientPhone: savedUser.phone,
    });
    return;
  }

  // Yangi user — majburiy kontakt ulashish
  // Kontakt orqali phone + telegramId bir umrlik biriktiriladi va tibId beriladi
  await bot.sendMessage(
    chatId,
    `🏥 *ClinicBot ga xush kelibsiz!*\n\n📱 Davom etish uchun telefon raqamingizni ulashing.\n_Tugmani bosing_ 👇`,
    {
      parse_mode: "Markdown",
      reply_markup: mkContactKeyboard() as any,
    }
  );

  userState.set(chatId, {
    step: "share_contact",
    clinicId: DEFAULT_CLINIC_ID,
    _services: services,
    _createdAt: Date.now(),
  });
}
