import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, error } from "@/lib/api-response";
import { markAsPaid, markAsUnpaid, cancelAppointment } from "@/lib/workflow/appointment-workflow";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/reception/appointments/[id]/payment
 * Body: { action: 'paid' | 'unpaid' | 'cancel' }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req);
  if (!auth) return error("Unauthorized", 401);

  const allowedRoles = ["receptionist", "clinic_admin", "branch_admin", "super_admin"];
  if (!allowedRoles.includes(auth.role)) return error("Bu amal uchun ruxsat yo'q", 403);

  try {
    const body = await req.json();
    const action = body.action as string;
    const actorClinicId = auth.role === "super_admin" ? null : auth.clinicId;

    let result;
    switch (action) {
      case "paid":
        result = await markAsPaid(params.id, actorClinicId, "reception");
        break;
      case "unpaid":
        result = await markAsUnpaid(params.id, actorClinicId);
        break;
      case "cancel":
        result = await cancelAppointment(params.id, actorClinicId);
        break;
      default:
        return error("Noto'g'ri amal (paid/unpaid/cancel)", 400);
    }

    if (!result.success) return error(result.error || "Amal bajarilmadi", 400);
    return ok({ appointment: result.appointment });
  } catch (err: any) {
    console.error("[PATCH /api/reception/appointments/[id]/payment]", err);
    return error("Server xatosi", 500);
  }
}
