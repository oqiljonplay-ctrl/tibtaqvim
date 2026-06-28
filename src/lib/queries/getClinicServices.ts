import { prisma } from "@/lib/prisma";
import { getDateRange } from "@/lib/utils/date";

export interface GetClinicServicesArgs {
  clinicId: string;
  branchId?: string | null;
  type?: string | null;
  date?: string | null;
}

export interface GetClinicServicesResult {
  data: any[];
  enableWebapp: boolean;
}

export async function getClinicServices({
  clinicId,
  branchId,
  type,
  date,
}: GetClinicServicesArgs): Promise<GetClinicServicesResult> {
  // clinicSettings — to'liq qator, bitta so'rov (showRatingCount + enableWebapp)
  const clinicSettingsRow = await prisma.clinicSettings.findUnique({ where: { clinicId } });
  const showRatingCount = clinicSettingsRow?.showRatingCount ?? false;
  const enableWebapp = clinicSettingsRow?.enableWebapp ?? true;

  const rawServices = await prisma.service.findMany({
    where: {
      clinicId,
      isActive: true,
      isHidden: false,
      ...(type ? { type: type as any } : {}),
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

  // Kaskad: doctor_queue xizmatida 0 ta ko'rinadigan shifokor qolsa — xizmat chiqarilmaydi
  const DOCTOR_SELECT_TYPES = ["doctor_queue"];
  const services = rawServices.filter(
    (s) => !DOCTOR_SELECT_TYPES.includes(s.type) || s.doctors.length > 0
  );

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

  if (!date) {
    return {
      data: services.map((s) => formatService(s)),
      enableWebapp,
    };
  }

  const dateRange = getDateRange(date);

  // N+1 → groupBy: 10 ta alohida COUNT o'rniga bitta so'rov
  const serviceIds = services.map((s) => s.id);
  const countRows = await prisma.appointment.groupBy({
    by: ["serviceId"],
    where: {
      serviceId: { in: serviceIds },
      date: dateRange,
      status: { not: "cancelled" },
    },
    _count: { _all: true },
  });
  const countMap = new Map(countRows.map((r) => [r.serviceId, r._count._all]));

  const data = services.map((s) => {
    const todayCount = countMap.get(s.id) ?? 0;
    return formatService(s, {
      todayCount,
      isAvailable: s.dailyLimit === null || todayCount < s.dailyLimit,
    });
  });

  return { data, enableWebapp };
}
