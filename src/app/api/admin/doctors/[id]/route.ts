import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound, serverError } from "@/lib/api-response";

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
    if (!["super_admin", "clinic_admin"].includes(auth.role)) return forbidden();

    const doctor = await prisma.doctor.findUnique({ where: { id: params.id } });
    if (!doctor) return notFound("Doctor not found");
    if (auth.role !== "super_admin" && doctor.clinicId !== auth.clinicId) return forbidden();

    const body = await req.json();
    const { firstName, lastName, specialty, phone, photoUrl, serviceIds, serviceQueueModes } = body;

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

    if (Array.isArray(serviceIds)) {
      await prisma.serviceDoctor.deleteMany({ where: { doctorId: params.id } });
    }

    const updated = await prisma.doctor.update({
      where: { id: params.id },
      data: {
        firstName,
        lastName,
        specialty,
        phone: phone || null,
        photoUrl: photoUrl || null,
        ...(Array.isArray(serviceIds)
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
      },
    });

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
    if (!["super_admin", "clinic_admin"].includes(auth.role)) return forbidden();

    const doctor = await prisma.doctor.findUnique({ where: { id: params.id } });
    if (!doctor) return notFound("Doctor not found");
    if (auth.role !== "super_admin" && doctor.clinicId !== auth.clinicId) return forbidden();

    await prisma.doctor.update({
      where: { id: params.id },
      data: { isActive: false },
    });

    return ok({ deletedId: params.id });
  } catch {
    return serverError();
  }
}
