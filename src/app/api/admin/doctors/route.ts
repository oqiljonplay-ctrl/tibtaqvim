import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, created, error, unauthorized, forbidden } from "@/lib/api-response";
import { getScope, getBranchScope, resolveBranchIdForCreate, canManageResources } from "@/lib/branch-scope";
import { resolveOrCreateEmployee, openStint, assertClinicCapacity, ApiError } from "@/lib/services/employment.service";
import { createAuditLog } from "@/lib/services/config.service";

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();

    const scope = getScope(req, auth);

    const doctors = await prisma.doctor.findMany({
      where: { ...scope, isActive: true },
      include: {
        branch: { select: { name: true } },
        services: {
          include: {
            service: { select: { id: true, name: true, type: true, price: true, defaultQueueMode: true } },
          },
        },
        employee: { select: { emId: true, photoUrl: true, firstName: true, lastName: true, specialty: true } },
      },
      orderBy: { lastName: "asc" },
    });

    return ok(doctors.map((d) => ({
      ...d,
      emId: d.employee?.emId ?? null,
      photoUrl: d.employee?.photoUrl ?? d.photoUrl,
      firstName: d.employee?.firstName ?? d.firstName,
      lastName: d.employee?.lastName ?? d.lastName,
      specialty: d.employee?.specialty ?? d.specialty,
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
      await assertClinicCapacity(tx, clinicId);

      const employee = await resolveOrCreateEmployee(tx, {
        emIdInput: body.emId,
        firstName,
        lastName,
        phone: phone ?? null,
        profession: specialty ?? "doctor",
        targetClinicId: clinicId,
      });

      // photoUrl har doim EM'ga yoziladi (portativ profil prinsipi)
      if (photoUrl !== undefined && photoUrl !== null) {
        await tx.employee.update({
          where: { id: employee.id },
          data: { photoUrl },
        });
      }

      // Reaktivatsiya tekshiruvi
      const existing = await tx.doctor.findFirst({
        where: { employeeId: employee.id, clinicId },
      });

      let doc;
      if (existing) {
        doc = await tx.doctor.update({
          where: { id: existing.id },
          data: {
            isActive: true,
            isHidden: false,
            branchId,
            firstName,
            lastName,
            specialty,
            phone: phone ?? null,
            ...(Array.isArray(serviceIds) && serviceIds.length > 0
              ? { services: { deleteMany: {}, create: serviceIds.map((serviceId: string) => ({ serviceId })) } }
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
      } else {
        doc = await tx.doctor.create({
          data: {
            clinicId,
            firstName,
            lastName,
            specialty,
            phone: phone ?? null,
            branchId,
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
      }

      await openStint(tx, {
        employeeId: employee.id,
        clinicId,
        role: "doctor",
        doctorId: doc.id,
      });

      await tx.auditLog.create({
        data: {
          actorId: auth.userId,
          clinicId,
          action: "doctor.hired",
          payload: {
            doctorId: doc.id,
            employeeId: employee.id,
            emId: employee.emId,
            reactivated: !!existing,
          },
        },
      });

      return doc;
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
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      return error(err.message, err.statusCode);
    }
    return error("Server error", 500);
  }
}
