import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { error, notFound } from "@/lib/api-response";
import { getDateRange } from "@/lib/utils/date";

// GET /api/services?clinicId=xxx&type=doctor_queue&date=2024-01-01
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clinicId = searchParams.get("clinicId");
    const branchId = searchParams.get("branchId");
    const type = searchParams.get("type") as string | null;
    const dateParam = searchParams.get("date");

    if (!clinicId) return error("clinicId is required");

    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId, isActive: true } });
    if (!clinic) return notFound("Clinic not found");

    // showRatingCount — bitta marta o'qiladi, barcha doctor mapping uchun ishlatiladi
    const clinicSettingsRow = await prisma.clinicSettings.findUnique({
      where: { clinicId },
      select: { showRatingCount: true },
    });
    const showRatingCount = clinicSettingsRow?.showRatingCount ?? false;

    const rawServices = await prisma.service.findMany({
      where: {
        clinicId,
        isActive: true,
        isHidden: false,
        ...(type ? { type: type as any } : {}),
        // branchId berilsa: FAQAT o'sha filialga bog'langan xizmatlar (null = ko'rsatilmaydi)
        ...(branchId ? { branchId } : {}),
      },
      include: {
        doctors: {
          where: { doctor: { isActive: true, isHidden: false } },
          include: {
            doctor: {
              select: {
                id: true, firstName: true, lastName: true, specialty: true, photoUrl: true,
                employee: {
                  select: {
                    compositeRating: true, ratingCount: true,
                    photoUrl: true, specialty: true,
                    firstName: true, lastName: true,
                  },
                },
              },
            },
          },
        },
        branch: { select: { id: true, name: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    // Kaskad: doctor_queue xizmatida 0 ta ko'rinadigan shifokor qolsa — xizmat chiqarilmaydi.
    // diagnostic va home_service shifokorsiz ham ko'rinadi.
    const DOCTOR_SELECT_TYPES = ["doctor_queue"];
    const services = rawServices.filter(
      (s) => !DOCTOR_SELECT_TYPES.includes(s.type) || s.doctors.length > 0
    );

    const settings = await prisma.clinicSettings.findUnique({ where: { clinicId } });
    const enableWebapp = settings?.enableWebapp ?? true;

    const formatService = (s: (typeof services)[0], extra: Record<string, unknown> = {}) => ({
      ...s,
      price: Number(s.price),
      prePaymentAmount: s.prePaymentAmount ? Number(s.prePaymentAmount) : null,
      defaultQueueMode: s.defaultQueueMode,
      branchName: s.branch?.name ?? "Bosh ofis",
      doctors: s.doctors
        .map((sd) => ({
          id: sd.doctor.id,
          firstName: sd.doctor.employee?.firstName ?? sd.doctor.firstName,
          lastName: sd.doctor.employee?.lastName ?? sd.doctor.lastName,
          specialty: sd.doctor.employee?.specialty ?? sd.doctor.specialty,
          photoUrl: sd.doctor.employee?.photoUrl ?? sd.doctor.photoUrl,
          queueMode: sd.queueMode,
          compositeRating: sd.doctor.employee?.compositeRating != null
            ? Number(sd.doctor.employee.compositeRating)
            : null,
          ratingCount: showRatingCount ? (sd.doctor.employee?.ratingCount ?? null) : null,
        }))
        .sort((a, b) => (b.compositeRating ?? -1) - (a.compositeRating ?? -1)),
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
