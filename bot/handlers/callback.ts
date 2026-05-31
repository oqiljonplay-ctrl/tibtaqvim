import TelegramBot, { CallbackQuery } from "node-telegram-bot-api";
import { fetchSlots, bookAppointment, registerPatient, fetchServices, fetchUserByTelegramId, fetchUserWithDependents } from "../api";
import { userState } from "../state";
import { prisma } from "@/lib/prisma";
import { parsePaymentConfig, isProviderEnabled } from "@/lib/payment/config-schema";
import { decimalSumToTiyin, formatSum } from "@/lib/payment/money";
import { archivePhone, isArchivedPhone } from "../helpers/phone";
import {
  editOrSend,
  mkServiceKeyboard,
  mkDateKeyboard,
  mkDateKeyboardForMonth,
  mkDoctorKeyboard,
  mkSlotKeyboard,
  mkNameKeyboard,
  mkAddressKeyboard,
  mkConfirmKeyboard,
  mkConfirmText,
  mkLocationKeyboard,
} from "../helpers/render";
import { handleClinicCallback, handleBranchCallback, handleBackToClinic, showBranchOrService } from "./clinicFlow";

async function getClinicSchedule(clinicId?: string): Promise<{ is24Hours: boolean; holidays: string[] }> {
  if (!clinicId) return { is24Hours: false, holidays: [] };
  try {
    const s = await prisma.clinicSettings.findUnique({
      where: { clinicId },
      select: { is24Hours: true, holidays: true },
    });
    if (!s) return { is24Hours: false, holidays: [] };
    return { is24Hours: s.is24Hours, holidays: Array.isArray(s.holidays) ? s.holidays as string[] : [] };
  } catch {
    return { is24Hours: false, holidays: [] };
  }
}

async function getDoctorSchedule(doctorId: string | null | undefined): Promise<{ blockedDates: string[]; blockedWeekdays: number[] }> {
  if (!doctorId) return { blockedDates: [], blockedWeekdays: [] };
  try {
    const blocks = await prisma.doctorBlockedDate.findMany({
      where: { doctorId },
      select: { type: true, weekday: true, date: true },
    });
    return {
      blockedDates: blocks.filter((b) => b.type === "once" && b.date).map((b) => b.date!),
      blockedWeekdays: [...new Set(blocks.filter((b) => b.type === "recurring" && b.weekday != null).map((b) => b.weekday!))],
    };
  } catch {
    return { blockedDates: [], blockedWeekdays: [] };
  }
}

