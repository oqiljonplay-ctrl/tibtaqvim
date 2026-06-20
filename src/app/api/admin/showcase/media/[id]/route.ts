import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound, serverError } from "@/lib/api-response";
import { canManageResources } from "@/lib/branch-scope";
import { createAuditLog } from "@/lib/services/config.service";
import { deleteShowcaseFiles } from "@/lib/storage/showcase-storage";

async function loadMedia(req: NextRequest, id: string) {
  const auth = requireAuth(req);
  if (!auth) return { err: unauthorized() as NextResponse };
  if (!canManageResources(auth)) return { err: forbidden() as NextResponse };
  const media = await prisma.showcaseMedia.findFirst({
    where: { id, deletedAt: null },
    include: { block: { select: { clinicId: true } } },
  });
  if (!media) return { err: notFound() as NextResponse };
  if (auth.role !== "super_admin" && media.block.clinicId !== auth.clinicId)
    return { err: forbidden() as NextResponse };
  return { auth, media };
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await loadMedia(req, params.id);
  if ("err" in r) return r.err;
  const { auth, media } = r;
  const b = await req.json();
  const data: Record<string, unknown> = {};
  if ("title" in b) data.title = b.title ? String(b.title) : null;
  if ("caption" in b) data.caption = b.caption ? String(b.caption) : null;
  if ("shape" in b) data.shape = b.shape === "circle" ? "circle" : "original";
  if ("isActive" in b) data.isActive = Boolean(b.isActive);
  if ("aspectW" in b) data.aspectW = b.aspectW ? Number(b.aspectW) : null;
  if ("aspectH" in b) data.aspectH = b.aspectH ? Number(b.aspectH) : null;
  const updated = await prisma.showcaseMedia.update({ where: { id: media.id }, data });
  await createAuditLog(
    auth.userId,
    "showcase.media_updated",
    { mediaId: media.id },
    media.block.clinicId
  );
  return ok(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await loadMedia(req, params.id);
  if ("err" in r) return r.err;
  const { auth, media } = r;
  try {
    const paths = [media.storagePath, media.posterStoragePath].filter(Boolean) as string[];
    await prisma.showcaseMedia.delete({ where: { id: media.id } });
    try {
      await deleteShowcaseFiles(paths);
    } catch (e) {
      console.error("storage cleanup", e);
    }
    await createAuditLog(
      auth.userId,
      "showcase.media_deleted",
      { mediaId: media.id, files: paths.length },
      media.block.clinicId
    );
    return ok({ deleted: true });
  } catch (e) {
    console.error("showcase media DELETE", e);
    return serverError();
  }
}
