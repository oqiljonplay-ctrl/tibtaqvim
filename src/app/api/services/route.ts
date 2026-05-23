import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { error, notFound } from "@/lib/api-response";
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
      include: {
        doctors: {
          where: { doctor: { isActive: true } },
          include: {
            doctor: {
              select: { id: true, firstName: true, lastName: true, specialty: true, photoUrl: true },
            },
          },
        },
        branch: { select: { id: true, name: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    const settings = await prisma.clinicSettings.findUnique({ where: { clinicId } });
    const enableWebapp = settings?.enableWebapp ?? true;

    const formatService = (s: (typeof services)[0], extra: Record<string, unknown> = {}) => ({
      ...s,
      price: Number(s.price),
      prePaymentAmount: s.prePaymentAmount ? Number(s.prePaymentAmount) : null,
      defaultQueueMode: s.defaultQueueMode,
      branchName: s.branch?.name ?? "Bosh ofis",
      doctors: s.doctors.map((sd) => ({
        ...sd.doctor,
        queueMode: sd.queueMode,
      })),
      ...extra,
    });

    if (!dateParam) {
      return new Response(
        JSON.stringify({ success: true, data: services.map((s) => formatService(s)), enableWebapp }),
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

        return formatService(s, {
          todayCount,
          isAvailable: s.dailyLimit === null || todayCount < s.dailyLimit,
        });
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
