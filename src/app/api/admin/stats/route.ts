import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, error, unauthorized, forbidden } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (!["super_admin", "clinic_admin"].includes(auth.role)) return forbidden();

    const clinicId = auth.role === "super_admin"
      ? new URL(req.url).searchParams.get("clinicId") || undefined
      : auth.clinicId!;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalAppointments,
      todayAppointments,
      arrivedToday,
      missedToday,
      totalDoctors,
      totalServices,
      recentAppointments,
    ] = await Promise.all([
      prisma.appointment.count({ where: { ...(clinicId ? { clinicId } : {}) } }),
      prisma.appointment.count({ where: { ...(clinicId ? { clinicId } : {}), date: today } }),
      prisma.appointment.count({ where: { ...(clinicId ? { clinicId } : {}), date: today, status: "arrived" } }),
      prisma.appointment.count({ where: { ...(clinicId ? { clinicId } : {}), date: today, status: "missed" } }),
      prisma.doctor.count({ where: { ...(clinicId ? { clinicId } : {}), isActive: true } }),
      prisma.service.count({ where: { ...(clinicId ? { clinicId } : {}), isActive: true } }),
      prisma.appointment.findMany({
        where: { ...(clinicId ? { clinicId } : {}), date: today },
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
    });
  } catch {
    return error("Server error", 500);
  }
}
