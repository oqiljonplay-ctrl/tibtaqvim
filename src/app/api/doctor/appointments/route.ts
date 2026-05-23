import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, error } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { getBranchScope } from "@/lib/branch-scope";

export const dynamic = "force-dynamic";

/**
 * GET /api/doctor/appointments?date=YYYY-MM-DD
 *
 * Shifokor uchun bronlar — FAQAT to'langan (paid/not_required).
 * Xizmat (service) bo'yicha guruhlangan — har xizmat alohida "orolcha".
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return error("Unauthorized", 401);

  const allowedRoles = ["doctor", "clinic_admin", "branch_admin", "super_admin"];
  if (!allowedRoles.includes(auth.role)) return error("Ruxsat yo'q", 403);

  try {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");
    const date = dateParam ? new Date(dateParam + "T00:00:00.000Z") : new Date(new Date().toLocaleDateString("sv-SE") + "T00:00:00.000Z");

    const scope = getBranchScope(auth);
    const where: any = {
      date,
      paymentStatus: { in: ["paid", "not_required"] },
      status: { not: "cancelled" },
    };
    if (scope.clinicId) where.clinicId = scope.clinicId;
    if (scope.branchId !== undefined) where.branchId = scope.branchId;

    // doctor role: faqat o'ziga biriktirilgan bronlar
    if (auth.role === "doctor") {
      const doctorRecord = await prisma.doctor.findFirst({
        where: { userId: auth.userId },
        select: { id: true },
      });
      if (!doctorRecord) {
        return ok({ date: dateParam ?? new Date().toLocaleDateString("sv-SE"), services: [], counts: { total: 0, services: 0, arrived: 0, waiting: 0, missed: 0 } });
      }
      where.doctorId = doctorRecord.id;
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        service: { select: { id: true, name: true, type: true } },
        doctor: { select: { id: true, firstName: true, lastName: true, specialty: true } },
      },
      orderBy: [{ queueNumber: "asc" }, { createdAt: "asc" }],
    });

    // Xizmat bo'yicha guruhlash
    const serviceMap = new Map<string, any>();
    for (const a of appointments) {
      const serviceId = a.service?.id ?? "unknown";
      if (!serviceMap.has(serviceId)) {
        serviceMap.set(serviceId, {
          serviceId,
          serviceName: a.service?.name ?? "Noma'lum xizmat",
          serviceType: a.service?.type ?? null,
          doctorName: a.doctor ? [a.doctor.lastName, a.doctor.firstName].filter(Boolean).join(" ") : null,
          specialty: a.doctor?.specialty ?? null,
          patients: [],
        });
      }
      serviceMap.get(serviceId).patients.push({
        id: a.id,
        patientName: a.patientName,
        patientPhone: a.patientPhone,
        queueNumber: a.queueNumber,
        status: a.status,
        paymentStatus: a.paymentStatus,
        notes: a.notes,
      });
    }

    const services = Array.from(serviceMap.values()).sort((x, y) =>
      x.serviceName.localeCompare(y.serviceName)
    );

    return ok({
      date: dateParam ?? new Date().toLocaleDateString("sv-SE"),
      services,
      counts: {
        total: appointments.length,
        services: services.length,
        arrived: appointments.filter((a) => a.status === "arrived").length,
        waiting: appointments.filter((a) => a.status === "booked").length,
        missed: appointments.filter((a) => a.status === "missed").length,
      },
    });
  } catch (err: any) {
    console.error("[GET /api/doctor/appointments]", err);
    return error("Server xatosi", 500);
  }
}
