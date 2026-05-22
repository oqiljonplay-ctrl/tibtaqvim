import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, error, unauthorized, forbidden } from "@/lib/api-response";
import { getTodayInTZ, getTodayRange } from "@/lib/utils/date";
import { getBranchScope } from "@/lib/branch-scope";

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (!["super_admin", "clinic_admin", "branch_admin"].includes(auth.role)) return forbidden();

    const explicitClinicId = new URL(req.url).searchParams.get("clinicId");
    const scope = getBranchScope(auth, explicitClinicId);

    const todayStr = getTodayInTZ();
    const { gte: todayStart, lte: todayEnd } = getTodayRange();
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
      prisma.appointment.count({ where: { ...scope } }),
      prisma.appointment.count({ where: { ...scope, ...todayFilter } }),
      prisma.appointment.count({ where: { ...scope, ...todayFilter, status: "arrived" } }),
      prisma.appointment.count({ where: { ...scope, ...todayFilter, status: "missed" } }),
      prisma.doctor.count({ where: { ...scope, isActive: true } }),
      prisma.service.count({ where: { ...scope, isActive: true } }),
      prisma.appointment.findMany({
        where: { ...scope },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          service: { select: { name: true, type: true } },
          doctor: { select: { firstName: true, lastName: true } },
          user: { select: { telegramId: true } },
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
