import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, error, notFound } from "@/lib/api-response";

export const dynamic = "force-dynamic";

/**
 * GET /api/clinics/[id]
 * Public — bitta klinika to'liq + filiallari
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const clinic = await prisma.clinic.findFirst({
      where: {
        id:                 params.id,
        isActive:           true,
        deletedAt:          null,
        subscriptionStatus: { in: ["trial", "active"] },
      },
      select: {
        id:           true,
        name:         true,
        description:  true,
        phone:        true,
        address:      true,
        logoUrl:      true,
        city:         true,
        workingHours: true,
        rating:       true,
        ratingCount:  true,
        branches: {
          where:   { isActive: true },
          select: {
            id:           true,
            name:         true,
            address:      true,
            phone:        true,
            workingHours: true,
            nearbyMetro:  true,
            latitude:     true,
            longitude:    true,
            sortOrder:    true,
            _count: { select: { doctors: { where: { isActive: true } } } },
          },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        },
        _count: {
          select: {
            doctors:  { where: { isActive: true } },
            services: { where: { isActive: true } },
          },
        },
      },
    });

    if (!clinic) return notFound("Clinic not found");

    return ok({
      id:           clinic.id,
      name:         clinic.name,
      description:  clinic.description,
      phone:        clinic.phone,
      address:      clinic.address,
      logoUrl:      clinic.logoUrl,
      city:         clinic.city,
      workingHours: clinic.workingHours,
      rating:       Number(clinic.rating ?? 0),
      ratingCount:  clinic.ratingCount,
      doctorCount:  clinic._count.doctors,
      serviceCount: clinic._count.services,
      branches:     clinic.branches.map((b) => ({
        id:           b.id,
        name:         b.name,
        address:      b.address,
        phone:        b.phone,
        workingHours: b.workingHours,
        nearbyMetro:  b.nearbyMetro,
        latitude:     b.latitude,
        longitude:    b.longitude,
        doctorCount:  b._count.doctors,
      })),
    });
  } catch (err) {
    console.error(`[GET /api/clinics/${params.id}]`, err);
    return error("Failed to fetch clinic", 500);
  }
}
