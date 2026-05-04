import TelegramBot, { Message } from "node-telegram-bot-api";
import { userState } from "../state";
import { registerPatient, fetchServices, fetchUserByTelegramId } from "../api";
import { normalizePhone } from "../../src/lib/utils/phone";
import { prisma } from "@/lib/prisma";
import {
  editOrSend,
  mkNameKeyboard,
  mkAddressKeyboard,
  mkConfirmKeyboard,
  mkConfirmText,
  mkContactKeyboard,
  mkDateKeyboard,
  mkLocationKeyboard,
  mkWebAppReplyKeyboard,
} from "../helpers/render";

export async function handleMessage(bot: TelegramBot, msg: Message) {
  const chatId = msg.chat.id;
  const text = msg.text?.trim() || "";
  const state = await userState.get(chatId);

  // ─── Joylashuv (Location) ─────────────────────────────────────────────────
  if (msg.location) {
    if (!state || state.step !== "awaiting_location") return;
    const appointmentId = state.appointmentId as string | undefined;
    if (!appointmentId) {
      await bot.sendMessage(chatId, "❌ Appointment topilmadi. Iltimos, /start bosing.");
      await userState.delete(chatId);
      return;
    }
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        locationLat: msg.location.latitude,
        locationLng: msg.location.longitude,
        locationLivePeriod: (msg.location as any).live_period ?? null,
        locationSharedAt: new Date(),
      },
    });
    const livePeriod = (msg.location as any).live_period as number | undefined;
    const durationText = livePeriod
      ? `\n⏱️ Davomiyligi: ${Math.round(livePeriod / 60)} daqiqa`
      : "";
    await bot.sendMessage(
      chatId,
      `✅ *Joylashuv qabul qilindi*\n\n📍 Doktor sizning manzilingizga yetib boradi.${durationText}\n\nKlinika tez orada siz bilan bog'lanadi.`,
      { parse_mode: "Markdown", reply_markup: mkWebAppReplyKeyboard(chatId) as any }
    );
    await userState.delete(chatId);
    return;
  }

  // ─── 🏠 Uyda bemor ko'rish ───────────────────────────────────────────────
  if (text === "🏠 Uyda bemor ko'rish") {
    const DEFAULT_CLINIC_ID = process.env.DEFAULT_CLINIC_ID || "";
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" });
    const { services } = await fetchServices(DEFAULT_CLINIC_ID, today);
    const homeService = services.find((s: any) => s.type === "home_service");
    if (!homeService || homeService.isAvailable === false) {
      await bot.sendMessage(chatId, "❌ Bu xizmat hozir mavjud emas");
      return;
    }
    const savedUser = await fetchUserByTelegramId(chatId);
    const sent = await bot.sendMessage(chatId, "📅 Qaysi kunga yozilmoqchisiz?", {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: mkDateKeyboard() },
    });
    await userState.set(chatId, {
      step: "select_date",
      clinicId: DEFAULT_CLINIC_ID,
      serviceId: homeService.id,
      serviceType: homeService.type,
      servicePrice: homeService.price ?? null,
      serviceRequiresSlot: homeService.requiresSlot ?? false,
      serviceRequiresAddress: homeService.requiresAddress ?? false,
      messageId: sent.message_id,
      _createdAt: Date.now(),
      _services: services,
      ...(savedUser?.firstName && savedUser?.phone
        ? { patientName: savedUser.firstName, patientPhone: savedUser.phone }
        : {}),
    });
    return;
  }

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
          await userState.set(chatId,{ ...updatedState, step: "enter_address", messageId: sent.message_id });
        } else {
          const confirmState = { ...updatedState, step: "confirm" };
          const sent = await bot.sendMessage(
            chatId,
            mkConfirmText(confirmState),
            { parse_mode: "Markdown", reply_markup: { inline_keyboard: mkConfirmKeyboard() } }
          );
          await userState.set(chatId,{ ...confirmState, messageId: sent.message_id });
        }
        return;
      }

      // Boshlang'ich flow: xizmat tanlash
      const services = state._services || [];
      if (!services.length) {
        await bot.sendMessage(chatId, "⚠️ Hozirda mavjud xizmatlar yo'q. /start");
        await userState.delete(chatId);
        return;
      }

      const { mkServiceKeyboard } = await import("../helpers/render");
      const sent = await bot.sendMessage(
        chatId,
        "🏥 Qaysi xizmatdan foydalanmoqchisiz?",
        { reply_markup: { inline_keyboard: mkServiceKeyboard(services) } }
      );
      await userState.set(chatId, {
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
        await userState.set(chatId,{ ...state, patientName: text, step: "enter_address", messageId: newMsgId });
      } else {
        const updatedState = { ...state, patientName: text, step: "confirm" };
        const newMsgId = await editOrSend(
          bot, chatId, msgId,
          mkConfirmText(updatedState),
          mkConfirmKeyboard()
        );
        await userState.set(chatId,{ ...updatedState, messageId: newMsgId });
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
    await userState.set(chatId, { ...state, patientName: text, step: "share_contact", messageId: newMsgId });
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
    await userState.set(chatId, { ...updatedState, messageId: newMsgId });
    return;
  }

  // ─── Keyinroq yuboraman ───────────────────────────────────────────────────
  if (text === "⏭️ Keyinroq yuboraman") {
    await bot.sendMessage(
      chatId,
      "Yaxshi. Joylashuvni keyinroq yuborishingiz mumkin.\n\nKlinika xodimi siz bilan telefon orqali bog'lanadi.",
      { reply_markup: mkWebAppReplyKeyboard(chatId) as any }
    );
    await userState.delete(chatId);
    return;
  }
}
