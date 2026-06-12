import { NextRequest } from "next/server";
import { requireAuth, requireEmVerified } from "@/lib/auth";
import { ok, error } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
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

  if (!(await requireEmVerified(req, auth))) {
    return error({ code: "EM_REQUIRED", message: "EM id tasdiqlanmagan" }, 403);
  }

  try {
    const body = await req.json();
    const action = body.action as string;
    const actorClinicId = auth.role === "super_admin" ? null : auth.clinicId;

    const prevAppt = await prisma.appointment.findUnique({
      where: { id: params.id },
      select: { status: true, clinicId: true },
    });

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

    if (!result.success) return error(result.error || "Amal bajarilmadi", result.notFound ? 404 : 400);

    try {
      await prisma.auditLog.create({
        data: {
          actorId: auth.userId,
          action: "appointment.status_change",
          payload: {
            appointmentId: params.id,
            previousStatus: prevAppt?.status ?? null,
            newStatus: action === "reset" ? "booked" : action,
          },
          clinicId: prevAppt?.clinicId ?? auth.clinicId ?? null,
        },
      });
    } catch {}

    return ok({ appointment: result.appointment });
  } catch (err: any) {
    console.error("[PATCH /api/doctor/appointments/[id]/attendance]", err);
    return error("Server xatosi", 500);
  }
}
