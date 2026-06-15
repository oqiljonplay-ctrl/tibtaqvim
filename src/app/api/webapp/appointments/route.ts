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

    // clinic_settings va ratingEditWindow — bitta marta o'qiladi
    const [clinicSettingsRow, editWindowRow] = await Promise.all([
      prisma.clinicSettings.findUnique({
        where: { clinicId },
        select: { showRatingCount: true },
      }),
      prisma.globalSetting.findUnique({ where: { key: "ratingEditWindow" } }),
    ]);
    const showRatingCount = clinicSettingsRow?.showRatingCount ?? false;
    const editWindow = editWindowRow?.value as { enabled?: boolean; hours?: number } | null;

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
        clinicId: true,
        date: true,
        status: true,
        dependentId: true,
        queueNumber: true,
        queueMode: true,
        paymentStatus: true,
        patientName: true,
        serviceId: true,
        userId: true,
        service: { select: { name: true, type: true } },
        slot: { select: { startTime: true, endTime: true } },
        doctor: {
          select: {
            id: true, firstName: true, lastName: true,
            specialty: true, photoUrl: true, workSchedule: true,
            employee: { select: { compositeRating: true, ratingCount: true, photoUrl: true, firstName: true, lastName: true, specialty: true } },
          },
        },
        rating: { select: { id: true, stars: true, createdAt: true } },
      },
    });

    const mapped = appointments.map((a) => ({
      id: a.id,
      clinicId: a.clinicId,
      date: a.date,
      status: a.status,
      dependentId: a.dependentId,
      queueNumber: a.queueNumber,
      queueMode: a.queueMode,
      paymentStatus: a.paymentStatus,
      patientName: a.patientName,
      serviceId: a.serviceId,
      service: a.service,
      slot: a.slot,
      doctor: a.doctor ? {
        id: a.doctor.id,
        firstName: a.doctor.employee?.firstName ?? a.doctor.firstName,
        lastName: a.doctor.employee?.lastName ?? a.doctor.lastName,
        specialty: a.doctor.employee?.specialty ?? a.doctor.specialty,
        photoUrl: a.doctor.employee?.photoUrl ?? a.doctor.photoUrl,
        workSchedule: a.doctor.workSchedule,
      } : null,
      doctorRating: a.doctor?.employee?.compositeRating != null
        ? Number(a.doctor.employee.compositeRating)
        : null,
      doctorRatingCount: showRatingCount && a.doctor?.employee
        ? a.doctor.employee.ratingCount
        : null,
      myStars: a.rating ? Number(a.rating.stars) : null,
      myRatingId: a.rating?.id ?? null,
      canRate: a.status === "arrived" && !a.rating && !!a.userId,
      canEditRating: !!(a.rating && editWindow?.enabled === true
        && (Date.now() - new Date(a.rating.createdAt).getTime()) < (editWindow.hours ?? 24) * 3_600_000),
    }));

    return ok(mapped);
  } catch {
    return error("Server error", 500);
  }
}
