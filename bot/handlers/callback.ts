import TelegramBot, { CallbackQuery } from "node-telegram-bot-api";
import { fetchDoctors, fetchSlots, bookAppointment, fetchTibId } from "../api";
import { userState } from "../state";

const TZ = process.env.CLINIC_TIMEZONE || "Asia/Tashkent";

function getTodayTomorrow() {
  // Server UTC bo'lsa ham klinika vaqt zonasida "bugun/ertaga" aniq bo'lishi uchun
  const fmt = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toLocaleDateString("sv-SE", { timeZone: TZ }); // YYYY-MM-DD format
  };
  const label = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toLocaleDateString("uz-UZ", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
  };
  return [
    { date: fmt(0), label: `📅 Bugun — ${label(0)}` },
    { date: fmt(1), label: `📅 Ertaga — ${label(1)}` },
  ];
}

export async function handleCallback(bot: TelegramBot, query: CallbackQuery) {
  const chatId = query.message?.chat.id;
  if (!chatId) {
    await bot.answerCallbackQuery(query.id, { text: "Xatolik. /start ni bosing." });
    return;
  }
  const data = query.data || "";
  await bot.answerCallbackQuery(query.id);

  const state = userState.get(chatId) || {};

  // TTL tekshiruvi (confirm bundan mustasno — u state'ni o'chiradi)
  if (data !== "confirm" && data !== "cancel" && state._createdAt) {
    const age = Date.now() - state._createdAt;
    if (age > 30 * 60 * 1000) {
      userState.delete(chatId);
      await bot.sendMessage(chatId, "⏰ Sessiya muddati tugadi. Qaytadan boshlang:\n\n/start");
      return;
    }
  }

  // ─── Service selected ─────────────────────────────────────────────────────
  if (data.startsWith("svc:")) {
    const [, serviceId, serviceType] = data.split(":");
    userState.set(chatId, { ...state, serviceId, serviceType, step: "select_date", _createdAt: Date.now() });

    const dates = getTodayTomorrow();
    const keyboard = dates.map((d) => [{ text: d.label, callback_data: `date:${d.date}` }]);

    await bot.sendMessage(chatId, "📅 Qaysi kunga yozilmoqchisiz?", {
      reply_markup: { inline_keyboard: keyboard },
    });
    return;
  }

  // ─── Date selected ────────────────────────────────────────────────────────
  if (data.startsWith("date:")) {
    const selectedDate = data.split(":")[1];
    const { serviceId, serviceType, clinicId } = state;
    userState.set(chatId, { ...state, date: selectedDate, step: "select_doctor_or_slot" });

    if (serviceType === "doctor_queue") {
      const doctors = await fetchDoctors(clinicId);
      if (!doctors.length) {
        userState.set(chatId, { ...state, date: selectedDate, step: "enter_name" });
        await bot.sendMessage(chatId, "👤 Ismingizni kiriting:");
        return;
      }
      const keyboard = [
        ...doctors.map((d: any) => [{
          text: `👨‍⚕️ ${d.firstName} ${d.lastName} — ${d.specialty}`,
          callback_data: `doc:${d.id}`,
        }]),
        [{ text: "➡️ Shifokor tanlashsiz davom etish", callback_data: "doc:none" }],
      ];
      await bot.sendMessage(chatId, "Shifokorni tanlang:", { reply_markup: { inline_keyboard: keyboard } });
    } else if (serviceType === "home_service") {
      userState.set(chatId, { ...state, date: selectedDate, step: "enter_name" });
      await bot.sendMessage(chatId, "👤 Ismingizni kiriting:");
    } else {
      // diagnostic — check slots
      const slots = await fetchSlots(serviceId, selectedDate);
      const available = slots.filter((s: any) => s.available);
      if (!available.length) {
        // No slots — book without slot
        userState.set(chatId, { ...state, date: selectedDate, step: "enter_name" });
        await bot.sendMessage(chatId, "👤 Ismingizni kiriting:");
        return;
      }
      const keyboard = available.map((s: any) => [{
        text: `🕐 ${s.startTime} — ${s.endTime}`,
        callback_data: `slot:${s.id}`,
      }]);
      await bot.sendMessage(chatId, "Bo'sh vaqtni tanlang:", { reply_markup: { inline_keyboard: keyboard } });
    }
    return;
  }

  // ─── Doctor selected ──────────────────────────────────────────────────────
  if (data.startsWith("doc:")) {
    const doctorId = data.split(":")[1];
    userState.set(chatId, {
      ...state,
      doctorId: doctorId === "none" ? null : doctorId,
      step: "enter_name",
    });
    await bot.sendMessage(chatId, "👤 Ismingizni kiriting:");
    return;
  }

  // ─── Slot selected ────────────────────────────────────────────────────────
  if (data.startsWith("slot:")) {
    userState.set(chatId, { ...state, slotId: data.split(":")[1], step: "enter_name" });
    await bot.sendMessage(chatId, "👤 Ismingizni kiriting:");
    return;
  }

  // ─── Full service ─────────────────────────────────────────────────────────
  if (data.startsWith("full:")) {
    await bot.sendMessage(chatId, "❌ Bu xizmat bugungi limitiga yetdi. Ertaga urinib ko'ring.\n\n/start — Boshidan boshlash");
    return;
  }

  // ─── Confirm ──────────────────────────────────────────────────────────────
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
    // Prevent double-confirm: delete state before async API call
    userState.delete(chatId);
    await bot.sendMessage(chatId, "⏳ Bron qilinmoqda...");

    const result = await bookAppointment({ clinicId, serviceId, doctorId, slotId, date, patientName, patientPhone, address });

    if (result.success) {
      const a = result.data;

      // tibId — mavjud bo'lsa ko'rsatiladi, xato bo'lsa e'tiborga olinmaydi
      let tibId: string | null = null;
      try {
        tibId = await fetchTibId(patientPhone);
      } catch {
        // tibId olishda xato — tasdiqlashni buzmasin
      }

      const doctorName = a.doctor
        ? `${a.doctor.firstName} ${a.doctor.lastName}`
        : undefined;
      const slotTime = a.slot
        ? `${a.slot.startTime} — ${a.slot.endTime}`
        : undefined;

      const lines = [
        "✅ *Qabul tasdiqlandi*",
        "",
        `👤 Ism: *${patientName}*`,
        `📅 Sana: *${date}*`,
        a.service?.name ? `📋 Xizmat: *${a.service.name}*` : "",
        a.queueNumber
          ? `🔢 Navbat: *${a.queueNumber}*`
          : "📋 Navbat: ro'yxatga qo'shildingiz",
        doctorName ? `👨‍⚕️ Shifokor: *${doctorName}*` : "",
        slotTime ? `🕐 Vaqt: *${slotTime}*` : "",
        tibId ? `🆔 ID: *${tibId}*` : "",
        "",
        tibId
          ? "📍 Klinikaga kelganda ushbu kodni ko'rsating"
          : "Klinikaga o'z vaqtida keling! 🏥",
      ].filter(Boolean).join("\n");

      await bot.sendMessage(chatId, lines, { parse_mode: "Markdown" });
    } else {
      const errMsg = typeof result.error === "object" ? result.error.message : (result.error || "Qayta urinib ko'ring");
      await bot.sendMessage(chatId, `❌ Xatolik: ${errMsg}\n\n/start — Boshidan boshlash`);
    }
    return;
  }

  // ─── Cancel ───────────────────────────────────────────────────────────────
  if (data === "cancel") {
    userState.delete(chatId);
    await bot.sendMessage(chatId, "❌ Bekor qilindi.\n\n/start — Boshidan boshlash");
    return;
  }

  // ─── Unknown / stale callback ─────────────────────────────────────────────
  await bot.sendMessage(chatId, "⚠️ Eskirgan havola. Qaytadan boshlang:\n\n/start");
  userState.delete(chatId);
}
