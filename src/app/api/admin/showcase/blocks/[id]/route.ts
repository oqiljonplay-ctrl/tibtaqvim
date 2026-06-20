import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound, serverError } from "@/lib/api-response";
import { canManageResources } from "@/lib/branch-scope";
import { createAuditLog } from "@/lib/services/config.service";
import { deleteShowcaseFiles } from "@/lib/storage/showcase-storage";

async function loadOwned(req: NextRequest, id: string) {
  const auth = requireAuth(req);
  if (!auth) return { err: unauthorized() as NextResponse };
  if (!canManageResources(auth)) return { err: forbidden() as NextResponse };
  const block = await prisma.showcaseBlock.findFirst({ where: { id, deletedAt: null } });
  if (!block) return { err: notFound() as NextResponse };
  if (auth.role !== "super_admin" && block.clinicId !== auth.clinicId)
    return { err: forbidden() as NextResponse };
  return { auth, block };
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await loadOwned(req, params.id);
  if ("err" in r) return r.err;
  const { auth, block } = r;
  const b = await req.json();
  const data: Record<string, unknown> = {};
  if ("title" in b) data.title = String(b.title).trim();
  if ("subtitle" in b) data.subtitle = b.subtitle ? String(b.subtitle).trim() : null;
  if ("showRating" in b) data.showRating = Boolean(b.showRating);
  if ("cta" in b) data.cta = b.cta === "generic" ? "generic" : "auto";
  if ("isActive" in b) data.isActive = Boolean(b.isActive);
  if ("source" in b && ["em", "service", "manual"].includes(b.source)) data.source = b.source;
  if ("employeeId" in b) data.employeeId = b.employeeId ?? null;
  if ("serviceId" in b) data.serviceId = b.serviceId ?? null;
  const updated = await prisma.showcaseBlock.update({ where: { id: block.id }, data });
  await createAuditLog(
    auth.userId,
    "showcase.block_updated",
    { blockId: block.id, changed: Object.keys(data) },
    block.clinicId
  );
  return ok(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await loadOwned(req, params.id);
  if ("err" in r) return r.err;
  const { auth, block } = r;
  try {
    const media = await prisma.showcaseMedia.findMany({
      where: { blockId: block.id },
      select: { storagePath: true, posterStoragePath: true },
    });
    const paths = media
      .flatMap((m) => [m.storagePath, m.posterStoragePath])
      .filter(Boolean) as string[];
    await prisma.$transaction([
      prisma.showcaseMedia.deleteMany({ where: { blockId: block.id } }),
      prisma.showcaseBlock.delete({ where: { id: block.id } }),
    ]);
    try {
      await deleteShowcaseFiles(paths);
    } catch (e) {
      console.error("storage cleanup", e);
    }
    await createAuditLog(
      auth.userId,
      "showcase.block_deleted",
      { blockId: block.id, files: paths.length },
      block.clinicId
    );
    return ok({ deleted: true, files: paths.length });
  } catch (e) {
    console.error("showcase block DELETE", e);
    return serverError();
  }
}
