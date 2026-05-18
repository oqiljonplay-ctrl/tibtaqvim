import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, error, notFound } from "@/lib/api-response";

export const dynamic = "force-dynamic";

/**
 * GET /api/clinics/[id]/branches
 * Public — klinikaning aktiv filiallari
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const clinic = await prisma.clinic.findFirst({
      where: { id: params.id, isActive: true, deletedAt: null },
      select: { id: true },
    });

    if (!clinic) return notFound("Clinic not found");

    const branches = await prisma.branch.findMany({
      where:   { clinicId: params.id, isActive: true },
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
    });

    return ok(branches.map((b) => ({
      id:           b.id,
      name:         b.name,
      address:      b.address,
      phone:        b.phone,
      workingHours: b.workingHours,
      nearbyMetro:  b.nearbyMetro,
      latitude:     b.latitude,
      longitude:    b.longitude,
      doctorCount:  b._count.doctors,
    })));
  } catch (err) {
    console.error(`[GET /api/clinics/${params.id}/branches]`, err);
    return error("Failed to fetch branches", 500);
  }
}
