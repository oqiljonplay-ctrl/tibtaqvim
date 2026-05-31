import { NextRequest } from "next/server";
import { ok, error } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

// GET /api/webapp/booking-limits?clinicId=...
// Bemor webapp'ga klinika limit sozlamalarini beradi (faqat o'qish)
export async function GET(req: NextRequest) {
  const clinicId = new URL(req.url).searchParams.get("clinicId");
  if (!clinicId) return error("clinicId majburiy");

  const settings = await prisma.clinicSettings.findUnique({
    where: { clinicId },
    select: { patientSelfLimit: true, dependentBookingLimit: true, maxDependents: true },
  });

  return ok(settings ?? { patientSelfLimit: 4, dependentBookingLimit: 1, maxDependents: 2 });
}
