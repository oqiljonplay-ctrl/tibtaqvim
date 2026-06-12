import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, error } from "@/lib/api-response";
import { resolveWebappTelegramId } from "@/lib/telegram/webapp-auth";

// POST /api/webapp/cancel
// { appointmentId, telegramId }
// Security: initData HMAC (log-only) + patientPhone === user.phone YOKI appointment.userId === user.id
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { appointmentId, telegramId: rawTelegramId } = body;

    if (!appointmentId) return error("appointmentId majburiy");

    const auth = resolveWebappTelegramId(req, rawTelegramId ? String(rawTelegramId) : null);
    if (!auth) return error("Autentifikatsiya talab qilinadi", 401);
    const { telegramId } = auth;

    const user = await prisma.user.findUnique({
      where: { telegramId: String(telegramId) },
      select: { id: true, phone: true },
    });

    if (!user) return error("Foydalanuvchi topilmadi", 404);

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { id: true, status: true, patientPhone: true, userId: true, clinicId: true },
    });

    if (!appointment) return error("Bron topilmadi", 404);

    // Allow cancel if phone matches OR appointment is linked to this user
    const ownsViaPhone = user.phone && appointment.patientPhone === user.phone;
    const ownsViaUserId = appointment.userId === user.id;
    if (!ownsViaPhone && !ownsViaUserId) return error("Ruxsat yo'q", 403);

    if (appointment.status !== "booked") {
      return error("Faqat kutilayotgan bronni bekor qilish mumkin");
    }

    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: "cancelled", cancelledBy: "patient" },
    });

    try {
      await prisma.auditLog.create({
        data: {
          actorId: user.id,
          action: "appointment.cancel",
          payload: {
            appointmentId,
            previousStatus: appointment.status,
            newStatus: "cancelled",
            source: "patient-webapp",
          },
          clinicId: appointment.clinicId,
        },
      });
    } catch {}

    return ok({ cancelled: true });
  } catch {
    return error("Server error", 500);
  }
}
