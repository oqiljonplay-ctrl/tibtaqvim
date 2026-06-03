import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { Prisma } from "@prisma/client";
import type { BookingInput } from "@/lib/validators/booking";
import { getTibIdByPhone, assignTibId } from "@/lib/services/tib-id.service";
import { buildConfirmationMessage, sendTelegramConfirmation } from "@/lib/services/confirmation.service";
import { normalizePhone } from "@/lib/utils/phone";
import { ensureUserClinic } from "@/lib/user-clinics";

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
async function bookDoctorQueue(
  input: BookingInput,
  service: { dailyLimit: number | null; requiresPrePayment: boolean; branchId: string | null },
  bookingDate: Date,
  queueMode: "live" | "online" | "slot"
): Promise<BookingResult> {
  if (queueMode === "slot") {
    return bookingError("SLOT_MODE_DISABLED", "Aniq vaqt sloti hali ishga tushmagan", 400);
  }

  try {
    const appt = await prisma.$transaction(async (tx) => {
      // Advisory lock: bir xil (serviceId+date) uchun barcha so'rovlar ketma-ket bajariladi.
      // Bu duplicate check TOCTOU va queueNumber TOCTOU ikkalasini ham yopadi.
      // Lock transaksiya tugaganda (commit/rollback) avtomatik ozod bo'ladi.
      const lockKey = `${input.serviceId}:${bookingDate.toISOString().slice(0, 10)}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

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

      // Cross-doctor dublikat: bir telefon + shifokor + kun = 1 bron
      if (input.doctorId) {
        const doctorDuplicate = await tx.appointment.findFirst({
          where: {
            patientPhone: normalizePhone(input.patientPhone),
            doctorId: input.doctorId,
            date: bookingDate,
            status: { in: ["booked", "arrived"] },
          },
          select: { id: true, queueNumber: true, status: true },
        });
        if (doctorDuplicate) {
          throw {
            code: "DOCTOR_DUPLICATE",
            message: `Bu shifokorga shu sanada bron allaqachon mavjud (#${doctorDuplicate.queueNumber ?? "—"})`,
          };
        }
      }

      let queueNumber: number | null = null;
      let paymentStatus = "not_required";

      if (queueMode === "online") {
        const last = await tx.appointment.findFirst({
          where: { serviceId: input.serviceId, date: bookingDate, status: { not: "cancelled" } },
          orderBy: { queueNumber: "desc" },
        });
        queueNumber = (last?.queueNumber ?? 0) + 1;
        paymentStatus = "pending";
      } else {
        // live — kassada queueNumber beriladi
        queueNumber = null;
        paymentStatus = "pending";
      }

      return tx.appointment.create({
        data: {
          clinicId: input.clinicId,
          branchId: service.branchId ?? null,
          serviceId: input.serviceId,
          doctorId: input.doctorId ?? null,
          userId: input.userId ?? null,
          dependentId: input.dependentId ?? null,
          slotId: null,
          date: bookingDate,
          patientName: input.patientName.trim(),
          patientPhone: normalizePhone(input.patientPhone),
          address: null,
          queueNumber,
          queueMode,
          paymentStatus,
          status: "booked",
        },
        include: {
          service: { select: { name: true, type: true, price: true } },
          doctor: { select: { firstName: true, lastName: true, specialty: true } },
          slot: { select: { startTime: true, endTime: true } },
        },
      });
    });

    logger.info("DoctorQueue booked", { appointmentId: appt.id, queueNumber: appt.queueNumber, queueMode });
    return { success: true, data: appt, tibId: null };
  } catch (err: any) {
    if (err?.code === "LIMIT_REACHED") return bookingError("LIMIT_REACHED", err.message, 409);
    if (err?.code === "DUPLICATE_BOOKING") return bookingError("DUPLICATE_BOOKING", err.message, 409);
    if (err?.code === "DOCTOR_DUPLICATE") return bookingError("DOCTOR_DUPLICATE", err.message, 409);
    throw err;
  }
}

