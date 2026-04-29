import TelegramBot, { Message } from "node-telegram-bot-api";
import { userState } from "../state";
import { normalizePhone } from "../../src/lib/utils/phone";
import {
  editOrSend,
  mkNameKeyboard,
  mkPhoneKeyboard,
  mkAddressKeyboard,
  mkConfirmKeyboard,
  mkConfirmText,
} from "../helpers/render";

export async function handleMessage(bot: TelegramBot, msg: Message) {
  const chatId = msg.chat.id;
  const text = msg.text?.trim() || "";
  const state = userState.get(chatId);

  if (!state || !state.step) {
    await bot.sendMessage(chatId, "Boshlash uchun /start ni bosing");
    return;
  }

  const msgId: number | undefined = state.messageId;

  // ─── Ism ────────────────────────────────────────────────────────────────
  if (state.step === "enter_name") {
    if (text.length < 2) {
      await editOrSend(
        bot, chatId, msgId,
        "❌ Iltimos, to'liq ismingizni kiriting (kamida 2 belgi):\n\n👤 *Ismingizni kiriting:*\n\n_Pastga yozing_ 👇",
        mkNameKeyboard(state._nameBack || "select_date")
      );
      return;
    }
    const newMsgId = await editOrSend(
      bot, chatId, msgId,
      `👤 Ism: *${text}*\n\n📞 *Telefon raqamingizni kiriting:*\n\n_+998XXXXXXXXX formatida_ 👇`,
      mkPhoneKeyboard()
    );
    userState.set(chatId, { ...state, patientName: text, step: "enter_phone", messageId: newMsgId });
    return;
  }

  // ─── Telefon ─────────────────────────────────────────────────────────────
  if (state.step === "enter_phone") {
    const normalized = normalizePhone(text);
    if (!/^\+998\d{9}$/.test(normalized)) {
      await editOrSend(
        bot, chatId, msgId,
        `👤 Ism: *${state.patientName}*\n\n❌ Noto'g'ri raqam. Qaytadan kiriting:\n\n📞 *Telefon raqamingizni kiriting:*\n\n_+998XXXXXXXXX formatida_ 👇`,
        mkPhoneKeyboard()
      );
      return;
    }

    if (state.serviceType === "home_service") {
      const newMsgId = await editOrSend(
        bot, chatId, msgId,
        `👤 Ism: *${state.patientName}*\n📞 Tel: *${normalized}*\n\n📍 *To'liq manzilingizni kiriting:*\n\nMasalan: Toshkent, Yunusobod 5-mavze, 12-uy 👇`,
        mkAddressKeyboard()
      );
      userState.set(chatId, { ...state, patientPhone: normalized, step: "enter_address", messageId: newMsgId });
      return;
    }

    const updatedState = { ...state, patientPhone: normalized, step: "confirm" };
    const newMsgId = await editOrSend(
      bot, chatId, msgId,
      mkConfirmText(updatedState),
      mkConfirmKeyboard()
    );
    userState.set(chatId, { ...updatedState, messageId: newMsgId });
    return;
  }

  // ─── Manzil ──────────────────────────────────────────────────────────────
  if (state.step === "enter_address") {
    if (text.length < 5) {
      await editOrSend(
        bot, chatId, msgId,
        `👤 Ism: *${state.patientName}*\n📞 Tel: *${state.patientPhone}*\n\n❌ Iltimos, to'liq manzil kiriting:\n\n📍 *To'liq manzilingizni kiriting:* 👇`,
        mkAddressKeyboard()
      );
      return;
    }
    const updatedState = { ...state, address: text, step: "confirm" };
    const newMsgId = await editOrSend(
      bot, chatId, msgId,
      mkConfirmText(updatedState),
      mkConfirmKeyboard()
    );
    userState.set(chatId, { ...updatedState, messageId: newMsgId });
    return;
  }
}
