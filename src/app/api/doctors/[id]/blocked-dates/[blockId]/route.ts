import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, error, unauthorized, forbidden, notFound } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/doctors/[id]/blocked-dates/[blockId]
 * Blokni o'chirish.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; blockId: string } }
) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();

    const doctor = await prisma.doctor.findUnique({
      where: { id: params.id },
      select: { id: true, clinicId: true, userId: true },
    });
    if (!doctor) return notFound("Shifokor topilmadi");

    const allowed = canManageDoctor(auth, doctor);
    if (!allowed) return forbidden();

    const block = await prisma.doctorBlockedDate.findFirst({
      where: { id: params.blockId, doctorId: params.id },
    });
    if (!block) return notFound("Blok topilmadi");

    await prisma.doctorBlockedDate.delete({ where: { id: params.blockId } });

    return ok({ deleted: true });
  } catch {
    return error("Server xatosi", 500);
  }
}

function canManageDoctor(
  auth: { role: string; clinicId: string | null; userId: string },
  doctor: { clinicId: string; userId: string | null }
): boolean {
  if (auth.role === "super_admin") return true;
  if (["clinic_admin", "branch_admin"].includes(auth.role)) {
    return auth.clinicId === doctor.clinicId;
  }
  if (auth.role === "doctor") {
    return doctor.userId === auth.userId;
  }
  return false;
}
