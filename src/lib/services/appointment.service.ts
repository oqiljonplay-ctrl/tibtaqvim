import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function updateAppointmentStatus(
  appointmentId: string,
  status: "arrived" | "missed",
  actorClinicId: string | null,
  actorRole: string
) {
  const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appt) return { success: false, error: "Qayd topilmadi", status: 404 };

  if (actorRole !== "super_admin" && appt.clinicId !== actorClinicId) {
    return { success: false, error: "Ruxsat yo'q", status: 403 };
  }

  if (!["booked", "arrived"].includes(appt.status)) {
    return { success: false, error: `Holat o'zgartirib bo'lmaydi: ${appt.status}`, status: 400 };
  }

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status },
    include: {
      service: { select: { name: true, type: true } },
      doctor: { select: { firstName: true, lastName: true } },
    },
  });

  logger.info("Appointment status updated", { appointmentId, status, actorRole });
  return { success: true, data: updated };
}

export async function getAppointments(filters: {
  clinicId: string;
  date?: string;
  doctorId?: string;
  status?: string;
  serviceId?: string;
  page?: number;
  limit?: number;
}) {
  const { clinicId, date, doctorId, status, serviceId, page = 1, limit = 50 } = filters;

  const where: Record<string, unknown> = {
    clinicId,
    ...(date ? { date: new Date(date) } : {}),
    ...(doctorId ? { doctorId } : {}),
    ...(status ? { status } : {}),
    ...(serviceId ? { serviceId } : {}),
  };

  const [total, items] = await Promise.all([
    prisma.appointment.count({ where }),
    prisma.appointment.findMany({
      where,
      orderBy: [{ date: "desc" }, { queueNumber: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        service: { select: { name: true, type: true } },
        doctor: { select: { firstName: true, lastName: true, specialty: true } },
        slot: { select: { startTime: true, endTime: true } },
        branch: { select: { name: true } },
      },
    }),
  ]);

  return { total, page, limit, items };
}
