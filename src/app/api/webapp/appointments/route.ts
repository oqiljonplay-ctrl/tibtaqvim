import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, error } from "@/lib/api-response";

const DEFAULT_CLINIC_ID = process.env.DEFAULT_CLINIC_ID || "";

// GET /api/webapp/appointments?telegramId=...&clinicId=...
// JWT yo'q — telegramId orqali autentifikatsiya.
// Phone bo'lmagan users uchun ham userId orqali qidiradi.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const telegramId = searchParams.get("telegramId");
  const clinicId = searchParams.get("clinicId") || DEFAULT_CLINIC_ID;

  if (!telegramId) return error("telegramId majburiy");
  if (!clinicId) return error("clinicId topilmadi");

  try {
    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: { id: true, phone: true },
    });

    if (!user) return ok([]);

    // Search by patientPhone (for old appointments) OR userId (for new linked ones)
    const phoneFilter = user.phone ? { patientPhone: user.phone } : null;
    const userIdFilter = { userId: user.id };

    const where = phoneFilter
      ? { clinicId, OR: [phoneFilter, userIdFilter] }
      : { clinicId, ...userIdFilter };

    const appointments = await prisma.appointment.findMany({
      where,
      orderBy: { date: "desc" },
      take: 30,
      select: {
        id: true,
        date: true,
        status: true,
        queueNumber: true,
        patientName: true,
        serviceId: true,
        service: { select: { name: true, type: true } },
        slot: { select: { startTime: true, endTime: true } },
      },
    });

    return ok(appointments);
  } catch {
    return error("Server error", 500);
  }
}
