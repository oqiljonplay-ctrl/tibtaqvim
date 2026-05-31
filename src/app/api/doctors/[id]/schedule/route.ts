import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, notFound } from "@/lib/api-response";

export const dynamic = "force-dynamic";

/**
 * GET /api/doctors/[id]/schedule
 * Public — shifokorning bloklangan kunlari (bir martalik + takroriy).
 * Web va bot ikkalasi shu endpointdan oladi (sinxron kafolati).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const doctor = await prisma.doctor.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!doctor) return notFound("Shifokor topilmadi");

  const blocks = await prisma.doctorBlockedDate.findMany({
    where: { doctorId: params.id },
    select: { type: true, weekday: true, date: true },
  });

  const blockedDates = blocks
    .filter((b) => b.type === "once" && b.date)
    .map((b) => b.date!);

  const blockedWeekdays = [
    ...new Set(
      blocks
        .filter((b) => b.type === "recurring" && b.weekday != null)
        .map((b) => b.weekday!)
    ),
  ];

  return ok({ blockedDates, blockedWeekdays });
}
