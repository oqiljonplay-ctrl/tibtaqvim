import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/services/config.service";

const ALLOWED_FORMATS = ["image", "gif", "video", "audio", "youtube", "telegram", "pdf", "url"];

function clampInt(v: unknown, min: number, max: number, dflt: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

async function getOrCreate(clinicId: string) {
  const existing = await prisma.clinicShowcaseLimits.findUnique({ where: { clinicId } });
  if (existing) return existing;
  return prisma.clinicShowcaseLimits.create({ data: { clinicId } });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth(req);
  if (!auth) return unauthorized();
  if (auth.role !== "super_admin") return forbidden();

  const clinic = await prisma.clinic.findFirst({
    where: { id: params.id, deletedAt: null },
    select: { id: true },
  });
  if (!clinic) return notFound("Klinika topilmadi");

  const limits = await getOrCreate(params.id);
  return ok({ limits });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth(req);
  if (!auth) return unauthorized();
  if (auth.role !== "super_admin") return forbidden();

  const clinic = await prisma.clinic.findFirst({
    where: { id: params.id, deletedAt: null },
    select: { id: true },
  });
  if (!clinic) return notFound("Klinika topilmadi");

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return error("JSON format noto'g'ri", 400);
  }

  const data: Record<string, unknown> = {};
  if ("maxBlocksDoctors"  in body) data.maxBlocksDoctors  = clampInt(body.maxBlocksDoctors, 0, 100, 0);
  if ("maxBlocksServices" in body) data.maxBlocksServices = clampInt(body.maxBlocksServices, 0, 100, 0);
  if ("maxMediaPerBlock"  in body) data.maxMediaPerBlock  = clampInt(body.maxMediaPerBlock, 0, 50, 0);
  if ("maxImageKb"        in body) data.maxImageKb        = clampInt(body.maxImageKb, 0, 51200, 0);
  if ("maxGifKb"          in body) data.maxGifKb          = clampInt(body.maxGifKb, 0, 51200, 0);
  if ("maxVideoKb"        in body) data.maxVideoKb        = clampInt(body.maxVideoKb, 0, 51200, 0);
  if ("maxAudioKb"        in body) data.maxAudioKb        = clampInt(body.maxAudioKb, 0, 51200, 0);
  if ("maxPdfKb"          in body) data.maxPdfKb          = clampInt(body.maxPdfKb, 0, 51200, 0);
  if ("storageTotalMb"    in body) data.storageTotalMb    = clampInt(body.storageTotalMb, 0, 5120, 0);
  if ("videoMaxSec"       in body) data.videoMaxSec       = clampInt(body.videoMaxSec, 0, 600, 0);
  if ("allowVideoUpload"  in body) data.allowVideoUpload  = Boolean(body.allowVideoUpload);
  if (Array.isArray(body.allowedFormats)) {
    data.allowedFormats = (body.allowedFormats as unknown[])
      .filter((f) => ALLOWED_FORMATS.includes(String(f)));
  }

  if (Object.keys(data).length === 0) return error("O'zgartiriladigan maydon ko'rsatilmadi", 400);

  await getOrCreate(params.id);
  const updated = await prisma.clinicShowcaseLimits.update({
    where: { clinicId: params.id },
    data,
  });

  await createAuditLog(
    auth.userId,
    "clinic.showcase_limits_updated",
    { clinicId: params.id, changed: Object.keys(data) },
    params.id
  );

  return ok({ limits: updated });
}
