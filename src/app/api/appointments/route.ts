import { NextRequest } from "next/server";
import { getAppointments } from "@/lib/services/appointment.service";
import { requireAuth } from "@/lib/auth";
import { ok, error, unauthorized } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();

    const { searchParams } = new URL(req.url);
    const clinicId = (auth.role === "super_admin" ? searchParams.get("clinicId") : null) ?? auth.clinicId;

    if (!clinicId) return error("clinicId majburiy");

    // Doctor faqat o'z qabullarini ko'radi
    let doctorId = searchParams.get("doctorId") || undefined;
    let doctorIdIncludeNull = false;
    if (auth.role === "doctor") {
      const doc = await prisma.doctor.findFirst({ where: { userId: auth.userId } });
      if (doc) {
        doctorId = doc.id;
        // Include unassigned (null-doctorId) queue appointments so the panel
        // isn't empty when bookings were created without a specific doctor.
        doctorIdIncludeNull = true;
      }
    }

    const result = await getAppointments({
      clinicId,
      date: searchParams.get("date") || undefined,
      doctorId,
      doctorIdIncludeNull,
      status: searchParams.get("status") || undefined,
      serviceId: searchParams.get("serviceId") || undefined,
      page: Number(searchParams.get("page")) || 1,
      limit: Number(searchParams.get("limit")) || 50,
    });

    logger.info("GET /api/appointments", { clinicId, date: searchParams.get("date"), role: auth.role });
    return ok(result);
  } catch (err) {
    logger.error("GET /api/appointments error", { error: String(err) });
    return error("Server xatosi", 500);
  }
}
