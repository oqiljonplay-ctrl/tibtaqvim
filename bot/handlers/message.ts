import TelegramBot, { Message } from "node-telegram-bot-api";
import { userState } from "../state";
import { normalizePhone } from "../../src/lib/utils/phone";

export async function handleMessage(bot: TelegramBot, msg: Message) {
  const chatId = msg.chat.id;
  const text = msg.text?.trim() || "";
  const state = userState.get(chatId);

  if (!state || !state.step) {
    await bot.sendMessage(chatId, "Boshlash uchun /start ni bosing");
    return;
  }

  // ─── Ism ────────────────────────────────────────────────────────────────
  if (state.step === "enter_name") {
    if (text.length < 2) {
      await bot.sendMessage(chatId, "❌ Iltimos, to'liq ismingizni kiriting (kamida 2 belgi):");
      return;
    }
    userState.set(chatId, { ...state, patientName: text, step: "enter_phone" });
    await bot.sendMessage(chatId, "📞 Telefon raqamingizni kiriting:\nMasalan: +998901234567");
    return;
  }

  // ─── Telefon ─────────────────────────────────────────────────────────────
  if (state.step === "enter_phone") {
    const normalized = normalizePhone(text);
    if (!/^\+998\d{9}$/.test(normalized)) {
      await bot.sendMessage(chatId, "❌ Noto'g'ri raqam. Qaytadan kiriting:\nMasalan: +998901234567");
      return;
    }

    if (state.serviceType === "home_service") {
      userState.set(chatId, { ...state, patientPhone: normalized, step: "enter_address" });
      await bot.sendMessage(chatId, "📍 To'liq manzilingizni kiriting:\nMasalan: Toshkent, Yunusobod 5-mavze, 12-uy");
      return;
    }

    userState.set(chatId, { ...state, patientPhone: normalized, step: "confirm" });
    await sendConfirmation(bot, chatId, { ...state, patientPhone: normalized });
    return;
  }

  // ─── Manzil ──────────────────────────────────────────────────────────────
  if (state.step === "enter_address") {
    if (text.length < 5) {
      await bot.sendMessage(chatId, "❌ Iltimos, to'liq manzil kiriting:");
      return;
    }
    userState.set(chatId, { ...state, address: text, step: "confirm" });
    await sendConfirmation(bot, chatId, { ...state, address: text });
    return;
  }
}

async function sendConfirmation(bot: TelegramBot, chatId: number, state: any) {
  const dateLabel = new Date(state.date).toLocaleDateString("uz-UZ", {
    weekday: "long", day: "numeric", month: "long",
  });

  const lines = [
    "📋 *Ma'lumotlarni tasdiqlang:*",
    "",
    `👤 Ism: *${state.patientName}*`,
    `📞 Telefon: *${state.patientPhone}*`,
    `📅 Sana: *${dateLabel}*`,
    state.address ? `📍 Manzil: *${state.address}*` : "",
  ].filter(Boolean).join("\n");

  await bot.sendMessage(chatId, lines, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [[
        { text: "✅ Tasdiqlash", callback_data: "confirm" },
        { text: "❌ Bekor", callback_data: "cancel" },
      ]],
    },
  });
}
