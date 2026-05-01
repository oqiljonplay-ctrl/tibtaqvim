import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, error, notFound } from "@/lib/api-response";
import { getDateRange } from "@/lib/utils/date";

// GET /api/services?clinicId=xxx&type=doctor_queue&date=2024-01-01
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clinicId = searchParams.get("clinicId");
    const type = searchParams.get("type") as string | null;
    const dateParam = searchParams.get("date");

    if (!clinicId) return error("clinicId is required");

    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId, isActive: true } });
    if (!clinic) return notFound("Clinic not found");

    const services = await prisma.service.findMany({
      where: {
        clinicId,
        isActive: true,
        ...(type ? { type: type as any } : {}),
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    const settings = await prisma.clinicSettings.findUnique({ where: { clinicId } });
    const enableWebapp = settings?.enableWebapp ?? true;

    if (!dateParam) {
      return new Response(
        JSON.stringify({ success: true, data: services, enableWebapp }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const dateRange = getDateRange(dateParam);

    const enriched = await Promise.all(
      services.map(async (s) => {
        const todayCount = await prisma.appointment.count({
          where: {
            serviceId: s.id,
            date: dateRange,
            status: { not: "cancelled" },
          },
        });

        return {
          ...s,
          price: Number(s.price),
          todayCount,
          isAvailable: s.dailyLimit === null || todayCount < s.dailyLimit,
        };
      })
    );

    return new Response(
      JSON.stringify({ success: true, data: enriched, enableWebapp }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch {
    return error("Server error", 500);
  }
}
