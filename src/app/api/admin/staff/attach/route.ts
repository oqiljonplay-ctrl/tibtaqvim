import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, error, unauthorized, forbidden } from "@/lib/api-response";
import { attachEmployeeToClinic, ApiError } from "@/lib/services/employment.service";

// POST /api/admin/staff/attach — EM ID bo'yicha qabulxona xodimini klinikaga ulash
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth) return unauthorized();
  if (!["super_admin", "clinic_admin", "branch_admin"].includes(auth.role)) return forbidden();

  const body = await req.json();
  const { emId, branchId: bodyBranchId } = body;

  if (!emId?.trim()) return error("emId majburiy");

  const clinicId = auth.role === "super_admin" ? body.clinicId : auth.clinicId;
  if (!clinicId) return error("clinicId required");

  let resolvedBranchId: string | null = null;
  if (auth.role === "branch_admin") {
    resolvedBranchId = auth.branchId ?? null;
  } else {
    resolvedBranchId = bodyBranchId ?? null;
  }

  try {
    const result = await prisma.$transaction((tx) =>
      attachEmployeeToClinic(tx as Parameters<typeof attachEmployeeToClinic>[0], {
        emId: emId.trim(),
        clinicId,
        role: "receptionist",
        branchId: resolvedBranchId,
      })
    );

    const staffRec = await prisma.staff.findUnique({
      where: { id: result.staffId },
      include: {
        branch: { select: { id: true, name: true } },
        employee: { select: { emId: true, photoUrl: true, firstName: true, lastName: true } },
      },
    });

    if (!staffRec) return error("Xodim topilmadi", 404);

    return ok({
      ...staffRec,
      emId: staffRec.employee?.emId ?? null,
      firstName: staffRec.employee?.firstName ?? staffRec.firstName,
      lastName: staffRec.employee?.lastName ?? staffRec.lastName,
      photoUrl: staffRec.employee?.photoUrl ?? staffRec.photoUrl,
      reactivated: result.reactivated,
    });
  } catch (err) {
    if (err instanceof ApiError) return error(err.message, err.statusCode);
    return error("Server xatosi", 500);
  }
}
