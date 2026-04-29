import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, unauthorized, forbidden, notFound, error } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/services/config.service";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = requireAuth(req);
  if (!user) return unauthorized();
  if (user.role !== "super_admin") return forbidden();

  const clinic = await prisma.clinic.findFirst({
    where: { id: params.id, deletedAt: null },
    include: {
      settings: true,
      featureFlags: true,
      moduleConfigs: true,
      _count: { select: { branches: true, doctors: true, staff: true, appointments: true } },
    },
  });

  if (!clinic) return notFound("Klinika topilmadi");
  return ok(clinic);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = requireAuth(req);
  if (!user) return unauthorized();
  if (user.role !== "super_admin") return forbidden();

  const body = await req.json();
  const { name, phone, address, isActive } = body;

  const clinic = await prisma.clinic.findFirst({ where: { id: params.id, deletedAt: null } });
  if (!clinic) return notFound("Klinika topilmadi");

  if (!name?.trim()) return error("Klinika nomi majburiy");

  const updated = await prisma.clinic.update({
    where: { id: params.id },
    data: {
      name: name.trim(),
      phone: phone?.trim() || null,
      address: address?.trim() || null,
      isActive: isActive ?? clinic.isActive,
    },
  });

  await createAuditLog(user.userId, "CLINIC_UPDATED", { clinicId: params.id, changes: body }, params.id);

  return ok(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = requireAuth(req);
  if (!user) return unauthorized();
  if (user.role !== "super_admin") return forbidden();

  const clinic = await prisma.clinic.findFirst({ where: { id: params.id, deletedAt: null } });
  if (!clinic) return notFound("Klinika topilmadi");

  await prisma.clinic.update({
    where: { id: params.id },
    data: { deletedAt: new Date(), isActive: false },
  });

  await createAuditLog(user.userId, "CLINIC_DELETED", { clinicId: params.id, name: clinic.name }, params.id);

  return ok({ deleted: true });
}
