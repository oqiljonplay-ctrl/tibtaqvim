import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, error } from "@/lib/api-response";

// POST /api/webapp/cancel
// { appointmentId, telegramId }
// Security: patientPhone === user.phone YOKI appointment.userId === user.id
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { appointmentId, telegramId } = body;

    if (!appointmentId || !telegramId) {
      return error("appointmentId va telegramId majburiy");
    }

    const user = await prisma.user.findUnique({
      where: { telegramId: String(telegramId) },
      select: { id: true, phone: true },
    });

    if (!user) return error("Foydalanuvchi topilmadi", 404);

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { id: true, status: true, patientPhone: true, userId: true },
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
      data: { status: "cancelled" },
    });

    return ok({ cancelled: true });
  } catch {
    return error("Server error", 500);
  }
}
