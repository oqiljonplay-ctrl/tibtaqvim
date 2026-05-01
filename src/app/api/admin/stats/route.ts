import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, error, unauthorized, forbidden } from "@/lib/api-response";
import { getTodayInTZ, getTodayRange } from "@/lib/utils/date";

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (!["super_admin", "clinic_admin"].includes(auth.role)) return forbidden();

    const clinicId = auth.role === "super_admin"
      ? new URL(req.url).searchParams.get("clinicId") || undefined
      : auth.clinicId!;

    // Today in Tashkent timezone — avoids UTC/local date mismatch
    const todayStr = getTodayInTZ();
    const { gte: todayStart, lte: todayEnd } = getTodayRange();

    const clinicFilter = clinicId ? { clinicId } : {};
    const todayFilter = { date: { gte: todayStart, lte: todayEnd } };

    const [
      totalAppointments,
      todayAppointments,
      arrivedToday,
      missedToday,
      totalDoctors,
      totalServices,
      recentAppointments,
    ] = await Promise.all([
      prisma.appointment.count({ where: { ...clinicFilter } }),
      prisma.appointment.count({ where: { ...clinicFilter, ...todayFilter } }),
      prisma.appointment.count({ where: { ...clinicFilter, ...todayFilter, status: "arrived" } }),
      prisma.appointment.count({ where: { ...clinicFilter, ...todayFilter, status: "missed" } }),
      prisma.doctor.count({ where: { ...clinicFilter, isActive: true } }),
      prisma.service.count({ where: { ...clinicFilter, isActive: true } }),
      prisma.appointment.findMany({
        where: { ...clinicFilter },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          service: { select: { name: true, type: true } },
          doctor: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);

    return ok({
      totalAppointments,
      todayAppointments,
      arrivedToday,
      missedToday,
      pendingToday: todayAppointments - arrivedToday - missedToday,
      totalDoctors,
      totalServices,
      recentAppointments,
      todayDate: todayStr,
    });
  } catch {
    return error("Server error", 500);
  }
}
