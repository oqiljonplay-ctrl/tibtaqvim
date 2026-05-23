import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, error } from "@/lib/api-response";
import { markAsArrived, markAsMissed, resetToBooked } from "@/lib/workflow/appointment-workflow";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/doctor/appointments/[id]/attendance
 * Body: { action: 'arrived' | 'missed' | 'reset' }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req);
  if (!auth) return error("Unauthorized", 401);

  const allowedRoles = ["doctor", "clinic_admin", "branch_admin", "super_admin"];
  if (!allowedRoles.includes(auth.role)) return error("Bu amal uchun ruxsat yo'q", 403);

  try {
    const body = await req.json();
    const action = body.action as string;
    const actorClinicId = auth.role === "super_admin" ? null : auth.clinicId;

    let result;
    switch (action) {
      case "arrived":
        result = await markAsArrived(params.id, actorClinicId);
        break;
      case "missed":
        result = await markAsMissed(params.id, actorClinicId);
        break;
      case "reset":
        result = await resetToBooked(params.id, actorClinicId);
        break;
      default:
        return error("Noto'g'ri amal (arrived/missed/reset)", 400);
    }

    if (!result.success) return error(result.error || "Amal bajarilmadi", 400);
    return ok({ appointment: result.appointment });
  } catch (err: any) {
    console.error("[PATCH /api/doctor/appointments/[id]/attendance]", err);
    return error("Server xatosi", 500);
  }
}
