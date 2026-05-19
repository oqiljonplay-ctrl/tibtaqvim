import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { sessionUser, canManageClinic } from "@/lib/permissions";
import { ok, created, forbidden, notFound, error, unauthorized, serverError } from "@/lib/api-response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const jwt = requireAuth(req);
  if (!jwt) return unauthorized();

  const { id: clinicId } = await params;
  const user = sessionUser(jwt);

  if (!canManageClinic(user, clinicId)) return forbidden();

  const branches = await prisma.branch.findMany({
    where: { clinicId },
    include: {
      _count: {
        select: {
          admins: { where: { role: "branch_admin", isActive: true } },
        },
      },
    },
    orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return ok({ branches, total: branches.length });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const jwt = requireAuth(req);
  if (!jwt) return unauthorized();

  const { id: clinicId } = await params;
  const user = sessionUser(jwt);

  if (!canManageClinic(user, clinicId)) return forbidden();

  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
  if (!clinic) return notFound("Klinika topilmadi");

  try {
    const body = await req.json();
    const { name, address, phone, latitude, longitude, nearbyMetro, workingHours, sortOrder } = body;

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return error("Filial nomi kamida 2 belgi bo'lishi kerak");
    }
    if (!address || typeof address !== "string" || address.trim().length < 5) {
      return error("Manzil kerak (kamida 5 belgi)");
    }
    if (latitude !== undefined && latitude !== null) {
      if (typeof latitude !== "number" || latitude < -90 || latitude > 90) {
        return error("Latitude noto'g'ri (-90 dan 90 gacha)");
      }
    }
    if (longitude !== undefined && longitude !== null) {
      if (typeof longitude !== "number" || longitude < -180 || longitude > 180) {
        return error("Longitude noto'g'ri (-180 dan 180 gacha)");
      }
    }

    const branch = await prisma.branch.create({
      data: {
        clinicId,
        name: name.trim(),
        address: address.trim(),
        phone: phone?.trim() || null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        nearbyMetro: nearbyMetro?.trim() || null,
        workingHours: workingHours?.trim() || null,
        sortOrder: typeof sortOrder === "number" ? sortOrder : 0,
        isActive: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        clinicId,
        action: "branch.create",
        payload: { branchId: branch.id, name: branch.name },
      },
    });

    return created({ branch });
  } catch {
    return serverError();
  }
}
