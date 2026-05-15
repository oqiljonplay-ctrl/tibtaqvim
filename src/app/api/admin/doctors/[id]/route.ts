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
            service: { select: { id: true, name: true, type: true, price: true } },
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
    const { firstName, lastName, specialty, phone, photoUrl, serviceIds } = body;

    if (!firstName || !lastName || !specialty) {
      return error("firstName, lastName, specialty are required");
    }

    // ServiceDoctor M2M ni qayta yoz
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
            service: { select: { id: true, name: true, type: true, price: true } },
          },
        },
      },
    });

    return ok({
      ...updated,
      services: updated.services.map((sd) => ({
        ...sd.service,
        price: Number(sd.service.price),
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

    // Soft-delete — appointments saqlanib qoladi
    await prisma.doctor.update({
      where: { id: params.id },
      data: { isActive: false },
    });

    return ok({ deletedId: params.id });
  } catch {
    return serverError();
  }
}
