import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, created, error, unauthorized, forbidden } from "@/lib/api-response";
import { getBranchScope, resolveBranchIdForCreate, canManageResources } from "@/lib/branch-scope";
import { nextEmId } from "@/lib/services/em-id.service";

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();

    const explicitClinicId = new URL(req.url).searchParams.get("clinicId");
    const scope = getBranchScope(auth, explicitClinicId);

    const doctors = await prisma.doctor.findMany({
      where: { ...scope, isActive: true },
      include: {
        branch: { select: { name: true } },
        services: {
          include: {
            service: { select: { id: true, name: true, type: true, price: true, defaultQueueMode: true } },
          },
        },
        employee: { select: { emId: true } },
      },
      orderBy: { lastName: "asc" },
    });

    return ok(doctors.map((d) => ({
      ...d,
      emId: d.employee?.emId ?? null,
      services: d.services.map((sd) => ({
        ...sd.service,
        price: Number(sd.service.price),
        queueMode: sd.queueMode,
      })),
    })));
  } catch {
    return error("Server error", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (!canManageResources(auth)) return forbidden();

    const body = await req.json();
    const { firstName, lastName, specialty, phone, photoUrl, serviceIds } = body;

    if (!firstName || !lastName || !specialty) {
      return error("firstName, lastName, specialty are required");
    }

    const clinicId = auth.role === "super_admin" ? body.clinicId : auth.clinicId;
    if (!clinicId) return error("clinicId required");

    const branchId = resolveBranchIdForCreate(auth, body.branchId);

    const doctor = await prisma.$transaction(async (tx) => {
      const emId = await nextEmId(tx);
      const employee = await tx.employee.create({
        data: {
          emId,
          firstName,
          lastName,
          phone: phone ?? null,
          profession: specialty ?? "doctor",
          userId: null,
        },
      });
      return tx.doctor.create({
        data: {
          clinicId,
          firstName,
          lastName,
          specialty,
          phone: phone ?? null,
          branchId,
          photoUrl: photoUrl ?? null,
          employeeId: employee.id,
          ...(Array.isArray(serviceIds) && serviceIds.length > 0
            ? { services: { create: serviceIds.map((serviceId: string) => ({ serviceId })) } }
            : {}),
        },
        include: {
          branch: { select: { name: true } },
          services: {
            include: {
              service: { select: { id: true, name: true, type: true, price: true, defaultQueueMode: true } },
            },
          },
          employee: { select: { emId: true } },
        },
      });
    });

    return created({
      ...doctor,
      emId: doctor.employee?.emId ?? null,
      services: doctor.services.map((sd) => ({
        ...sd.service,
        price: Number(sd.service.price),
        queueMode: sd.queueMode,
      })),
    });
  } catch {
    return error("Server error", 500);
  }
}
