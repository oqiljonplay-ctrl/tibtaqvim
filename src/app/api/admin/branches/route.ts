import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, created, error, unauthorized, forbidden } from "@/lib/api-response";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/branches
 * clinic_admin — o'z klinikasining filiallari
 * super_admin  — ?clinicId=xxx bilan istalgan klinika
 */
export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (!["super_admin", "clinic_admin"].includes(auth.role)) return forbidden();

    const clinicId =
      auth.role === "super_admin"
        ? new URL(req.url).searchParams.get("clinicId") || undefined
        : auth.clinicId!;

    const branches = await prisma.branch.findMany({
      where: { ...(clinicId ? { clinicId } : {}), isActive: true },
      select: {
        id:           true,
        clinicId:     true,
        name:         true,
        address:      true,
        phone:        true,
        workingHours: true,
        nearbyMetro:  true,
        latitude:     true,
        longitude:    true,
        sortOrder:    true,
        isActive:     true,
        createdAt:    true,
        _count: { select: { doctors: { where: { isActive: true } } } },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return ok(branches.map((b) => ({ ...b, doctorCount: b._count.doctors })));
  } catch {
    return error("Server error", 500);
  }
}

/**
 * POST /api/admin/branches
 * clinic_admin — o'z klinikasiga yangi filial
 * super_admin  — istalgan klinikaga (body.clinicId bilan)
 */
export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (!["super_admin", "clinic_admin"].includes(auth.role)) return forbidden();

    const body = await req.json();
    const { name, address, phone, workingHours, nearbyMetro, latitude, longitude, sortOrder } = body;

    if (!name?.trim()) return error("Filial nomi majburiy");

    const clinicId =
      auth.role === "super_admin" ? body.clinicId : auth.clinicId;
    if (!clinicId) return error("clinicId majburiy");

    const clinic = await prisma.clinic.findFirst({ where: { id: clinicId, isActive: true } });
    if (!clinic) return error("Klinika topilmadi", 404);

    const branch = await prisma.branch.create({
      data: {
        clinicId,
        name:         name.trim(),
        address:      address?.trim()      || null,
        phone:        phone?.trim()        || null,
        workingHours: workingHours?.trim() || null,
        nearbyMetro:  nearbyMetro?.trim()  || null,
        latitude:     latitude  != null    ? Number(latitude)  : null,
        longitude:    longitude != null    ? Number(longitude) : null,
        sortOrder:    sortOrder != null    ? Number(sortOrder) : 0,
      },
    });

    return created(branch);
  } catch {
    return error("Server error", 500);
  }
}
