import { NextRequest } from "next/server";
import { updateAppointmentStatus } from "@/lib/services/appointment.service";
import { requireAuth } from "@/lib/auth";
import { ok, error, unauthorized, forbidden } from "@/lib/api-response";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (!["doctor", "receptionist", "clinic_admin", "super_admin"].includes(auth.role)) {
      return forbidden();
    }

    const { appointmentId, status } = await req.json();

    if (!appointmentId) return error("appointmentId majburiy");
    if (!["arrived", "missed"].includes(status)) return error("status: arrived yoki missed bo'lishi kerak");

    const result = await updateAppointmentStatus(appointmentId, status, auth.clinicId, auth.role);

    if (!result.success) {
      return error(result.error ?? "Server xatosi", result.status ?? 500);
    }

    logger.info("POST /api/arrived", { appointmentId, status, role: auth.role });
    return ok(result.data);
  } catch (err) {
    logger.error("POST /api/arrived error", { error: String(err) });
    return error("Server xatosi", 500);
  }
}
