import { NextRequest } from "next/server";
import { ok, error } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

// GET /api/webapp/booking-limits?clinicId=...&telegramId=...
// Klinika limit sozlamalari + bemorning haqiqiy faol bron sonini qaytaradi
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clinicId = searchParams.get("clinicId");
  const telegramId = searchParams.get("telegramId");

  if (!clinicId) return error("clinicId majburiy");

  const [settings, user] = await Promise.all([
    prisma.clinicSettings.findUnique({
      where: { clinicId },
      select: { patientSelfLimit: true, dependentBookingLimit: true, maxDependents: true },
    }),
    telegramId
      ? prisma.user.findUnique({ where: { telegramId }, select: { id: true } })
      : Promise.resolve(null),
  ]);

  const limits = settings ?? { patientSelfLimit: 4, dependentBookingLimit: 1, maxDependents: 2 };

  // Haqiqiy faol bron soni DBdan (take:30 cheklovsiz)
  let selfActiveCount = 0;
  if (user?.id) {
    selfActiveCount = await prisma.appointment.count({
      where: {
        userId: user.id,
        clinicId,
        status: "booked",
        dependentId: null,
      },
    });
  }

  return ok({ ...limits, selfActiveCount });
}
