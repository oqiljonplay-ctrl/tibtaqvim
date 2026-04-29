import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, unauthorized, forbidden, notFound } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { DEFAULT_FLAGS, FLAG_LABELS, upsertFeatureFlag, createAuditLog } from "@/lib/services/config.service";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = requireAuth(req);
  if (!user) return unauthorized();
  if (user.role !== "super_admin") return forbidden();

  const clinic = await prisma.clinic.findFirst({ where: { id: params.id, deletedAt: null } });
  if (!clinic) return notFound("Klinika topilmadi");

  const saved = await prisma.featureFlag.findMany({ where: { clinicId: params.id } });

  const flags = Object.keys(DEFAULT_FLAGS).map((key) => {
    const found = saved.find((f) => f.key === key);
    return {
      key,
      label: FLAG_LABELS[key] ?? key,
      enabled: found?.enabled ?? DEFAULT_FLAGS[key],
    };
  });

  return ok(flags);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = requireAuth(req);
  if (!user) return unauthorized();
  if (user.role !== "super_admin") return forbidden();

  const clinic = await prisma.clinic.findFirst({ where: { id: params.id, deletedAt: null } });
  if (!clinic) return notFound("Klinika topilmadi");

  const body: { key: string; enabled: boolean }[] = await req.json();

  await Promise.all(body.map((item) => upsertFeatureFlag(params.id, item.key, item.enabled)));

  await createAuditLog(
    user.userId,
    "FEATURES_UPDATED",
    { clinicId: params.id, flags: body },
    params.id
  );

  return ok({ updated: body.length });
}
