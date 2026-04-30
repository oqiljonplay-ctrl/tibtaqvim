import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, error } from "@/lib/api-response";

// GET /api/webapp/appointments?telegramId=...&clinicId=...
// Authenticated via telegramId — no JWT needed (WebApp context)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const telegramId = searchParams.get("telegramId");
  const clinicId = searchParams.get("clinicId");

  if (!telegramId) return error("telegramId majburiy");
  if (!clinicId) return error("clinicId majburiy");

  try {
    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: { phone: true },
    });

    if (!user?.phone) return ok([]);

    const appointments = await prisma.appointment.findMany({
      where: { clinicId, patientPhone: user.phone },
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
