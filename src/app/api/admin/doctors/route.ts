import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, created, error, unauthorized, forbidden } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();

    const clinicId = auth.role === "super_admin"
      ? new URL(req.url).searchParams.get("clinicId") || undefined
      : auth.clinicId!;

    const doctors = await prisma.doctor.findMany({
      where: { ...(clinicId ? { clinicId } : {}), isActive: true },
      include: {
        branch: { select: { name: true } },
        services: {
          include: {
            service: { select: { id: true, name: true, type: true, price: true } },
          },
        },
      },
      orderBy: { lastName: "asc" },
    });

    return ok(doctors.map((d) => ({
      ...d,
      services: d.services.map((sd) => ({
        ...sd.service,
        price: Number(sd.service.price),
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
    if (!["super_admin", "clinic_admin"].includes(auth.role)) return forbidden();

    const body = await req.json();
    const { firstName, lastName, specialty, phone, branchId, photoUrl, serviceIds } = body;

    if (!firstName || !lastName || !specialty) {
      return error("firstName, lastName, specialty are required");
    }

    const clinicId = auth.role === "super_admin" ? body.clinicId : auth.clinicId;
    if (!clinicId) return error("clinicId required");

    const doctor = await prisma.doctor.create({
      data: {
        clinicId,
        firstName,
        lastName,
        specialty,
        phone: phone ?? null,
        branchId: branchId ?? null,
        photoUrl: photoUrl ?? null,
        ...(Array.isArray(serviceIds) && serviceIds.length > 0
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

    return created({
      ...doctor,
      services: doctor.services.map((sd) => ({
        ...sd.service,
        price: Number(sd.service.price),
      })),
    });
  } catch {
    return error("Server error", 500);
  }
}