export async function handleCallback(bot: TelegramBot, query: CallbackQuery) {
  const chatId = query.message?.chat.id;
  if (!chatId) {
    await bot.answerCallbackQuery(query.id, { text: "Xatolik. /start ni bosing." });
    return;
  }

  let data = query.data || "";
  const state = await userState.get(chatId) || {};

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

  // ─── cal:month: — calendar month navigation ───────────────────────────────
  if (data.startsWith("cal:month:")) {
    const ym = data.slice("cal:month:".length);
    const [yearStr, monthStr] = ym.split("-");
    const sched = await getClinicSchedule(state.clinicId || process.env.DEFAULT_CLINIC_ID);
    const keyboard = mkDateKeyboardForMonth(parseInt(yearStr), parseInt(monthStr), "select_service", sched);
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

  // ─── booking_in_progress guard — prevent double-confirm ───────────────────
  if (state.step === "booking_in_progress") {
    await bot.answerCallbackQuery(query.id, { text: "⏳ Bron amalga oshirilmoqda..." });
    return;
  }

  // ─── TTL check ────────────────────────────────────────────────────────────
  if (data !== "confirm" && data !== "cancel" && state._createdAt) {
    if (Date.now() - state._createdAt > 30 * 60 * 1000) {
      await userState.delete(chatId);
      await bot.sendMessage(chatId, "⏰ Sessiya muddati tugadi. Qaytadan boshlang:\n\n/start");
      return;
    }
  }

  // ─── relink_yes — eski profil tiklash ────────────────────────────────────
  if (data === "relink_yes") {
    if (!state || state.step !== "awaiting_relink_decision") {
      await bot.answerCallbackQuery(query.id, { text: "Sessiya muddati o'tdi. /start bosing." });
      return;
    }

    const { existingUserId, existingTibId, pendingFirstName, pendingLastName } = state;
    const tgId = String(chatId);

    const existingUser = await prisma.user.findUnique({ where: { id: existingUserId } });
    if (!existingUser) {
      await bot.answerCallbackQuery(query.id, { text: "Profil topilmadi" });
      await userState.delete(chatId);
      return;
    }

    await prisma.telegramIdHistory.create({
      data: {
        userId: existingUserId,
        tibId: existingTibId || "",
        oldTelegramId: existingUser.telegramId,
        newTelegramId: tgId,
        reason: "user-confirmed-relink",
      },
    });

    await prisma.user.update({
      where: { id: existingUserId },
      data: {
        telegramId: tgId,
        firstName: pendingFirstName || existingUser.firstName,
        lastName: pendingLastName || existingUser.lastName || undefined,
      },
    });

    const successText = `✅ *Eski profilingiz tiklandi!*\n\n🆔 ID: *${existingTibId}*\n📞 ${existingUser.phone}\n\nBarcha avvalgi bronlaringiz va ma'lumotlaringiz saqlanib qolgan.`;

    if (msgId) {
      try {
        await (bot as any).editMessageText(successText, {
          chat_id: chatId, message_id: msgId, parse_mode: "Markdown",
        });
      } catch {
        await bot.sendMessage(chatId, successText, { parse_mode: "Markdown" });
      }
    } else {
      await bot.sendMessage(chatId, successText, { parse_mode: "Markdown" });
    }

    await userState.delete(chatId);

    // Klinika tanlash — 1 ta bo'lsa auto-skip, ko'p bo'lsa selection
    await userState.set(chatId, {
      patientName: pendingFirstName || existingUser.firstName,
      patientPhone: existingUser.phone ?? undefined,
      _createdAt: Date.now(),
    });
    return handleBackToClinic(bot, chatId, undefined);
  }

  // ─── relink_no — yangi profil yaratish ───────────────────────────────────
  if (data === "relink_no") {
    if (!state || state.step !== "awaiting_relink_decision") {
      await bot.answerCallbackQuery(query.id, { text: "Sessiya muddati o'tdi. /start bosing." });
      return;
    }

    const { existingUserId, pendingPhone, pendingFirstName, pendingLastName } = state;
    const tgId = String(chatId);

    // Eski user telefonini arxivlaymiz
    const existingUser = await prisma.user.findUnique({ where: { id: existingUserId } });
    if (existingUser?.phone && !isArchivedPhone(existingUser.phone)) {
      await prisma.user.update({
        where: { id: existingUserId },
        data: { phone: archivePhone(existingUser.phone) },
      });
    }

    // Yangi user yaratamiz
    const defaultClinicId = state.clinicId || process.env.DEFAULT_CLINIC_ID || "";
    const newUser = await prisma.user.create({
      data: {
        telegramId: tgId,
        phone: pendingPhone,
        firstName: pendingFirstName || "Foydalanuvchi",
        lastName: pendingLastName ?? undefined,
        role: "patient",
        clinicId: defaultClinicId || undefined,
      },
    });

    const successText = `✅ *Yangi profil yaratildi!*\n\n🆔 ID: *${newUser.tibId}*\n📞 ${pendingPhone}\n\nKlinikaga kelganda ushbu ID ni ko'rsating.`;

    if (msgId) {
      try {
        await (bot as any).editMessageText(successText, {
          chat_id: chatId, message_id: msgId, parse_mode: "Markdown",
        });
      } catch {
        await bot.sendMessage(chatId, successText, { parse_mode: "Markdown" });
      }
    } else {
      await bot.sendMessage(chatId, successText, { parse_mode: "Markdown" });
    }

    await userState.delete(chatId);

    // Klinika tanlash — 1 ta bo'lsa auto-skip, ko'p bo'lsa selection
    await userState.set(chatId, {
      patientName: pendingFirstName || "Foydalanuvchi",
      patientPhone: pendingPhone,
      _createdAt: Date.now(),
    });
    return handleBackToClinic(bot, chatId, undefined);
  }

  // ─── use_saved / change_info — welcome back flow ─────────────────────────
  if (data === "use_saved" || data === "change_info") {
    let patientName: string | undefined = undefined;
    let patientPhone: string | undefined = undefined;
    if (data === "use_saved") {
      patientName = state.patientName;
      patientPhone = state.patientPhone;
      if (!patientName || !patientPhone) {
        const saved = await fetchUserByTelegramId(chatId);
        if (saved) { patientName = saved.firstName; patientPhone = saved.phone ?? undefined; }
      }
    }

    // State'da patientName/Phone saqlash, keyin klinika tanlash
    if (patientName && patientPhone) {
      await userState.set(chatId, { ...state, patientName, patientPhone, _createdAt: Date.now() });
    }

    // Klinika tanlash — 1 ta bo'lsa auto-skip, ko'p bo'lsa selection
    return handleBackToClinic(bot, chatId, msgId);
  }

  // ─── back: navigation ─────────────────────────────────────────────────────
  if (data.startsWith("back:")) {
    const target = data.slice(5);

    if (target === "select_service") {
      const clinicId = state.clinicId || process.env.DEFAULT_CLINIC_ID || "";
      const branchId = state.branchId;
      let services = state._services;
      if (!services?.length) {
        const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" });
        const fetched = await fetchServices(clinicId, today);
        services = fetched.services;
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
      await userState.set(chatId, {
        ...state,
        step:                  "select_service",
        clinicId,
        branchId,
        messageId:             newMsgId,
        serviceId:             undefined,
        serviceType:           undefined,
        servicePrice:          undefined,
        serviceRequiresSlot:   undefined,
        serviceRequiresAddress: undefined,
        date:                  undefined,
        doctorId:              undefined,
        slotId:                undefined,
        patientName:           data === "use_saved" ? state.patientName : undefined,
        patientPhone:          data === "use_saved" ? state.patientPhone : undefined,
        address:               undefined,
      });
      return;
    }

    if (target === "select_clinic") {
      return handleBackToClinic(bot, chatId, msgId);
    }

    if (target === "select_date") {
      // Back uchun: doctor bor edi → doctor bosqichiga qayt, yo'q → servicega qayt
      const backStep = state._doctors?.length > 0 ? "select_doctor" : "select_service";
      const sched1 = await getClinicSchedule(state.clinicId || process.env.DEFAULT_CLINIC_ID);
      const newMsgId = await editOrSend(
        bot, chatId, msgId,
        "📅 Qaysi kunga yozilmoqchisiz?",
        mkDateKeyboard(backStep, sched1)
      );
      await userState.set(chatId, {
        ...state,
        step: "select_date",
        messageId: newMsgId,
        date: undefined,
        slotId: undefined,
        patientName: undefined,
        patientPhone: undefined,
        address: undefined,
      });
      return;
    }

    if (target === "select_doctor") {
      const doctors = state._doctors;
      if (doctors?.length) {
        const newMsgId = await editOrSend(
          bot, chatId, msgId,
          "👨‍⚕️ Shifokorni tanlang:",
          mkDoctorKeyboard(doctors, "select_service")
        );
        await userState.set(chatId, {
          ...state,
          step: "select_doctor",
          messageId: newMsgId,
          doctorId: undefined,
          date: undefined,
          slotId: undefined,
          patientName: undefined,
          patientPhone: undefined,
          address: undefined,
        });
      } else {
        await bot.sendMessage(chatId, "Qaytadan boshlang: /start");
      }
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
        await userState.set(chatId,{
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
        await userState.set(chatId,{
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
        const schedB = await getClinicSchedule(state.clinicId || process.env.DEFAULT_CLINIC_ID);
        const newMsgId = await editOrSend(
          bot, chatId, msgId,
          "📅 Qaysi kunga yozilmoqchisiz?",
          mkDateKeyboard("select_service", schedB)
        );
        await userState.set(chatId,{
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
      // DB dan ism tekshirish — bor bo'lsa skip, yo'q bo'lsa so'raymiz
      const savedUser = await fetchUserByTelegramId(chatId);
      const hasName = savedUser?.firstName && savedUser.firstName.trim().length >= 2;
      const hasPhone = !!(savedUser?.phone || state.patientPhone);

      if (hasName && hasPhone) {
        // Ism va telefon DB da bor — to'g'ridan confirm ga o'tish
        const updatedState = {
          ...state,
          patientName: savedUser!.firstName,
          patientPhone: state.patientPhone || savedUser!.phone,
          step: "confirm",
        };
        const newMsgId = await editOrSend(
          bot, chatId, msgId,
          mkConfirmText(updatedState),
          mkConfirmKeyboard()
        );
        await userState.set(chatId, { ...updatedState, messageId: newMsgId });
        return;
      }

      if (hasName && !hasPhone) {
        // Ism bor lekin telefon yo'q — state ga ismni to'ldirish, share_contact ga
        await userState.set(chatId, {
          ...state,
          patientName: savedUser!.firstName,
          step: "share_contact",
          address: undefined,
        });
        const newMsgId = await editOrSend(
          bot, chatId, msgId,
          `👤 Ism: *${savedUser!.firstName}*\n\n📱 Davom etish uchun kontaktingizni ulashing:`,
          [[{ text: "⬅️ Orqaga", callback_data: `back:${state._nameBack || "select_date"}` }]]
        );
        await userState.set(chatId, { ...state, patientName: savedUser!.firstName, step: "share_contact", messageId: newMsgId });
        return;
      }

      // Ism yo'q — odatdagi enter_name
      const newMsgId = await editOrSend(
        bot, chatId, msgId,
        "👤 *Ismingizni kiriting:*\n\n_Pastga yozing_ 👇",
        mkNameKeyboard(state._nameBack || "select_date")
      );
      // patientPhone saqlab qolamiz — qaytib kelgan user kontaktni qayta ulashmasin
      await userState.set(chatId, {
        ...state,
        step: "enter_name",
        messageId: newMsgId,
        patientName: undefined,
        address: undefined,
      });
      return;
    }

    await bot.sendMessage(chatId, "Qaytadan boshlang: /start");
    return;
  }

  // ─── clinic: — klinika tanlash ───────────────────────────────────────────
  if (data.startsWith("clinic:")) {
    const clinicId = data.split(":")[1];
    return handleClinicCallback(bot, chatId, clinicId, msgId);
  }

  // ─── branch: — filial tanlash ─────────────────────────────────────────────
  if (data.startsWith("branch:")) {
    const branchId = data.split(":")[1];
    return handleBranchCallback(bot, chatId, branchId, msgId);
  }

  // ─── cal:day: — calendar day selected ────────────────────────────────────
  if (data.startsWith("cal:day:")) {
    data = "date:" + data.slice("cal:day:".length);
  }

  // ─── svc: — service selected ──────────────────────────────────────────────
  if (data.startsWith("svc:")) {
    const [, serviceId, serviceType] = data.split(":");
    const clinicId = state.clinicId || process.env.DEFAULT_CLINIC_ID || "";
    const service = state._services?.find((s: any) => s.id === serviceId);

    // Service-specific doctorlarni M2M dan olish
    const serviceWithDoctors = await prisma.service.findUnique({
      where: { id: serviceId },
      include: {
        doctors: {
          where: { doctor: { isActive: true } },
          include: { doctor: true },
        },
      },
    });
    const serviceDoctors = serviceWithDoctors?.doctors.map((sd: any) => sd.doctor) ?? [];

    const baseState = {
      ...state,
      clinicId,
      branchId: state.branchId || undefined,
      serviceId,
      serviceType,
      servicePrice: service?.price ?? null,
      serviceRequiresSlot: service?.requiresSlot ?? false,
      serviceRequiresAddress: service?.requiresAddress ?? false,
      _createdAt: Date.now(),
    };

    if (serviceDoctors.length > 0) {
      // Shifokor tanlash bosqichi — sana tanlashdan OLDIN
      const newMsgId = await editOrSend(
        bot, chatId, msgId,
        `👨‍⚕️ *${serviceWithDoctors?.name ?? "Xizmat"}* uchun shifokorni tanlang:`,
        mkDoctorKeyboard(serviceDoctors, "select_service")
      );
      await userState.set(chatId, {
        ...baseState,
        step: "select_doctor",
        messageId: newMsgId,
        _doctors: serviceDoctors,
      });
    } else {
      // Shifokor yo'q — to'g'ridan sana tanlash
      const schedC = await getClinicSchedule(state.clinicId || process.env.DEFAULT_CLINIC_ID);
      const newMsgId = await editOrSend(
        bot, chatId, msgId,
        "📅 Qaysi kunga yozilmoqchisiz?",
        mkDateKeyboard("select_service", schedC)
      );
      await userState.set(chatId, {
        ...baseState,
        step: "select_date",
        messageId: newMsgId,
        _doctors: [],
      });
    }
    return;
  }

  // ─── date: — date selected ────────────────────────────────────────────────
  if (data.startsWith("date:")) {
    const selectedDate = data.split(":")[1];
    const { serviceId, serviceType } = state;

    // ── home_service ──
    if (serviceType === "home_service") {
      if (state.patientName && state.patientPhone) {
        const newMsgId = await editOrSend(
          bot, chatId, msgId,
          `👤 Ism: *${state.patientName}*\n📞 Tel: *${state.patientPhone}*\n\n📍 *To'liq manzilingizni kiriting:*\n\nMasalan: Toshkent, Yunusobod 5-mavze, 12-uy 👇`,
          mkAddressKeyboard()
        );
        await userState.set(chatId,{
          ...state,
          date: selectedDate,
          step: "enter_address",
          messageId: newMsgId,
        });
      } else {
        const newState = { ...state, date: selectedDate, _nameBack: "select_date" };
        await showPatientSelection(bot, chatId, newState, msgId);
      }
      return;
    }

    // ── diagnostic ────────────────────────────────────────────────────────────
    // BUG FIX: check requiresSlot flag stored at service selection time.
    // If false  → skip slot step entirely.
    // If true   → fetch slots; if none available show error (NOT proceed to confirm).
    const requiresSlot = state.serviceRequiresSlot ?? false;

    if (!requiresSlot) {
      // Slot kerak emas — to'g'ridan ism/tasdiqlashga o'tish
      if (state.patientName && state.patientPhone) {
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
        await userState.set(chatId,{ ...confirmState, messageId: newMsgId });
      } else {
        const newState = { ...state, date: selectedDate, _nameBack: "select_date", _slots: [] };
        await showPatientSelection(bot, chatId, newState, msgId);
      }
      return;
    }

    // requiresSlot=true → slotlarni yuklash
    const slots = await fetchSlots(serviceId, selectedDate);
    const available = slots.filter((s: any) => s.available);

    if (available.length) {
      const newMsgId = await editOrSend(
        bot, chatId, msgId,
        "🕐 Bo'sh vaqtni tanlang:",
        mkSlotKeyboard(available)
      );
      await userState.set(chatId,{
        ...state,
        date: selectedDate,
        step: "select_doctor_or_slot",
        messageId: newMsgId,
        _slots: available,
      });
    } else {
      // BUG FIX: requiresSlot=true lekin slot yo'q → confirmga yuborma, xabar ber
      const schedD = await getClinicSchedule(state.clinicId || process.env.DEFAULT_CLINIC_ID);
      const newMsgId = await editOrSend(
        bot, chatId, msgId,
        "😔 *Bu kunda bo'sh vaqt mavjud emas.*\n\nBoshqa kunni tanlang:",
        mkDateKeyboard("select_service", schedD)
      );
      await userState.set(chatId,{
        ...state,
        step: "select_date",
        messageId: newMsgId,
        date: undefined,
        _slots: [],
      });
    }
    return;
  }

  // ─── doc: — doctor selected → sana tanlashga o'tish ─────────────────────
  if (data.startsWith("doc:")) {
    const doctorId = data.split(":")[1];
    const resolvedDoctorId = doctorId === "none" ? null : doctorId;

    // Yangi flow: doctor tanlangach → sana tanlash (confirm/name emas)
    const schedE = await getClinicSchedule(state.clinicId || process.env.DEFAULT_CLINIC_ID);
    const docSched = await getDoctorSchedule(resolvedDoctorId);
    const combinedSched = {
      ...schedE,
      doctorBlockedDates: docSched.blockedDates,
      doctorBlockedWeekdays: docSched.blockedWeekdays,
    };
    const newMsgId = await editOrSend(
      bot, chatId, msgId,
      "📅 Qaysi kunga yozilmoqchisiz?",
      mkDateKeyboard("select_doctor", combinedSched)
    );
    await userState.set(chatId, {
      ...state,
      doctorId: resolvedDoctorId,
      step: "select_date",
      messageId: newMsgId,
    });
    return;
  }

  // ─── slot: — slot selected ────────────────────────────────────────────────
  if (data.startsWith("slot:")) {
    const slotId = data.split(":")[1];

    if (state.patientName && state.patientPhone) {
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
      await userState.set(chatId,{ ...confirmState, messageId: newMsgId });
    } else {
      const newState = { ...state, slotId, _nameBack: "select_doctor_or_slot" };
      await showPatientSelection(bot, chatId, newState, msgId);
    }
    return;
  }

  // ─── confirm ──────────────────────────────────────────────────────────────
  if (data === "confirm") {
    if (state.step !== "confirm") {
      await bot.sendMessage(chatId, "❌ Eskirgan havola. Qaytadan boshlang:\n\n/start");
      await userState.delete(chatId);
      return;
    }
    const { clinicId, branchId, serviceId, doctorId, slotId, date, patientName, patientPhone, address } = state;
    if (!clinicId || !serviceId || !date || !patientName || !patientPhone) {
      await bot.sendMessage(chatId, "❌ Ma'lumotlar to'liq emas. /start ni bosing.");
      await userState.delete(chatId);
      return;
    }

    // BUG FIX: mark in-progress BEFORE async call to prevent double-booking.
    // State is deleted AFTER bookAppointment returns (success or error).
    await userState.set(chatId,{ ...state, step: "booking_in_progress" });

    if (msgId) {
      try {
        await (bot as any).editMessageText("⏳ *Bron qilinmoqda...*", {
          chat_id: chatId,
          message_id: msgId,
          parse_mode: "Markdown",
        });
      } catch {}
    }

    // Register/resolve user BEFORE booking so appointment is created with userId set.
    // This ensures tibId is visible in reception/doctor panels immediately.
    let tibId: string | null = null;
    let resolvedUserId: string | null = null;
    try {
      const reg = await registerPatient({ phone: patientPhone, firstName: patientName, telegramId: chatId, clinicId });
      tibId = reg.tibId;
      resolvedUserId = reg.userId;
    } catch {}

    const result = await bookAppointment({
      clinicId,
      ...(branchId ? { branchId } : {}),
      serviceId, doctorId, slotId, date, patientName, patientPhone, address,
      ...(resolvedUserId ? { userId: resolvedUserId } : {}),
    });

    // Delete state after booking completes (not before)
    await userState.delete(chatId);

    if (result.success) {
      const a = result.data;

      // tibId: registerPatient dan (primary) yoki booking response dan (fallback)
      const finalTibId = tibId || (a as any).tibId || null;

      const doctorName = a.doctor ? `${a.doctor.firstName} ${a.doctor.lastName}` : undefined;
      const slotTime = a.slot ? `${a.slot.startTime} — ${a.slot.endTime}` : undefined;

      const queueMode = (a as any).queueMode || "online";
      const isLive = queueMode === "live";

      const successText = [
        "✅ *Qabul tasdiqlandi!*",
        "",
        `👤 Ism: *${patientName}*`,
        `📅 Sana: *${date}*`,
        a.service?.name ? `📋 Xizmat: *${a.service.name}*` : "",
        state.servicePrice != null ? `💰 Narx: *${formatPrice(state.servicePrice)}*` : "",
        doctorName ? `👨‍⚕️ Shifokor: *${doctorName}*` : "",
        slotTime ? `🕐 Vaqt: *${slotTime}*` : "",
        finalTibId ? `🆔 ID: *${finalTibId}*` : "",
        "",
        isLive
          ? "💵 *Rejim:* Kunlik ro'yxatga kirish"
          : (a.queueNumber ? `🔢 Navbat raqami: *#${a.queueNumber}*` : "📋 Navbat: ro'yxatga qo'shildingiz"),
        "",
        isLive
          ? "⚠️ Klinikaga kelib kassadan jonli navbat raqami oling"
          : (finalTibId ? "📍 Klinikaga kelganda ushbu ID ni ko'rsating" : "Klinikaga o'z vaqtida keling! 🏥"),
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

      // Uyda bemor ko'rish — joylashuv so'rash
      if (state.serviceType === "home_service" && result.data?.id) {
        await userState.set(chatId, {
          step: "awaiting_location",
          appointmentId: result.data.id,
          requestedAt: Date.now(),
          attemptCount: 1,
        });
        await bot.sendMessage(
          chatId,
          "📍 *Joylashuvingizni yuboring*\n\n" +
          "Doktor sizga yetib borishi uchun joylashuvingiz kerak.\n\n" +
          "⚠️ *MUHIM:* Avval telefoningizda GPS (joylashuv) yoqilganligini tekshiring!\n\n" +
          "📱 *Android:* Sozlamalar → Joylashuv → Yoqing\n" +
          "📱 *iPhone:* Sozlamalar → Maxfiylik → Joylashuv xizmatlari → Yoqing\n\n" +
          "Tayyor bo'lganingizda quyidagi tugmani bosing:",
          { parse_mode: "Markdown", reply_markup: mkLocationKeyboard() as any }
        );
      }

      // To'lov tugmasi — requiresPrePayment bo'lgan xizmatlar uchun
      if (result.data?.id && serviceId) {
        try {
          const svc = await prisma.service.findUnique({
            where: { id: serviceId },
            select: { requiresPrePayment: true, prePaymentAmount: true, name: true },
          });
          if (svc?.requiresPrePayment && svc.prePaymentAmount) {
            const clinic = await prisma.clinic.findUnique({
              where: { id: clinicId },
              select: { paymentConfig: true },
            });
            const config = parsePaymentConfig(clinic?.paymentConfig ?? null);
            const hasPayme = isProviderEnabled(config, "payme");
            const hasClick = isProviderEnabled(config, "click");

            if (hasPayme || hasClick) {
              const amountTiyin = decimalSumToTiyin(svc.prePaymentAmount);
              const amountText = amountTiyin ? formatSum(amountTiyin) : "";
              const webappUrl = process.env.NEXT_PUBLIC_WEBAPP_URL || "https://tibtaqvim.vercel.app/webapp";
              const payUrl = `${webappUrl}/appointments/${result.data.id}/pay`;

              await bot.sendMessage(
                chatId,
                `💳 *To'lov talab qilinadi*\n\nXizmat: *${svc.name}*\nSumma: *${amountText}*\n\nTo'lov qilish uchun quyidagi tugmani bosing:`,
                {
                  parse_mode: "Markdown",
                  reply_markup: {
                    inline_keyboard: [[
                      { text: `💳 To'lov qilish (${amountText})`, web_app: { url: payUrl } },
                    ]],
                  } as any,
                }
              );
            }
          }
        } catch (payErr) {
          console.error("[payment-button] Error:", payErr);
        }
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

  // ─── patient: — bemor tanlash ────────────────────────────────────────────
  if (data === "patient:self") {
    const user = await fetchUserWithDependents(chatId);
    if (!user || !user.firstName || !user.phone) {
      await showPatientSelection(bot, chatId, state, msgId);
      return;
    }
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
    const updatedState = {
      ...state,
      patientType: "self",
      dependentId: null,
      patientName: fullName,
      patientPhone: user.phone,
    };
    await goToNextAfterPatient(bot, chatId, updatedState, msgId);
    return;
  }

  if (data.startsWith("patient:dep:")) {
    const depId = data.replace("patient:dep:", "");
    const user = await fetchUserWithDependents(chatId);
    if (!user) {
      await bot.sendMessage(chatId, "❌ Profil topilmadi. /start");
      return;
    }
    const dep = user.dependents.find((d) => d.id === depId);
    if (!dep) {
      await bot.sendMessage(chatId, "❌ Qaramog'idagi topilmadi. /start");
      return;
    }
    const depFullName = [dep.firstName, dep.lastName].filter(Boolean).join(" ");
    const phone = dep.phone || user.phone || "";
    const updatedState = {
      ...state,
      patientType: "dependent",
      dependentId: dep.id,
      patientName: depFullName,
      patientPhone: phone,
    };
    await goToNextAfterPatient(bot, chatId, updatedState, msgId);
    return;
  }

  if (data === "patient:add_dep") {
    const user = await fetchUserWithDependents(chatId);
    if (!user) {
      await bot.sendMessage(chatId, "❌ Profil topilmadi. /start");
      return;
    }
    if (user.dependents.length >= 2) {
      await bot.sendMessage(chatId, "❌ Maksimal 2 ta qaramog'idagi shaxs qo'shishingiz mumkin");
      await showPatientSelection(bot, chatId, state, msgId);
      return;
    }
    await userState.set(chatId, { ...state, step: "add_dep_name" });
    await bot.sendMessage(chatId,
      `👤 Qaramog'idagi shaxs ismini kiriting:\n\nMasalan: "Munira" 👇`,
      { reply_markup: { inline_keyboard: [[{ text: "⬅️ Orqaga", callback_data: "patient:back" }]] } }
    );
    return;
  }

  if (data === "patient:back") {
    await showPatientSelection(bot, chatId, state, msgId);
    return;
  }

  if (data === "dep_relation:skip_lastname") {
    // Familiyasiz — relation bosqichiga o'tish
    await userState.set(chatId, { ...state, tempDepLastName: null, step: "add_dep_relation" });
    const relations = ["Onam", "Otam", "O'g'lim", "Qizim", "Xotinim", "Erim", "Aka", "Singil", "Boshqa"];
    const newMsgId = await editOrSend(
      bot, chatId, msgId,
      "Kim bo'ladi? (tugmadan tanlang yoki o'tkazib yuboring)",
      [
        ...relations.map((r) => [{ text: r, callback_data: `dep_relation:${r}` }]),
        [{ text: "⏭ O'tkazib yuborish", callback_data: "dep_relation:skip" }],
      ]
    );
    await userState.set(chatId, { ...state, tempDepLastName: null, step: "add_dep_relation", messageId: newMsgId });
    return;
  }

  if (data.startsWith("dep_relation:")) {
    const relation = data === "dep_relation:skip" ? null : data.replace("dep_relation:", "");
    const user = await fetchUserWithDependents(chatId);
    if (!user) {
      await bot.sendMessage(chatId, "❌ Profil topilmadi. /start");
      return;
    }
    try {
      const dep = await (await import("@/lib/prisma")).prisma.dependent.create({
        data: {
          userId: user.id,
          firstName: state.tempDepFirstName,
          lastName: state.tempDepLastName || null,
          relation,
        },
      });
      const depFullName = [dep.firstName, dep.lastName].filter(Boolean).join(" ");
      const updatedState = {
        ...state,
        patientType: "dependent",
        dependentId: dep.id,
        patientName: depFullName,
        patientPhone: dep.phone || user.phone || "",
        tempDepFirstName: undefined,
        tempDepLastName: undefined,
      };
      await bot.sendMessage(chatId, `✅ ${depFullName} qaramog'ingizga qo'shildi`);
      await goToNextAfterPatient(bot, chatId, updatedState, msgId);
    } catch (err: any) {
      if (err?.message?.includes("DEPENDENTS_LIMIT_EXCEEDED")) {
        await bot.sendMessage(chatId, "❌ Maksimal 2 ta qaramog'idagi shaxs qo'shishingiz mumkin");
        return showPatientSelection(bot, chatId, state, msgId);
      }
      console.error("[dep_relation] error:", err);
      await bot.sendMessage(chatId, "❌ Xatolik yuz berdi. Qaytadan urinib ko'ring.");
    }
    return;
  }

  // ─── cancel ───────────────────────────────────────────────────────────────
  if (data === "cancel") {
    await userState.delete(chatId);
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
  await userState.delete(chatId);
}

// ─── Private ──────────────────────────────────────────────────────────────────

function formatPrice(price: number): string {
  return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " so'm";
}

async function showPatientSelection(
  bot: TelegramBot,
  chatId: number,
  state: any,
  msgId?: number
): Promise<void> {
  const user = await fetchUserWithDependents(chatId);

  // Profil yo'q yoki telefon yo'q → eski enter_name flow
  if (!user || !user.firstName || !user.phone) {
    const newMsgId = await editOrSend(
      bot, chatId, msgId,
      "👤 *Ismingizni kiriting:*\n\n_Pastga yozing_ 👇",
      mkNameKeyboard(state._nameBack || "select_date")
    );
    await userState.set(chatId, { ...state, step: "enter_name", messageId: newMsgId });
    return;
  }

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  const buttons: any[] = [
    [{ text: `✅ O'zim (${fullName})`, callback_data: "patient:self" }],
  ];

  for (const dep of user.dependents) {
    const depName = [dep.firstName, dep.lastName].filter(Boolean).join(" ");
    const label = dep.relation ? `👤 ${depName} (${dep.relation})` : `👤 ${depName}`;
    buttons.push([{ text: label, callback_data: `patient:dep:${dep.id}` }]);
  }

  if (user.dependents.length < 2) {
    buttons.push([{ text: `➕ Qaramog'imdagi (${user.dependents.length}/2)`, callback_data: "patient:add_dep" }]);
  }

  buttons.push([{ text: "⬅️ Orqaga", callback_data: `back:${state._nameBack || "select_date"}` }]);

  const newMsgId = await editOrSend(
    bot, chatId, msgId,
    "👤 *Bron kim uchun?*",
    buttons
  );
  await userState.set(chatId, { ...state, step: "select_patient", messageId: newMsgId });
}

async function goToNextAfterPatient(
  bot: TelegramBot,
  chatId: number,
  state: any,
  msgId?: number
): Promise<void> {
  if (state.serviceType === "home_service") {
    if (state.address) {
      // Manzil allaqachon kiritilgan — confirmga o'tish
      const confirmState = { ...state, step: "confirm" };
      const newMsgId = await editOrSend(bot, chatId, msgId, mkConfirmText(confirmState), mkConfirmKeyboard());
      await userState.set(chatId, { ...confirmState, messageId: newMsgId });
    } else {
      const newMsgId = await editOrSend(
        bot, chatId, msgId,
        `👤 Ism: *${state.patientName}*\n📞 Tel: *${state.patientPhone}*\n\n📍 *To'liq manzilingizni kiriting:*\n\nMasalan: Toshkent, Yunusobod 5-mavze, 12-uy 👇`,
        mkAddressKeyboard()
      );
      await userState.set(chatId, { ...state, step: "enter_address", messageId: newMsgId });
    }
  } else {
    const confirmState = { ...state, step: "confirm" };
    const newMsgId = await editOrSend(bot, chatId, msgId, mkConfirmText(confirmState), mkConfirmKeyboard());
    await userState.set(chatId, { ...confirmState, messageId: newMsgId });
  }
}
