import TelegramBot, { Message } from "node-telegram-bot-api";
import { fetchServices, fetchUserByTelegramId } from "../api";
import { userState } from "../state";
import {
  mkServiceKeyboard,
  mkWelcomeBackKeyboard,
  mkWebAppReplyKeyboard,
  mkRemoveKeyboard,
} from "../helpers/render";

const DEFAULT_CLINIC_ID = process.env.DEFAULT_CLINIC_ID || "";
const WEBAPP_URL = process.env.NEXT_PUBLIC_WEBAPP_URL || "";

export async function handleStart(bot: TelegramBot, msg: Message) {
  const chatId = msg.chat.id;

  const today = new Date().toISOString().split("T")[0];
  const [{ services, enableWebapp }, savedUser] = await Promise.all([
    fetchServices(DEFAULT_CLINIC_ID, today),
    fetchUserByTelegramId(chatId),
  ]);

  // Pastki persistent tugmani ko'rsatish yoki olib tashlash
  if (enableWebapp && WEBAPP_URL) {
    await bot.sendMessage(chatId, "👇 *Web orqali ham bron qilishingiz mumkin:*", {
      parse_mode: "Markdown",
      reply_markup: mkWebAppReplyKeyboard() as any,
    });
  } else {
    // WebApp o'chirilgan — persistent tugmani olib tashlash
    await bot.sendMessage(chatId, "🏥 *ClinicBot*", {
      parse_mode: "Markdown",
      reply_markup: mkRemoveKeyboard() as any,
    }).catch(() => {});
  }

  if (!services.length) {
    await bot.sendMessage(chatId, "⚠️ Hozirda mavjud xizmatlar yo'q. Keyinroq urinib ko'ring.");
    return;
  }

  if (savedUser) {
    const sent = await bot.sendMessage(
      chatId,
      `👋 *Qaytib keldingiz!*\n\n👤 Ism: *${savedUser.firstName}*\n📞 Tel: *${savedUser.phone}*\n\nUshbu ma'lumotlardan foydalanasizmi?`,
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

  const sent = await bot.sendMessage(
    chatId,
    `🏥 *ClinicBot ga xush kelibsiz!*\n\nQaysi xizmatdan foydalanmoqchisiz?`,
    { parse_mode: "Markdown", reply_markup: { inline_keyboard: mkServiceKeyboard(services) } }
  );

  userState.set(chatId, {
    step: "select_service",
    clinicId: DEFAULT_CLINIC_ID,
    messageId: sent.message_id,
    _services: services,
    _createdAt: Date.now(),
  });
}