// ─── Diagnostic ───────────────────────────────────────────────────────────────
async function bookDiagnostic(input: BookingInput, service: { dailyLimit: number | null; requiresSlot: boolean; branchId: string | null }, bookingDate: Date): Promise<BookingResult> {
  if (service.requiresSlot && !input.slotId) {
    return bookingError("SLOT_REQUIRED", "Bu xizmat uchun uyacha tanlash majburiy", 400);
  }

  try {
    const appt = await prisma.$transaction(async (tx) => {
      // Slot va umumiy diagnostic uchun atomic lock (capacity TOCTOU oldini olish)
      const diagLockKey = input.slotId
        ? `slot:${input.slotId}`
        : `${input.serviceId}:${bookingDate.toISOString().slice(0, 10)}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${diagLockKey}))`;

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
          branchId: service.branchId ?? null,
          serviceId: input.serviceId,
          doctorId: input.doctorId ?? null,
          userId: input.userId ?? null,
          dependentId: input.dependentId ?? null,
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
async function bookHomeService(input: BookingInput, service: { dailyLimit: number | null; branchId: string | null }, bookingDate: Date): Promise<BookingResult> {
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
          branchId: service.branchId ?? null,
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
  // Smart fill: userId yoki dependentId orqali ism/telefon avtomatik to'ldirish
  if (input.userId && input.dependentId) {
    const dep = await prisma.dependent.findFirst({
      where: { id: input.dependentId, userId: input.userId, deletedAt: null },
      select: { firstName: true, lastName: true, phone: true },
    });
    if (!dep) return bookingError("DEPENDENT_NOT_FOUND", "Qaramog'idagi topilmadi", 400);
    input.patientName = [dep.firstName, dep.lastName].filter(Boolean).join(" ");
    if (!input.patientPhone) {
      if (dep.phone) {
        input.patientPhone = dep.phone;
      } else {
        const user = await prisma.user.findUnique({ where: { id: input.userId }, select: { phone: true } });
        input.patientPhone = user?.phone ?? "";
      }
    }
  } else if (input.userId && !input.patientName) {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { firstName: true, lastName: true, phone: true },
    });
    if (user) {
      input.patientName = input.patientName || [user.firstName, user.lastName].filter(Boolean).join(" ");
      input.patientPhone = input.patientPhone || user.phone || "";
    }
  }

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
  const bookingDate = new Date(input.date + "T00:00:00.000Z");

  // Klinika + shifokor blok tekshiruvi — $transaction dan tashqarida (sana o'zgarmas)
  const { isDateBlockedFull } = await import("@/lib/day-block");
  const blockCheck = await isDateBlockedFull(input.clinicId, input.doctorId, input.date);
  if (blockCheck.blocked) {
    const code = blockCheck.source === "doctor" ? "DOCTOR_BLOCKED" : "DATE_BLOCKED";
    return bookingError(code, blockCheck.reason ?? "Bu kunda qabul amalga oshirilmaydi", 409);
  }

  // ── Bemor/Dependent limit tekshiruvi ──────────────────────────────────────
  if (input.userId) {
    const settings = await prisma.clinicSettings.findUnique({
      where: { clinicId: input.clinicId },
      select: { patientSelfLimit: true, dependentBookingLimit: true },
    });
    const selfLimit = settings?.patientSelfLimit ?? 4;
    const depLimit = settings?.dependentBookingLimit ?? 1;

    if (input.dependentId) {
      if (depLimit === 0) {
        return bookingError("DEPENDENT_BOOKING_DISABLED", "Qaramog'idagilar uchun bron qilish o'chirilgan", 403);
      }
      const depCount = await prisma.appointment.count({
        where: { dependentId: input.dependentId, clinicId: input.clinicId, status: "booked" },
      });
      if (depCount >= depLimit) {
        return bookingError(
          "DEPENDENT_LIMIT_REACHED",
          `Qaramog'idagi uchun faol bronlar limiti to'ldi (${depCount}/${depLimit})`,
          409,
        );
      }
    } else {
      const selfCount = await prisma.appointment.count({
        where: { userId: input.userId, dependentId: null, clinicId: input.clinicId, status: "booked" },
      });
      if (selfCount >= selfLimit) {
        return bookingError(
          "PATIENT_LIMIT_REACHED",
          `Faol bronlar limiti to'ldi (${selfCount}/${selfLimit}). Avval biron bronni bekor qiling yoki shifokor tasdig'ini kuting.`,
          409,
        );
      }
    }

    // Bir shifokorga faqat bitta faol bron (butun kalendar)
    if (input.doctorId) {
      const subjectDepId = input.dependentId ?? null;
      const existingForDoctor = await prisma.appointment.findFirst({
        where: {
          userId: input.userId,
          dependentId: subjectDepId,
          clinicId: input.clinicId,
          doctorId: input.doctorId,
          status: "booked",
        },
        select: { id: true, date: true },
      });
      if (existingForDoctor) {
        return bookingError(
          "DOCTOR_ALREADY_BOOKED",
          "Bu shifokorga allaqachon faol bron mavjud. Avval uni bekor qiling yoki kutib turing.",
          409,
        );
      }
    }
  }

  // queueMode: serviceDoctor binding → service default → 'online'
  const serviceDoctor = input.doctorId
    ? await prisma.serviceDoctor.findUnique({
        where: { serviceId_doctorId: { serviceId: input.serviceId, doctorId: input.doctorId } },
      })
    : null;
  const queueMode = (serviceDoctor?.queueMode ?? service.defaultQueueMode) as "live" | "online" | "slot";

  try {
    let result: BookingResult;
    switch (service.type) {
      case "doctor_queue":
        result = await bookDoctorQueue(
          input,
          { dailyLimit: service.dailyLimit, requiresPrePayment: service.requiresPrePayment, branchId: service.branchId ?? null },
          bookingDate,
          queueMode
        );
        break;
      case "diagnostic":
        result = await bookDiagnostic(input, { dailyLimit: service.dailyLimit, requiresSlot: service.requiresSlot, branchId: service.branchId ?? null }, bookingDate);
        break;
      case "home_service":
        result = await bookHomeService(input, service, bookingDate);
        break;
      default:
        return bookingError("UNKNOWN_SERVICE_TYPE", "Noma'lum xizmat turi", 400);
    }

    if (result.success) {
      linkUserToAppointment(result.data.id, input.patientPhone, input.patientName).catch(() => {});

      if (input.source !== "bot") {
        notifyPatientAsync(result.data, input.patientPhone);
      }

      const tibId = await resolveTibId(input);
      return { success: true, data: result.data, tibId };
    }

    return result;
  } catch (err) {
    logger.error("Booking failed", { error: String(err), input });
    return bookingError("SERVER_ERROR", "Server xatosi", 500);
  }
}

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

async function linkUserToAppointment(
  appointmentId: string,
  phone: string,
  patientName?: string,
): Promise<void> {
  const normalized = normalizePhone(phone);
  if (!normalized) return;

  const user = await prisma.user.upsert({
    where: { phone: normalized },
    create: { phone: normalized, firstName: patientName?.trim() || 'Bemor', role: 'patient' },
    update: {},
    select: { id: true },
  });

  const appt = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { userId: user.id },
    select: { clinicId: true },
  });

  ensureUserClinic(user.id, appt.clinicId, 'patient').catch((e) => {
    logger.error('[linkUserToAppointment] ensureUserClinic failed', {
      userId: user.id,
      clinicId: appt.clinicId,
      error: String(e),
    });
  });
}

async function notifyPatientAsync(
  appt: AppointmentWithRelations,
  patientPhone: string
): Promise<void> {
  try {
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
    const queueMode = (appt as any).queueMode as "live" | "online" | undefined;

    const msg = buildConfirmationMessage({
      patientName: appt.patientName,
      date: appt.date.toISOString().split("T")[0],
      doctorName,
      queueNumber: appt.queueNumber,
      slotTime,
      serviceName: appt.service?.name,
      tibId,
      queueMode,
    });

    await sendTelegramConfirmation(user.telegramId, msg);
  } catch {
    // Notification xatosi bronni ta'sirlamasin
  }
}
