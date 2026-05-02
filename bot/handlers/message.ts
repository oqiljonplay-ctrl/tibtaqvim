import TelegramBot, { Message } from "node-telegram-bot-api";
import { userState } from "../state";
import { registerPatient } from "../api";
import { normalizePhone } from "../../src/lib/utils/phone";
import {
  editOrSend,
  mkNameKeyboard,
  mkAddressKeyboard,
  mkConfirmKeyboard,
  mkConfirmText,
  mkContactKeyboard,
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

  // ─── Kontakt ulashish (ism kiritgandan keyin, yoki boshlang'ich) ──────────
  if (state.step === "share_contact") {
    if (msg.contact) {
      const rawPhone = msg.contact.phone_number || "";
      const phone = normalizePhone(rawPhone.startsWith("+") ? rawPhone : `+${rawPhone}`);
      // Ism state dan olish (mid-booking) yoki kontaktdan
      const firstName = state.patientName || msg.contact.first_name || msg.from?.first_name || "Foydalanuvchi";

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
        `✅ *Kontakt qabul qilindi!*\n\n👤 Ism: *${firstName}*\n📞 Tel: *${phone}*${tibId ? `\n🆔 ID: *${tibId}*` : ""}`,
        { parse_mode: "Markdown", reply_markup: { remove_keyboard: true } as any }
      );

      // Mid-booking context: patientName + booking data already in state
      if (state.patientName && state.date) {
        const updatedState = { ...state, patientPhone: phone, tibId };

        if (state.serviceType === "home_service") {
          const sent = await bot.sendMessage(
            chatId,
            `👤 Ism: *${firstName}*\n📞 Tel: *${phone}*\n\n📍 *To'liq manzilingizni kiriting:*\n\nMasalan: Toshkent, Yunusobod 5-mavze, 12-uy 👇`,
            { parse_mode: "Markdown", reply_markup: { inline_keyboard: mkAddressKeyboard() } }
          );
          userState.set(chatId, { ...updatedState, step: "enter_address", messageId: sent.message_id });
        } else {
          const confirmState = { ...updatedState, step: "confirm" };
          const sent = await bot.sendMessage(
            chatId,
            mkConfirmText(confirmState),
            { parse_mode: "Markdown", reply_markup: { inline_keyboard: mkConfirmKeyboard() } }
          );
          userState.set(chatId, { ...confirmState, messageId: sent.message_id });
        }
        return;
      }

      // Boshlang'ich flow: xizmat tanlash
      const services = state._services || [];
      if (!services.length) {
        await bot.sendMessage(chatId, "⚠️ Hozirda mavjud xizmatlar yo'q. /start");
        userState.delete(chatId);
        return;
      }

      const { mkServiceKeyboard } = await import("../helpers/render");
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

    // Agar telefon raqam allaqachon saqlangan (qaytib kelgan user) — kontakt so'ramasdan o'tamiz
    if (state.patientPhone) {
      if (state.serviceType === "home_service") {
        const newMsgId = await editOrSend(
          bot, chatId, msgId,
          `👤 Ism: *${text}*\n📞 Tel: *${state.patientPhone}*\n\n📍 *To'liq manzilingizni kiriting:*\n\nMasalan: Toshkent, Yunusobod 5-mavze, 12-uy 👇`,
          mkAddressKeyboard()
        );
        userState.set(chatId, { ...state, patientName: text, step: "enter_address", messageId: newMsgId });
      } else {
        const updatedState = { ...state, patientName: text, step: "confirm" };
        const newMsgId = await editOrSend(
          bot, chatId, msgId,
          mkConfirmText(updatedState),
          mkConfirmKeyboard()
        );
        userState.set(chatId, { ...updatedState, messageId: newMsgId });
      }
      return;
    }

    // Yangi user — kontakt ulashish talab qilinadi
    // Inline xabarni yangilaymiz (orqaga tugmasi bilan)
    const newMsgId = await editOrSend(
      bot, chatId, msgId,
      `👤 Ism: *${text}*\n\n📱 Davom etish uchun kontaktingizni ulashing:`,
      [[{ text: "⬅️ Orqaga", callback_data: `back:${state._nameBack || "select_date"}` }]]
    );
    // Reply keyboard — kontakt tugmasi
    await bot.sendMessage(
      chatId,
      "👇 Kontaktni ulashish tugmasini bosing:",
      { parse_mode: "Markdown", reply_markup: mkContactKeyboard() as any }
    );
    userState.set(chatId, { ...state, patientName: text, step: "share_contact", messageId: newMsgId });
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
