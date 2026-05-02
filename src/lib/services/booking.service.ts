import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { Prisma } from "@prisma/client";
import type { BookingInput } from "@/lib/validators/booking";
import { getTibIdByPhone, assignTibId } from "@/lib/services/tib-id.service";
import { buildConfirmationMessage, sendTelegramConfirmation } from "@/lib/services/confirmation.service";
import { normalizePhone } from "@/lib/utils/phone";

type AppointmentWithRelations = Prisma.AppointmentGetPayload<{
  include: {
    service: { select: { name: true; type: true; price: true } };
    doctor: { select: { firstName: true; lastName: true; specialty: true } };
    slot: { select: { startTime: true; endTime: true } };
  };
}>;

export type BookingResult =
  | { success: true; data: AppointmentWithRelations; tibId: string | null }
  | { success: false; error: { code: string; message: string }; status: number };

function bookingError(code: string, message: string, status: number): BookingResult {
  return { success: false, error: { code, message }, status };
}

// ─── Doctor Queue ─────────────────────────────────────────────────────────────
async function bookDoctorQueue(input: BookingInput, service: { dailyLimit: number | null }, bookingDate: Date): Promise<BookingResult> {
  try {
    const appt = await prisma.$transaction(async (tx) => {
      if (service.dailyLimit !== null) {
        const count = await tx.appointment.count({
          where: { serviceId: input.serviceId, date: bookingDate, status: { not: "cancelled" } },
        });
        if (count >= service.dailyLimit) {
          throw { code: "LIMIT_REACHED", message: `Kunlik limit to'ldi (${service.dailyLimit} ta)` };
        }
      }

      const duplicate = await tx.appointment.findFirst({
        where: {
          serviceId: input.serviceId,
          patientPhone: normalizePhone(input.patientPhone),
          date: bookingDate,
          status: { not: "cancelled" },
        },
      });
      if (duplicate) {
        throw { code: "DUPLICATE_BOOKING", message: "Bu raqam uchun bugun allaqachon navbat bron qilingan" };
      }

      const last = await tx.appointment.findFirst({
        where: { serviceId: input.serviceId, date: bookingDate, status: { not: "cancelled" } },
        orderBy: { queueNumber: "desc" },
      });
      const queueNumber = (last?.queueNumber ?? 0) + 1;

      return tx.appointment.create({
        data: {
          clinicId: input.clinicId,
          serviceId: input.serviceId,
          doctorId: input.doctorId ?? null,
          userId: input.userId ?? null,
          slotId: null,
          date: bookingDate,
          patientName: input.patientName.trim(),
          patientPhone: normalizePhone(input.patientPhone),
          address: null,
          queueNumber,
          status: "booked",
        },
        include: {
          service: { select: { name: true, type: true, price: true } },
          doctor: { select: { firstName: true, lastName: true, specialty: true } },
          slot: { select: { startTime: true, endTime: true } },
        },
      });
    });

    logger.info("DoctorQueue booked", { appointmentId: appt.id, queueNumber: appt.queueNumber });
    return { success: true, data: appt, tibId: null };
  } catch (err: any) {
    if (err?.code === "LIMIT_REACHED") return bookingError("LIMIT_REACHED", err.message, 409);
    if (err?.code === "DUPLICATE_BOOKING") return bookingError("DUPLICATE_BOOKING", err.message, 409);
    throw err;
  }
}

