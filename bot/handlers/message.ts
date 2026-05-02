import TelegramBot, { Message } from "node-telegram-bot-api";
import { userState } from "../state";
import { registerPatient } from "../api";
import { normalizePhone } from "../../src/lib/utils/phone";
import {
  editOrSend,
  mkNameKeyboard,
  mkPhoneKeyboard,
  mkAddressKeyboard,
  mkConfirmKeyboard,
  mkConfirmText,
  mkContactKeyboard,
  mkServiceKeyboard,
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

  // ─── Kontakt ulashish ────────────────────────────────────────────────────────
  if (state.step === "share_contact") {
    if (msg.contact) {
      const rawPhone = msg.contact.phone_number || "";
      const phone = normalizePhone(rawPhone.startsWith("+") ? rawPhone : `+${rawPhone}`);
      const firstName = msg.contact.first_name || msg.from?.first_name || "Foydalanuvchi";

      // User yaratish + tibId berish (direct DB, HTTP yo'q)
      const reg = await registerPatient({
        phone,
        firstName,
        telegramId: chatId,
        clinicId: state.clinicId,
      });
      const tibId = reg.tibId;

      // Reply keyboardni olib tashlash
      await bot.sendMessage(
        chatId,
        `✅ *Kontakt qabul qilindi!*\n\n👤 Ism: *${firstName}*\n📞 Tel: *${phone}*${tibId ? `\n🆔 Sizning ID: *${tibId}*\n\n_Klinikaga kelganda ushbu ID ni ko'rsating_` : ""}`,
        { parse_mode: "Markdown", reply_markup: { remove_keyboard: true } as any }
      );

      const services = state._services || [];
      if (!services.length) {
        await bot.sendMessage(chatId, "⚠️ Hozirda mavjud xizmatlar yo'q. /start");
        userState.delete(chatId);
        return;
      }

      // Xizmat tanlash
      const sent = await bot.sendMessage(
        chatId,
        "🏥 Qaysi xizmatdan foydalanmoqchisiz?",
        { reply_markup: { inline_keyboard: mkServiceKeyboard(services) } }
      );
      userState.set(chatId, {
        ...state,
        step: "select_service",
        patientName: firstName,
        patientPhone: phone,
        tibId,
        messageId: sent.message_id,
        _createdAt: Date.now(),
      });
      return;
    }

    // Kontakt yuborilmadi — eslatma
    await bot.sendMessage(
      chatId,
      "📱 Iltimos, *'Kontaktni ulashish'* tugmasini bosing:\n\n_Telegram raqamingiz avtomatik yuboriladi_",
      { parse_mode: "Markdown", reply_markup: mkContactKeyboard() as any }
    );
    return;
  }

  // ─── Ism ────────────────────────────────────────────────────────────────────
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

  // ─── Telefon ─────────────────────────────────────────────────────────────────
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

  // ─── Manzil ──────────────────────────────────────────────────────────────────
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
