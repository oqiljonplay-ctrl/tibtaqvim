import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, unauthorized, forbidden, notFound } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { upsertModuleConfig, createAuditLog } from "@/lib/services/config.service";
import type { ServiceType, Prisma } from "@prisma/client";

const ALL_MODULES: ServiceType[] = ["doctor_queue", "diagnostic", "home_service"];

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = requireAuth(req);
  if (!user) return unauthorized();
  if (user.role !== "super_admin") return forbidden();

  const clinic = await prisma.clinic.findFirst({ where: { id: params.id, deletedAt: null } });
  if (!clinic) return notFound("Klinika topilmadi");

  const saved = await prisma.moduleConfig.findMany({ where: { clinicId: params.id } });

  const modules = ALL_MODULES.map((m) => {
    const found = saved.find((s) => s.module === m);
    return { module: m, enabled: found?.enabled ?? true, config: found?.config ?? {} };
  });

  return ok(modules);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = requireAuth(req);
  if (!user) return unauthorized();
  if (user.role !== "super_admin") return forbidden();

  const clinic = await prisma.clinic.findFirst({ where: { id: params.id, deletedAt: null } });
  if (!clinic) return notFound("Klinika topilmadi");

  const body: { module: ServiceType; enabled: boolean; config?: Prisma.InputJsonValue }[] =
    await req.json();

  const results = await Promise.all(
    body.map((item) => upsertModuleConfig(params.id, item.module, item.enabled, item.config ?? {}))
  );

  await createAuditLog(
    user.userId,
    "MODULES_UPDATED",
    { clinicId: params.id, count: body.length },
    params.id
  );

  return ok(results);
}