// ─── Diagnostic ───────────────────────────────────────────────────────────────
async function bookDiagnostic(input: BookingInput, service: { dailyLimit: number | null; requiresSlot: boolean }, bookingDate: Date): Promise<BookingResult> {
  if (service.requiresSlot && !input.slotId) {
    return bookingError("SLOT_REQUIRED", "Bu xizmat uchun uyacha tanlash majburiy", 400);
  }

  try {
    const appt = await prisma.$transaction(async (tx) => {
      if (service.dailyLimit !== null) {
        const count = await tx.appointment.count({
          where: { serviceId: input.serviceId, date: bookingDate, status: { not: "cancelled" } },
        });
        if (count >= service.dailyLimit) {
          throw { code: "LIMIT_REACHED", message: "Kunlik limit to'ldi" };
        }
      }

      if (service.requiresSlot && input.slotId) {
        const slot = await tx.slot.findUnique({ where: { id: input.slotId } });
        if (!slot || !slot.isActive) {
          throw { code: "SLOT_INVALID", message: "Uyacha mavjud emas yoki nofaol" };
        }
        const slotCount = await tx.appointment.count({
          where: { slotId: input.slotId, status: { not: "cancelled" } },
        });
        if (slotCount >= slot.capacity) {
          throw { code: "SLOT_FULL", message: "Uyacha to'lgan" };
        }
      }

      return tx.appointment.create({
        data: {
          clinicId: input.clinicId,
          serviceId: input.serviceId,
          doctorId: input.doctorId ?? null,
          userId: input.userId ?? null,
          slotId: input.slotId ?? null,
          date: bookingDate,
          patientName: input.patientName.trim(),
          patientPhone: normalizePhone(input.patientPhone),
          address: null,
          queueNumber: null,
          status: "booked",
        },
        include: {
          service: { select: { name: true, type: true, price: true } },
          doctor: { select: { firstName: true, lastName: true, specialty: true } },
          slot: { select: { startTime: true, endTime: true } },
        },
      });
    });

    logger.info("Diagnostic booked", { appointmentId: appt.id, slotId: input.slotId });
    return { success: true, data: appt, tibId: null };
  } catch (err: any) {
    if (err?.code === "LIMIT_REACHED") return bookingError("LIMIT_REACHED", err.message, 409);
    if (err?.code === "SLOT_INVALID") return bookingError("SLOT_INVALID", err.message, 400);
    if (err?.code === "SLOT_FULL") return bookingError("SLOT_FULL", err.message, 409);
    throw err;
  }
}

