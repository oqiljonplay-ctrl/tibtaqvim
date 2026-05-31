import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, error } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
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
      case "paid": {
        const mode = (body.mode as string) === "discount" ? "discount" : "full";
        result = await markAsPaid(params.id, actorClinicId, "reception", mode);
        break;
      }
      case "unpaid":
        result = await markAsUnpaid(params.id, actorClinicId);
        break;
      case "cancel": {
        const prev = await prisma.appointment.findUnique({
          where: { id: params.id },
          select: { status: true, clinicId: true },
        });
        result = await cancelAppointment(params.id, actorClinicId);
        if (result.success) {
          try {
            await prisma.auditLog.create({
              data: {
                actorId: auth.userId,
                action: "appointment.cancel",
                payload: {
                  appointmentId: params.id,
                  previousStatus: prev?.status ?? null,
                  newStatus: "cancelled",
                },
                clinicId: prev?.clinicId ?? auth.clinicId ?? null,
              },
            });
          } catch {}
        }
        break;
      }
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
