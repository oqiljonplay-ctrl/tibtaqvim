import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound, serverError } from "@/lib/api-response";
import { normalizePhone } from "@/lib/utils/phone";
import { canManageResources } from "@/lib/branch-scope";
import { createAuditLog } from "@/lib/services/config.service";
import { closeStint } from "@/lib/services/employment.service";

type Params = { params: { id: string } };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();

    const doctor = await prisma.doctor.findUnique({
      where: { id: params.id },
      include: {
        branch: { select: { name: true } },
        services: {
          include: {
            service: { select: { id: true, name: true, type: true, price: true, defaultQueueMode: true } },
          },
        },
      },
    });

    if (!doctor) return notFound("Doctor not found");
    if (auth.role !== "super_admin" && doctor.clinicId !== auth.clinicId) return forbidden();

    return ok({
      ...doctor,
      services: doctor.services.map((sd) => ({
        ...sd.service,
        price: Number(sd.service.price),
        queueMode: sd.queueMode,
      })),
    });
  } catch {
    return serverError();
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (!canManageResources(auth)) return forbidden();

    const doctor = await prisma.doctor.findUnique({ where: { id: params.id } });
    if (!doctor) return notFound("Doctor not found");
    if (auth.role !== "super_admin" && doctor.clinicId !== auth.clinicId) return forbidden();
    if (auth.role === "branch_admin" && doctor.branchId !== auth.branchId) return forbidden();

    const body = await req.json();
    const { firstName, lastName, specialty, phone, photoUrl, serviceIds, serviceQueueModes, branchId } = body;

    // photoUrl EM'ga yoziladi (portativ profil printsipi)
    if (photoUrl !== undefined && photoUrl !== null && doctor.employeeId) {
      await prisma.employee.update({
        where: { id: doctor.employeeId },
        data: { photoUrl },
      });
    }

    // clinic_admin faqat o'z klinikasining filialini belgilashi mumkin
    if (branchId !== undefined && branchId !== null && auth.role === "clinic_admin") {
      const branch = await prisma.branch.findFirst({
        where: { id: branchId, isActive: true },
        select: { clinicId: true },
      });
      if (!branch || branch.clinicId !== auth.clinicId) return forbidden();
    }

    // serviceQueueModes: [{serviceId, queueMode}] — faqat queueMode yangilash
    if (Array.isArray(serviceQueueModes) && serviceQueueModes.length > 0) {
      for (const item of serviceQueueModes) {
        if (!item.serviceId || !item.queueMode) continue;
        if (!["live", "online", "slot"].includes(item.queueMode)) continue;
        await prisma.serviceDoctor.update({
          where: { serviceId_doctorId: { serviceId: item.serviceId, doctorId: params.id } },
          data: { queueMode: item.queueMode },
        });
      }
      // Faqat queueModes yangilash — boshqa field yo'q bo'lsa erta qayt
      if (!firstName && !lastName && !specialty) {
        const updated = await prisma.doctor.findUnique({
          where: { id: params.id },
          include: {
            branch: { select: { name: true } },
            services: {
              include: {
                service: { select: { id: true, name: true, type: true, price: true, defaultQueueMode: true } },
              },
            },
          },
        });
        return ok({
          ...updated,
          services: updated!.services.map((sd) => ({
            ...sd.service,
            price: Number(sd.service.price),
            queueMode: sd.queueMode,
          })),
        });
      }
    }

    if (!firstName || !lastName || !specialty) {
      return error("firstName, lastName, specialty are required");
    }

    let oldModes: Record<string, string> = {};
    if (Array.isArray(serviceIds)) {
      const old = await prisma.serviceDoctor.findMany({ where: { doctorId: params.id } });
      oldModes = Object.fromEntries(old.map((b) => [b.serviceId, b.queueMode]));
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (Array.isArray(serviceIds)) {
        await tx.serviceDoctor.deleteMany({ where: { doctorId: params.id } });
      }

      const doc = await tx.doctor.update({
        where: { id: params.id },
        data: {
          firstName,
          lastName,
          specialty,
          phone: phone ? (normalizePhone(phone) ?? null) : null,
          ...(branchId !== undefined && { branchId: branchId || null }),
          ...(Array.isArray(serviceIds)
            ? {
                services: {
                  create: serviceIds.map((serviceId: string) => ({
                    serviceId,
                    queueMode: (oldModes[serviceId] as "live" | "online" | "slot") || "online",
                  })),
                },
              }
            : {}),
        },
        include: {
          branch: { select: { name: true } },
          services: {
            include: {
              service: { select: { id: true, name: true, type: true, price: true, defaultQueueMode: true } },
            },
          },
        },
      });

      // doctor va user branchId izchil bo'lishi uchun
      if (branchId !== undefined && doc.userId) {
        await tx.user.update({
          where: { id: doc.userId },
          data: { branchId: branchId || null },
        });
      }

      return doc;
    });

    // Audit: filial o'zgardi
    if (branchId !== undefined && doctor.branchId !== (branchId || null)) {
      await createAuditLog(
        auth.userId,
        "doctor.branch_change",
        { doctorId: params.id, oldBranchId: doctor.branchId, newBranchId: branchId || null },
        doctor.clinicId
      ).catch(() => {});
    }

    return ok({
      ...updated,
      services: updated.services.map((sd) => ({
        ...sd.service,
        price: Number(sd.service.price),
        queueMode: sd.queueMode,
      })),
    });
  } catch {
    return serverError();
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (!canManageResources(auth)) return forbidden();

    const doctor = await prisma.doctor.findUnique({ where: { id: params.id } });
    if (!doctor) return notFound("Doctor not found");
    if (auth.role !== "super_admin" && doctor.clinicId !== auth.clinicId) return forbidden();
    if (auth.role === "branch_admin" && doctor.branchId !== auth.branchId) return forbidden();

    await prisma.$transaction(async (tx) => {
      await tx.doctor.update({
        where: { id: params.id },
        data: { isActive: false },
      });

      if (doctor.employeeId) {
        await closeStint(tx, {
          employeeId: doctor.employeeId,
          clinicId: doctor.clinicId,
          endReason: "fired_by_admin",
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: auth.userId,
          clinicId: doctor.clinicId,
          action: "doctor.fired",
          payload: { doctorId: params.id, employeeId: doctor.employeeId },
        },
      });
    });

    return ok({ deletedId: params.id });
  } catch {
    return serverError();
  }
}