// ─── Home Service ─────────────────────────────────────────────────────────────
async function bookHomeService(input: BookingInput, service: { dailyLimit: number | null }, bookingDate: Date): Promise<BookingResult> {
  if (!input.address?.trim()) {
    return bookingError("ADDRESS_REQUIRED", "Uy xizmati uchun manzil majburiy", 400);
  }

  try {
    const appt = await prisma.$transaction(async (tx) => {
      if (service.dailyLimit !== null) {
        const count = await tx.appointment.count({
          where: { serviceId: input.serviceId, date: bookingDate, status: { not: "cancelled" } },
        });
        if (count >= service.dailyLimit) {
          throw { code: "LIMIT_REACHED", message: "Bugun uy xizmati limiti to'ldi" };
        }
      }

      return tx.appointment.create({
        data: {
          clinicId: input.clinicId,
          serviceId: input.serviceId,
          doctorId: null,
          userId: input.userId ?? null,
          slotId: null,
          date: bookingDate,
          patientName: input.patientName.trim(),
          patientPhone: normalizePhone(input.patientPhone),
          address: input.address!.trim(),
          queueNumber: null,
          status: "booked",
        },
        include: {
          service: { select: { name: true, type: true, price: true } },
          doctor: { select: { firstName: true, lastName: true, specialty: true } },
          slot: { select: { startTime: true, endTime: true } },
        },
      });
    });

    logger.info("HomeService booked", { appointmentId: appt.id });
    return { success: true, data: appt, tibId: null };
  } catch (err: any) {
    if (err?.code === "LIMIT_REACHED") return bookingError("LIMIT_REACHED", err.message, 409);
    throw err;
  }
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────
export async function processBooking(input: BookingInput): Promise<BookingResult> {
  const service = await prisma.service.findFirst({
    where: { id: input.serviceId, clinicId: input.clinicId, isActive: true },
  });

  if (!service) {
    return bookingError("SERVICE_NOT_FOUND", "Xizmat topilmadi yoki nofaol", 404);
  }

  const { getModuleConfig } = await import("@/lib/services/config.service");
  const mod = await getModuleConfig(input.clinicId, service.type);
  if (!mod.enabled) {
    return bookingError("MODULE_DISABLED", "Bu xizmat hozir mavjud emas", 403);
  }

  // Force UTC midnight so @db.Date stores the correct calendar date
  // regardless of server timezone (Vercel = UTC, local dev = +5).
  const bookingDate = new Date(input.date + "T00:00:00.000Z");

  try {
    let result: BookingResult;
    switch (service.type) {
      case "doctor_queue":
        result = await bookDoctorQueue(input, service, bookingDate);
        break;
      case "diagnostic":
        result = await bookDiagnostic(input, { dailyLimit: service.dailyLimit, requiresSlot: service.requiresSlot }, bookingDate);
        break;
      case "home_service":
        result = await bookHomeService(input, service, bookingDate);
        break;
      default:
        return bookingError("UNKNOWN_SERVICE_TYPE", "Noma'lum xizmat turi", 400);
    }

    if (result.success) {
      // Link appointment to user (background — bron bloklanmaydi)
      linkUserToAppointment(result.data.id, input.patientPhone).catch(() => {});

      // Webapp bronlar uchun Telegram notification (bot bronlarda bot o'zi yuboradi)
      if (input.source !== "bot") {
        notifyPatientAsync(result.data, input.patientPhone);
      }

      // tibId: userId dan yoki phone dan topib, yo'q bo'lsa yangi beradi
      const tibId = await resolveTibId(input);
      return { success: true, data: result.data, tibId };
    }

    return result;
  } catch (err) {
    logger.error("Booking failed", { error: String(err), input });
    return bookingError("SERVER_ERROR", "Server xatosi", 500);
  }
}

// tibId ni kafolatli qaytaradi: userId → phone → assign
async function resolveTibId(input: BookingInput): Promise<string | null> {
  try {
    if (input.userId) {
      const u = await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true, tibId: true } });
      if (u) return u.tibId ?? await assignTibId(u.id);
    }
    const phone = normalizePhone(input.patientPhone);
    const u = await prisma.user.findFirst({ where: { phone }, select: { id: true, tibId: true } });
    if (!u) return null;
    return u.tibId ?? await assignTibId(u.id);
  } catch {
    return null;
  }
}

// User phone orqali topib appointmentga userId bog'laydi
async function linkUserToAppointment(appointmentId: string, phone: string): Promise<void> {
  const user = await prisma.user.findFirst({
    where: { phone: normalizePhone(phone) },
    select: { id: true },
  });
  if (!user) return;
  await prisma.appointment.update({ where: { id: appointmentId }, data: { userId: user.id } });
}

// Fire-and-forget: bronni buzmasin, faqat try/catch ichida ishlaydi
async function notifyPatientAsync(
  appt: AppointmentWithRelations,
  patientPhone: string
): Promise<void> {
  try {
    // User phone orqali topish → telegramId + tibId olish
    const user = await prisma.user.findFirst({
      where: { phone: normalizePhone(patientPhone) },
      select: { telegramId: true, tibId: true },
    });
    if (!user?.telegramId) return;

    const tibId = user.tibId ?? (await getTibIdByPhone(patientPhone));
    const doctorName = appt.doctor
      ? `${appt.doctor.firstName} ${appt.doctor.lastName}`
      : undefined;
    const slotTime = appt.slot
      ? `${appt.slot.startTime} — ${appt.slot.endTime}`
      : undefined;

    const msg = buildConfirmationMessage({
      patientName: appt.patientName,
      date: appt.date.toISOString().split("T")[0],
      doctorName,
      queueNumber: appt.queueNumber,
      slotTime,
      serviceName: appt.service?.name,
      tibId,
    });

    await sendTelegramConfirmation(user.telegramId, msg);
  } catch {
    // Notification xatosi bronni ta'sirlamasin
  }
}
