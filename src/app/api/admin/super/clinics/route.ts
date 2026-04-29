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
      id: true,
      name: true,
      phone: true,
      address: true,
      isActive: true,
      createdAt: true,
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
  const { name, phone, address } = body;

  if (!name?.trim()) return error("Klinika nomi majburiy");

  const clinic = await prisma.clinic.create({
    data: { name: name.trim(), phone: phone?.trim() || null, address: address?.trim() || null },
  });

  await prisma.clinicSettings.create({ data: { clinicId: clinic.id } });
  await createAuditLog(user.userId, "CLINIC_CREATED", { name, clinicId: clinic.id });

  return created(clinic);
}
