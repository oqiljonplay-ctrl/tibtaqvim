import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, error } from "@/lib/api-response";
import { resolveWebappTelegramId } from "@/lib/telegram/webapp-auth";

const DEFAULT_CLINIC_ID = process.env.DEFAULT_CLINIC_ID || "";

// GET /api/webapp/appointments?telegramId=...&clinicId=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawTelegramId = searchParams.get("telegramId");
  const clinicId = searchParams.get("clinicId") || DEFAULT_CLINIC_ID;

  const auth = resolveWebappTelegramId(req, rawTelegramId);
  if (!auth) return error("Autentifikatsiya talab qilinadi", 401);
  const { telegramId } = auth;

  if (!clinicId) return error("clinicId topilmadi");

  try {
    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: { id: true, phone: true },
    });

    if (!user) return ok([]);

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
        dependentId: true,
        queueNumber: true,
        queueMode: true,
        paymentStatus: true,
        patientName: true,
        serviceId: true,
        service: { select: { name: true, type: true } },
        slot: { select: { startTime: true, endTime: true } },
        doctor: {
          select: {
            id: true, firstName: true, lastName: true,
            specialty: true, photoUrl: true,
            education: true, position: true, department: true,
            workSchedule: true, operationsCount: true, bio: true,
            specialties: { select: { name: true }, orderBy: { sortOrder: "asc" } },
            directions:  { select: { name: true }, orderBy: { sortOrder: "asc" } },
            experiences: { select: { place: true, startYear: true, endYear: true }, orderBy: { sortOrder: "asc" } },
            workplaces:  { select: { place: true }, orderBy: { sortOrder: "asc" } },
          },
        },
      },
    });

    return ok(appointments);
  } catch {
    return error("Server error", 500);
  }
}
