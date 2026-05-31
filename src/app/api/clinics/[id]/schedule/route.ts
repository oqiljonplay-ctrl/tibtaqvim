import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, notFound } from "@/lib/api-response";

export const dynamic = "force-dynamic";

/**
 * GET /api/clinics/[id]/schedule
 * Public — faqat klinika ish rejimi (is24Hours + holidays).
 * Ichki sozlamalar (dailyLimit, enableBot, ...) ochilmaydi.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const settings = await prisma.clinicSettings.findUnique({
    where: { clinicId: params.id },
    select: { is24Hours: true, holidays: true },
  });

  if (!settings) return notFound("Klinika sozlamalari topilmadi");

  const holidays = Array.isArray(settings.holidays)
    ? (settings.holidays as string[])
    : [];

  return ok({ is24Hours: settings.is24Hours, holidays });
}
