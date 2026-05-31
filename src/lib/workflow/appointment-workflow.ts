import { prisma } from "@/lib/prisma";
import type { Appointment } from "@prisma/client";

export type PaymentStatus = "pending" | "paid" | "not_required" | "cancelled";
export type AppointmentStatus = "booked" | "arrived" | "missed" | "cancelled" | "expired";
export type PaymentSource = "reception" | "payme" | "click" | "cash" | "admin";

export interface WorkflowResult {
  success: boolean;
  appointment?: Appointment;
  error?: string;
}

// ── To'lov nazorati (Qabulxona) ────────────────────────────────────────────────

export async function markAsPaid(
  appointmentId: string,
  actorClinicId: string | null,
  source: PaymentSource = "reception"
): Promise<WorkflowResult> {
  try {
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { id: true, clinicId: true, paymentStatus: true, status: true },
    });
    if (!appt) return { success: false, error: "Bron topilmadi" };
    if (actorClinicId && appt.clinicId !== actorClinicId)
      return { success: false, error: "Bu bron boshqa klinikaga tegishli" };
    if (appt.status === "cancelled")
      return { success: false, error: "Bekor qilingan bron uchun to'lov belgilab bo'lmaydi" };
    if (appt.paymentStatus === "paid")
      return { success: false, error: "Bu bron allaqachon to'langan" };

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { paymentStatus: "paid" },
    });
    console.log(`[workflow] markAsPaid: ${appointmentId} by ${source}`);
    return { success: true, appointment: updated };
  } catch (err: any) {
    console.error("[workflow/markAsPaid]", err);
    return { success: false, error: err?.message || "Server xatosi" };
  }
}

export async function markAsUnpaid(
  appointmentId: string,
  actorClinicId: string | null
): Promise<WorkflowResult> {
  try {
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { id: true, clinicId: true, paymentStatus: true, status: true },
    });
    if (!appt) return { success: false, error: "Bron topilmadi" };
    if (actorClinicId && appt.clinicId !== actorClinicId)
      return { success: false, error: "Bu bron boshqa klinikaga tegishli" };
    if (appt.status === "cancelled")
      return { success: false, error: "Bekor qilingan bron" };

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { paymentStatus: "pending" },
    });
    return { success: true, appointment: updated };
  } catch (err: any) {
    console.error("[workflow/markAsUnpaid]", err);
    return { success: false, error: err?.message || "Server xatosi" };
  }
}

export async function cancelAppointment(
  appointmentId: string,
  actorClinicId: string | null
): Promise<WorkflowResult> {
  try {
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { id: true, clinicId: true, status: true },
    });
    if (!appt) return { success: false, error: "Bron topilmadi" };
    if (actorClinicId && appt.clinicId !== actorClinicId)
      return { success: false, error: "Bu bron boshqa klinikaga tegishli" };
    if (appt.status === "cancelled")
      return { success: false, error: "Bron allaqachon bekor qilingan" };

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: "cancelled", paymentStatus: "cancelled" },
    });
    return { success: true, appointment: updated };
  } catch (err: any) {
    console.error("[workflow/cancelAppointment]", err);
    return { success: false, error: err?.message || "Server xatosi" };
  }
}

// ── Muolaja nazorati (Shifokor) ────────────────────────────────────────────────

export async function markAsArrived(
  appointmentId: string,
  actorClinicId: string | null
): Promise<WorkflowResult> {
  try {
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { id: true, clinicId: true, status: true, paymentStatus: true },
    });
    if (!appt) return { success: false, error: "Bron topilmadi" };
    if (actorClinicId && appt.clinicId !== actorClinicId)
      return { success: false, error: "Bu bron boshqa klinikaga tegishli" };
    if (appt.status === "cancelled")
      return { success: false, error: "Bekor qilingan bron" };
    if (appt.paymentStatus !== "paid" && appt.paymentStatus !== "not_required")
      return { success: false, error: "To'lov tasdiqlanmagan — avval qabulxona to'lovni qabul qilishi kerak" };

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: "arrived" },
    });
    return { success: true, appointment: updated };
  } catch (err: any) {
    console.error("[workflow/markAsArrived]", err);
    return { success: false, error: err?.message || "Server xatosi" };
  }
}

export async function markAsMissed(
  appointmentId: string,
  actorClinicId: string | null
): Promise<WorkflowResult> {
  try {
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { id: true, clinicId: true, status: true, paymentStatus: true },
    });
    if (!appt) return { success: false, error: "Bron topilmadi" };
    if (actorClinicId && appt.clinicId !== actorClinicId)
      return { success: false, error: "Bu bron boshqa klinikaga tegishli" };
    if (appt.status === "cancelled")
      return { success: false, error: "Bekor qilingan bron" };
    if (appt.paymentStatus !== "paid" && appt.paymentStatus !== "not_required")
      return { success: false, error: "To'lov tasdiqlanmagan bron" };

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: "missed" },
    });
    return { success: true, appointment: updated };
  } catch (err: any) {
    console.error("[workflow/markAsMissed]", err);
    return { success: false, error: err?.message || "Server xatosi" };
  }
}

export async function resetToBooked(
  appointmentId: string,
  actorClinicId: string | null
): Promise<WorkflowResult> {
  try {
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { id: true, clinicId: true, status: true },
    });
    if (!appt) return { success: false, error: "Bron topilmadi" };
    if (actorClinicId && appt.clinicId !== actorClinicId)
      return { success: false, error: "Bu bron boshqa klinikaga tegishli" };
    if (appt.status === "cancelled")
      return { success: false, error: "Bekor qilingan bronni qaytarib bo'lmaydi" };

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: "booked" },
    });
    return { success: true, appointment: updated };
  } catch (err: any) {
    console.error("[workflow/resetToBooked]", err);
    return { success: false, error: err?.message || "Server xatosi" };
  }
}

// ── Avtomatik expiry (cron tomonidan chaqiriladi) ─────────────────────────────

export interface ExpireResult {
  expiredIds: string[];
  errors: number;
}

export async function expireBookings(beforeDateStr: string): Promise<ExpireResult> {
  // beforeDateStr = bugungi sana (Asia/Tashkent) "YYYY-MM-DD" formatida
  // appointments.date — @db.Date, UTC midnight sifatida saqlanadi
  // date < cutoff: bugungi sana < bugun 00:00 UTC → o'tgan kunlar
  const cutoff = new Date(beforeDateStr + "T00:00:00.000Z");

  // Avval ID'larni olib, keyin update — Telegram xabar uchun kerak
  const toExpire = await prisma.appointment.findMany({
    where: { status: "booked", date: { lt: cutoff } },
    select: { id: true },
  });

  if (toExpire.length === 0) return { expiredIds: [], errors: 0 };

  const ids = toExpire.map((a) => a.id);
  await prisma.appointment.updateMany({
    where: { id: { in: ids } },
    data: { status: "expired" },
  });

  return { expiredIds: ids, errors: 0 };
}
