import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, error, unauthorized, forbidden } from "@/lib/api-response";
import { getBranchScope } from "@/lib/branch-scope";
import { attachEmployeeToClinic, ApiError } from "@/lib/services/employment.service";

// POST /api/admin/doctors/attach — EM ID bo'yicha shifokorni klinikaga ulash
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth) return unauthorized();
  if (!["super_admin", "clinic_admin", "branch_admin"].includes(auth.role)) return forbidden();

  const body = await req.json();
  const { emId, serviceIds, branchId: bodyBranchId } = body;

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
        role: "doctor",
        branchId: resolvedBranchId,
        serviceIds: Array.isArray(serviceIds) ? serviceIds : [],
      })
    );

    const doctor = await prisma.doctor.findUnique({
      where: { id: result.doctorId },
      include: {
        branch: { select: { name: true } },
        services: {
          include: {
            service: { select: { id: true, name: true, type: true, price: true, defaultQueueMode: true } },
          },
        },
        employee: { select: { emId: true, photoUrl: true, specialty: true, firstName: true, lastName: true } },
      },
    });

    if (!doctor) return error("Shifokor topilmadi", 404);

    const scope = getBranchScope(auth, auth.role === "super_admin" ? clinicId : undefined);
    void scope;

    return ok({
      ...doctor,
      emId: doctor.employee?.emId ?? null,
      firstName: doctor.employee?.firstName ?? doctor.firstName,
      lastName: doctor.employee?.lastName ?? doctor.lastName,
      photoUrl: doctor.employee?.photoUrl ?? doctor.photoUrl,
      specialty: doctor.employee?.specialty ?? doctor.specialty,
      services: doctor.services.map((sd) => ({
        ...sd.service,
        price: Number(sd.service.price),
        queueMode: sd.queueMode,
      })),
      reactivated: result.reactivated,
    });
  } catch (err) {
    if (err instanceof ApiError) return error(err.message, err.statusCode);
    return error("Server xatosi", 500);
  }
}
