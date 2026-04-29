import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, unauthorized, forbidden } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const user = requireAuth(req);
  if (!user) return unauthorized();
  if (user.role !== "super_admin") return forbidden();

  const [
    totalClinics,
    activeClinics,
    totalAppointments,
    todayAppointments,
    totalUsers,
    totalDoctors,
  ] = await Promise.all([
    prisma.clinic.count({ where: { deletedAt: null } }),
    prisma.clinic.count({ where: { isActive: true, deletedAt: null } }),
    prisma.appointment.count(),
    prisma.appointment.count({
      where: { date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    }),
    prisma.user.count({ where: { role: "patient" } }),
    prisma.doctor.count({ where: { isActive: true } }),
  ]);

  const clinicList = await prisma.clinic.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      isActive: true,
      createdAt: true,
      _count: { select: { branches: true, doctors: true, appointments: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const recentAudit = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  return ok({
    totalClinics,
    activeClinics,
    totalAppointments,
    todayAppointments,
    totalUsers,
    totalDoctors,
    clinicList,
    recentAudit,
  });
}
