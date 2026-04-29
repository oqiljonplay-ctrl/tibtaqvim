import TelegramBot, { CallbackQuery } from "node-telegram-bot-api";
import { fetchDoctors, fetchSlots, bookAppointment, registerPatient, fetchServices, fetchUserByTelegramId } from "../api";
import { userState } from "../state";
import {
  editOrSend,
  mkServiceKeyboard,
  mkDateKeyboard,
  mkDateKeyboardForMonth,
  mkDoctorKeyboard,
  mkSlotKeyboard,
  mkNameKeyboard,
  mkPhoneKeyboard,
  mkAddressKeyboard,
  mkConfirmKeyboard,
  mkConfirmText,
} from "../helpers/render";

export async function handleCallback(bot: TelegramBot, query: CallbackQuery) {
  const chatId = query.message?.chat.id;
  if (!chatId) {
    await bot.answerCallbackQuery(query.id, { text: "Xatolik. /start ni bosing." });
    return;
  }

  let data = query.data || "";
  const state = userState.get(chatId) || {};

  // messageId: query.message is always the message with the button — most accurate source
  const msgId: number | undefined = query.message?.message_id ?? state.messageId;

  // ─── full: — alert before general answer ──────────────────────────────────
  if (data.startsWith("full:")) {
    await bot.answerCallbackQuery(query.id, {
      text: "❌ Bu xizmat bugungi limitiga yetdi! Ertaga urinib ko'ring.",
      show_alert: true,
    });
    return;
  }

  await bot.answerCallbackQuery(query.id);

  // ─── cal:noop — keyboard placeholder buttons ──────────────────────────────
  if (data === "cal:noop") return;

  // ─── cal:month: — calendar month navigation (no state needed) ────────────
  if (data.startsWith("cal:month:")) {
    const ym = data.slice("cal:month:".length);         // "2026-04"
    const [yearStr, monthStr] = ym.split("-");
    const keyboard = mkDateKeyboardForMonth(parseInt(yearStr), parseInt(monthStr));
    if (msgId) {
      try {
        await (bot as any).editMessageReplyMarkup(
          { inline_keyboard: keyboard },
          { chat_id: chatId, message_id: msgId }
        );
      } catch {}
    }
    return;
  }

  // ─── TTL check ────────────────────────────────────────────────────────────
  if (data !== "confirm" && data !== "cancel" && state._createdAt) {
    if (Date.now() - state._createdAt > 30 * 60 * 1000) {
      userState.delete(chatId);
      await bot.sendMessage(chatId, "⏰ Sessiya muddati tugadi. Qaytadan boshlang:\n\n/start");
      return;
    }
  }

  // ─── use_saved / change_info — welcome back flow ─────────────────────────
  if (data === "use_saved" || data === "change_info") {
    const DEFAULT_CLINIC_ID = process.env.DEFAULT_CLINIC_ID || "";
    const clinicId = state.clinicId || DEFAULT_CLINIC_ID;

    // State may be lost (serverless cold start) — re-fetch services if needed
    let services = state._services;
    if (!services?.length) {
      const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" });
      services = await fetchServices(clinicId, today);
    }
    if (!services?.length) {
      await bot.sendMessage(chatId, "⚠️ Hozirda mavjud xizmatlar yo'q. /start");
      return;
    }

    // For use_saved: restore name/phone from state or re-fetch from DB if lost
    let patientName: string | undefined = undefined;
    let patientPhone: string | undefined = undefined;
    if (data === "use_saved") {
      patientName = state.patientName;
      patientPhone = state.patientPhone;
      if (!patientName || !patientPhone) {
        const saved = await fetchUserByTelegramId(chatId);
        if (saved) { patientName = saved.firstName; patientPhone = saved.phone; }
      }
    }

    const newMsgId = await editOrSend(
      bot, chatId, msgId,
      "🏥 *ClinicBot ga xush kelibsiz!*\n\nQaysi xizmatdan foydalanmoqchisiz?",
      mkServiceKeyboard(services)
    );
    userState.set(chatId, {
      step: "select_service",
      clinicId,
      messageId: newMsgId,
      _services: services,
      _createdAt: Date.now(),
      ...(patientName && patientPhone ? { patientName, patientPhone } : {}),
    });
    return;
  }

  // ─── back: navigation ─────────────────────────────────────────────────────
  if (data.startsWith("back:")) {
    const target = data.slice(5);

    if (target === "select_service") {
      let services = state._services;
      if (!services?.length) {
        const clinicId = state.clinicId || process.env.DEFAULT_CLINIC_ID || "";
        const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" });
        services = await fetchServices(clinicId, today);
      }
      if (!services?.length) {
        await bot.sendMessage(chatId, "Qaytadan boshlang: /start");
        return;
      }
      const newMsgId = await editOrSend(
        bot, chatId, msgId,
        "🏥 *ClinicBot ga xush kelibsiz!*\n\nQaysi xizmatdan foydalanmoqchisiz?",
        mkServiceKeyboard(services)
      );
      userState.set(chatId, {
        ...state,
        step: "select_service",
        messageId: newMsgId,
        serviceId: undefined,
        serviceType: undefined,
        servicePrice: undefined,
        date: undefined,
        doctorId: undefined,
        slotId: undefined,
        patientName: undefined,
        patientPhone: undefined,
        address: undefined,
      });
      return;
    }

    if (target === "select_date") {
      const newMsgId = await editOrSend(
        bot, chatId, msgId,
        "📅 Qaysi kunga yozilmoqchisiz?",
        mkDateKeyboard()
      );
      userState.set(chatId, {
        ...state,
        step: "select_date",
        messageId: newMsgId,
        date: undefined,
        doctorId: undefined,
        slotId: undefined,
        patientName: undefined,
        patientPhone: undefined,
        address: undefined,
      });
      return;
    }

    if (target === "select_doctor_or_slot") {
      const { _doctors, _slots, serviceType } = state;
      if (serviceType === "doctor_queue" && _doctors?.length) {
        const newMsgId = await editOrSend(
          bot, chatId, msgId,
          "👨‍⚕️ Shifokorni tanlang:",
          mkDoctorKeyboard(_doctors)
        );
        userState.set(chatId, {
          ...state,
          step: "select_doctor_or_slot",
          messageId: newMsgId,
          doctorId: undefined,
          slotId: undefined,
          patientName: undefined,
          patientPhone: undefined,
          address: undefined,
        });
      } else if (_slots?.length) {
        const newMsgId = await editOrSend(
          bot, chatId, msgId,
          "🕐 Bo'sh vaqtni tanlang:",
          mkSlotKeyboard(_slots)
        );
        userState.set(chatId, {
          ...state,
          step: "select_doctor_or_slot",
          messageId: newMsgId,
          doctorId: undefined,
          slotId: undefined,
          patientName: undefined,
          patientPhone: undefined,
          address: undefined,
        });
      } else {
        // No cached list — go back to date selection
        const newMsgId = await editOrSend(
          bot, chatId, msgId,
          "📅 Qaysi kunga yozilmoqchisiz?",
          mkDateKeyboard()
        );
        userState.set(chatId, {
          ...state,
          step: "select_date",
          messageId: newMsgId,
          date: undefined,
          doctorId: undefined,
          slotId: undefined,
          patientName: undefined,
          patientPhone: undefined,
          address: undefined,
        });
      }
      return;
    }

    if (target === "enter_name") {
      const newMsgId = await editOrSend(
        bot, chatId, msgId,
        "👤 *Ismingizni kiriting:*\n\n_Pastga yozing_ 👇",
        mkNameKeyboard(state._nameBack || "select_date")
      );
      userState.set(chatId, {
        ...state,
        step: "enter_name",
        messageId: newMsgId,
        patientName: undefined,
        patientPhone: undefined,
        address: undefined,
      });
      return;
    }

    if (target === "enter_phone") {
      const newMsgId = await editOrSend(
        bot, chatId, msgId,
        `👤 Ism: *${state.patientName}*\n\n📞 *Telefon raqamingizni kiriting:*\n\n_+998XXXXXXXXX formatida_ 👇`,
        mkPhoneKeyboard()
      );
      userState.set(chatId, {
        ...state,
        step: "enter_phone",
        messageId: newMsgId,
        patientPhone: undefined,
        address: undefined,
      });
      return;
    }

    // Unknown back target — restart
    await bot.sendMessage(chatId, "Qaytadan boshlang: /start");
    return;
  }

  // ─── cal:day: — calendar day selected (same logic as date:) ─────────────
  if (data.startsWith("cal:day:")) {
    // Re-use date: handler by rewriting data and falling through
    data = "date:" + data.slice("cal:day:".length);
  }

  // ─── svc: — service selected ──────────────────────────────────────────────
  if (data.startsWith("svc:")) {
    const [, serviceId, serviceType] = data.split(":");
    const clinicId = state.clinicId || process.env.DEFAULT_CLINIC_ID || "";
    const service = state._services?.find((s: any) => s.id === serviceId);
    const newMsgId = await editOrSend(
      bot, chatId, msgId,
      "📅 Qaysi kunga yozilmoqchisiz?",
      mkDateKeyboard()
    );
    userState.set(chatId, {
      ...state,
      clinicId,
      serviceId,
      serviceType,
      servicePrice: service?.price ?? null,
      step: "select_date",
      messageId: newMsgId,
      _createdAt: Date.now(),
    });
    return;
  }

  // ─── date: — date selected ────────────────────────────────────────────────
  if (data.startsWith("date:")) {
    const selectedDate = data.split(":")[1];
    const { serviceId, serviceType } = state;
    const clinicId = state.clinicId || process.env.DEFAULT_CLINIC_ID || "";

    if (serviceType === "doctor_queue") {
      const doctors = await fetchDoctors(clinicId);
      if (doctors.length) {
        const newMsgId = await editOrSend(
          bot, chatId, msgId,
          "👨‍⚕️ Shifokorni tanlang:",
          mkDoctorKeyboard(doctors)
        );
        userState.set(chatId, {
          ...state,
          date: selectedDate,
          step: "select_doctor_or_slot",
          messageId: newMsgId,
          _doctors: doctors,
        });
      } else if (state.patientName && state.patientPhone) {
        // No doctors + name/phone saved → skip to confirm
        const confirmState = {
          ...state,
          date: selectedDate,
          step: "confirm",
          _nameBack: "select_date",
          _doctors: [],
        };
        const newMsgId = await editOrSend(
          bot, chatId, msgId,
          mkConfirmText(confirmState),
          mkConfirmKeyboard()
        );
        userState.set(chatId, { ...confirmState, messageId: newMsgId });
      } else {
        const newMsgId = await editOrSend(
          bot, chatId, msgId,
          "👤 *Ismingizni kiriting:*\n\n_Pastga yozing_ 👇",
          mkNameKeyboard("select_date")
        );
        userState.set(chatId, {
          ...state,
          date: selectedDate,
          step: "enter_name",
          messageId: newMsgId,
          _nameBack: "select_date",
          _doctors: [],
        });
      }
      return;
    }

    if (serviceType === "home_service") {
      if (state.patientName && state.patientPhone) {
        // Name/phone saved → skip to enter_address
        const newMsgId = await editOrSend(
          bot, chatId, msgId,
          `👤 Ism: *${state.patientName}*\n📞 Tel: *${state.patientPhone}*\n\n📍 *To'liq manzilingizni kiriting:*\n\nMasalan: Toshkent, Yunusobod 5-mavze, 12-uy 👇`,
          mkAddressKeyboard()
        );
        userState.set(chatId, {
          ...state,
          date: selectedDate,
          step: "enter_address",
          messageId: newMsgId,
        });
      } else {
        const newMsgId = await editOrSend(
          bot, chatId, msgId,
          "👤 *Ismingizni kiriting:*\n\n_Pastga yozing_ 👇",
          mkNameKeyboard("select_date")
        );
        userState.set(chatId, {
          ...state,
          date: selectedDate,
          step: "enter_name",
          messageId: newMsgId,
          _nameBack: "select_date",
        });
      }
      return;
    }

    // diagnostic
    const slots = await fetchSlots(serviceId, selectedDate);
    const available = slots.filter((s: any) => s.available);
    if (available.length) {
      const newMsgId = await editOrSend(
        bot, chatId, msgId,
        "🕐 Bo'sh vaqtni tanlang:",
        mkSlotKeyboard(available)
      );
      userState.set(chatId, {
        ...state,
        date: selectedDate,
        step: "select_doctor_or_slot",
        messageId: newMsgId,
        _slots: available,
      });
    } else if (state.patientName && state.patientPhone) {
      // No slots + name/phone saved → skip to confirm
      const confirmState = {
        ...state,
        date: selectedDate,
        step: "confirm",
        _nameBack: "select_date",
        _slots: [],
      };
      const newMsgId = await editOrSend(
        bot, chatId, msgId,
        mkConfirmText(confirmState),
        mkConfirmKeyboard()
      );
      userState.set(chatId, { ...confirmState, messageId: newMsgId });
    } else {
      const newMsgId = await editOrSend(
        bot, chatId, msgId,
        "👤 *Ismingizni kiriting:*\n\n_Pastga yozing_ 👇",
        mkNameKeyboard("select_date")
      );
      userState.set(chatId, {
        ...state,
        date: selectedDate,
        step: "enter_name",
        messageId: newMsgId,
        _nameBack: "select_date",
        _slots: [],
      });
    }
    return;
  }

  // ─── doc: — doctor selected ───────────────────────────────────────────────
  if (data.startsWith("doc:")) {
    const doctorId = data.split(":")[1];
    const resolvedDoctorId = doctorId === "none" ? null : doctorId;

    if (state.patientName && state.patientPhone) {
      // Skip name/phone → go directly to confirm
      const confirmState = {
        ...state,
        doctorId: resolvedDoctorId,
        step: "confirm",
        _nameBack: "select_doctor_or_slot",
      };
      const newMsgId = await editOrSend(
        bot, chatId, msgId,
        mkConfirmText(confirmState),
        mkConfirmKeyboard()
      );
      userState.set(chatId, { ...confirmState, messageId: newMsgId });
    } else {
      const newMsgId = await editOrSend(
        bot, chatId, msgId,
        "👤 *Ismingizni kiriting:*\n\n_Pastga yozing_ 👇",
        mkNameKeyboard("select_doctor_or_slot")
      );
      userState.set(chatId, {
        ...state,
        doctorId: resolvedDoctorId,
        step: "enter_name",
        messageId: newMsgId,
        _nameBack: "select_doctor_or_slot",
      });
    }
    return;
  }

  // ─── slot: — slot selected ────────────────────────────────────────────────
  if (data.startsWith("slot:")) {
    const slotId = data.split(":")[1];

    if (state.patientName && state.patientPhone) {
      // Skip name/phone → go directly to confirm
      const confirmState = {
        ...state,
        slotId,
        step: "confirm",
        _nameBack: "select_doctor_or_slot",
      };
      const newMsgId = await editOrSend(
        bot, chatId, msgId,
        mkConfirmText(confirmState),
        mkConfirmKeyboard()
      );
      userState.set(chatId, { ...confirmState, messageId: newMsgId });
    } else {
      const newMsgId = await editOrSend(
        bot, chatId, msgId,
        "👤 *Ismingizni kiriting:*\n\n_Pastga yozing_ 👇",
        mkNameKeyboard("select_doctor_or_slot")
      );
      userState.set(chatId, {
        ...state,
        slotId,
        step: "enter_name",
        messageId: newMsgId,
        _nameBack: "select_doctor_or_slot",
      });
    }
    return;
  }

  // ─── confirm ──────────────────────────────────────────────────────────────
  if (data === "confirm") {
    if (state.step !== "confirm") {
      await bot.sendMessage(chatId, "❌ Eskirgan havola. Qaytadan boshlang:\n\n/start");
      userState.delete(chatId);
      return;
    }
    const { clinicId, serviceId, doctorId, slotId, date, patientName, patientPhone, address } = state;
    if (!clinicId || !serviceId || !date || !patientName || !patientPhone) {
      await bot.sendMessage(chatId, "❌ Ma'lumotlar to'liq emas. /start ni bosing.");
      userState.delete(chatId);
      return;
    }

    userState.delete(chatId);

    if (msgId) {
      try {
        await (bot as any).editMessageText("⏳ *Bron qilinmoqda...*", {
          chat_id: chatId,
          message_id: msgId,
          parse_mode: "Markdown",
        });
      } catch {}
    }

    const result = await bookAppointment({
      clinicId, serviceId, doctorId, slotId, date, patientName, patientPhone, address,
    });

    if (result.success) {
      const a = result.data;
      let tibId: string | null = null;
      try {
        tibId = await registerPatient({ phone: patientPhone, firstName: patientName, telegramId: chatId, clinicId });
      } catch {}

      const doctorName = a.doctor ? `${a.doctor.firstName} ${a.doctor.lastName}` : undefined;
      const slotTime = a.slot ? `${a.slot.startTime} — ${a.slot.endTime}` : undefined;

      const successText = [
        "✅ *Qabul tasdiqlandi!*",
        "",
        `👤 Ism: *${patientName}*`,
        `📅 Sana: *${date}*`,
        a.service?.name ? `📋 Xizmat: *${a.service.name}*` : "",
        state.servicePrice != null ? `💰 Narx: *${formatPrice(state.servicePrice)}*` : "",
        a.queueNumber ? `🔢 Navbat raqami: *${a.queueNumber}*` : "📋 Navbat: ro'yxatga qo'shildingiz",
        doctorName ? `👨‍⚕️ Shifokor: *${doctorName}*` : "",
        slotTime ? `🕐 Vaqt: *${slotTime}*` : "",
        tibId ? `🆔 ID: *${tibId}*` : "",
        "",
        tibId ? "📍 Klinikaga kelganda ushbu kodni ko'rsating" : "Klinikaga o'z vaqtida keling! 🏥",
      ].filter(Boolean).join("\n");

      if (msgId) {
        try {
          await (bot as any).editMessageText(successText, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: "Markdown",
          });
        } catch {
          await bot.sendMessage(chatId, successText, { parse_mode: "Markdown" });
        }
      } else {
        await bot.sendMessage(chatId, successText, { parse_mode: "Markdown" });
      }
    } else {
      const errMsg = typeof result.error === "object"
        ? result.error.message
        : (result.error || "Qayta urinib ko'ring");
      const errText = `❌ *Xatolik:* ${errMsg}\n\nQaytadan boshlash: /start`;

      if (msgId) {
        try {
          await (bot as any).editMessageText(errText, {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: "Markdown",
          });
        } catch {
          await bot.sendMessage(chatId, errText, { parse_mode: "Markdown" });
        }
      } else {
        await bot.sendMessage(chatId, errText, { parse_mode: "Markdown" });
      }
    }
    return;
  }

  // ─── cancel ───────────────────────────────────────────────────────────────
  if (data === "cancel") {
    userState.delete(chatId);
    const cancelText = "❌ *Bekor qilindi.*\n\nQaytadan boshlash: /start";
    if (msgId) {
      try {
        await (bot as any).editMessageText(cancelText, {
          chat_id: chatId,
          message_id: msgId,
          parse_mode: "Markdown",
        });
      } catch {
        await bot.sendMessage(chatId, cancelText, { parse_mode: "Markdown" });
      }
    } else {
      await bot.sendMessage(chatId, cancelText, { parse_mode: "Markdown" });
    }
    return;
  }

  // ─── unknown / stale ──────────────────────────────────────────────────────
  await bot.sendMessage(chatId, "⚠️ Eskirgan havola. Qaytadan boshlang:\n\n/start");
  userState.delete(chatId);
}

// ─── Private ──────────────────────────────────────────────────────────────────

function formatPrice(price: number): string {
  return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " so'm";
}
