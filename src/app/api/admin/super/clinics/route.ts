import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, created, unauthorized, forbidden, error } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/services/config.service";

export async function GET(req: NextRequest) {
  const user = requireAuth(req);
  if (!user) return unauthorized();
  if (user.role !== "super_admin") return forbidden();

  const clinics = await prisma.clinic.findMany({
    where: { deletedAt: null },
    select: {
      id:                   true,
      name:                 true,
      phone:                true,
      address:              true,
      city:                 true,
      logoUrl:              true,
      workingHours:         true,
      isActive:             true,
      subscriptionPlan:     true,
      subscriptionStatus:   true,
      subscriptionExpiresAt: true,
      createdAt:            true,
      _count: { select: { branches: true, doctors: true, appointments: true } },
      settings: {
        select: { enableBot: true, enableWebapp: true, enableQueue: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return ok(clinics);
}

export async function POST(req: NextRequest) {
  const user = requireAuth(req);
  if (!user) return unauthorized();
  if (user.role !== "super_admin") return forbidden();

  const body = await req.json();
  const { name, phone, address, description, city, workingHours, logoUrl } = body;

  if (!name?.trim()) return error("Klinika nomi majburiy");

  // Trial period: 14 kun
  const trialExpires = new Date();
  trialExpires.setDate(trialExpires.getDate() + 14);

  // Transaksiya: clinic + asosiy filial + settings birga
  const result = await prisma.$transaction(async (tx) => {
    const clinic = await tx.clinic.create({
      data: {
        name:                 name.trim(),
        phone:                phone?.trim()        || null,
        address:              address?.trim()      || null,
        description:          description?.trim()  || null,
        city:                 city?.trim()         || "Toshkent",
        workingHours:         workingHours?.trim() || "08:00-20:00",
        logoUrl:              logoUrl?.trim()      || null,
        isActive:             true,
        subscriptionPlan:     "starter",
        subscriptionStatus:   "trial",
        subscriptionExpiresAt: trialExpires,
      },
    });

    // Avtomatik asosiy filial
    await tx.branch.create({
      data: {
        clinicId:     clinic.id,
        name:         "Bosh filial",
        address:      address?.trim() || null,
        phone:        phone?.trim()   || null,
        workingHours: workingHours?.trim() || "08:00-20:00",
        sortOrder:    0,
      },
    });

    // Default settings
    await tx.clinicSettings.create({ data: { clinicId: clinic.id } });

    return clinic;
  });

  await createAuditLog(user.userId, "CLINIC_CREATED", { name, clinicId: result.id });
  return created(result);
}
