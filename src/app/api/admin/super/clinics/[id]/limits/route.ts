import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/services/config.service";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth(req);
  if (!auth) return unauthorized();
  if (auth.role !== "super_admin") return forbidden();

  const clinic = await prisma.clinic.findFirst({
    where: { id: params.id, deletedAt: null },
    select: { id: true, name: true, maxEmployees: true },
  });
  if (!clinic) return notFound("Klinika topilmadi");

  const activeCount = await prisma.employmentStint.count({
    where: { clinicId: params.id, endDate: null },
  });

  return ok({ maxEmployees: clinic.maxEmployees, activeCount });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth(req);
  if (!auth) return unauthorized();
  if (auth.role !== "super_admin") return forbidden();

  const clinic = await prisma.clinic.findFirst({
    where: { id: params.id, deletedAt: null },
    select: { id: true, maxEmployees: true },
  });
  if (!clinic) return notFound("Klinika topilmadi");

  const body = await req.json();
  const { maxEmployees } = body;

  if (
    typeof maxEmployees !== "number" ||
    !Number.isInteger(maxEmployees) ||
    maxEmployees < 0 ||
    maxEmployees > 10000
  ) {
    return error("maxEmployees 0 dan 10000 gacha butun son bo'lishi kerak", 400);
  }

  const updated = await prisma.clinic.update({
    where: { id: params.id },
    data: { maxEmployees },
    select: { id: true, name: true, maxEmployees: true },
  });

  await createAuditLog(
    auth.userId,
    "clinic.limits_updated",
    { clinicId: params.id, oldMaxEmployees: clinic.maxEmployees, newMaxEmployees: maxEmployees },
    params.id
  );

  const activeCount = await prisma.employmentStint.count({
    where: { clinicId: params.id, endDate: null },
  });

  return ok({ ...updated, activeCount });
}
