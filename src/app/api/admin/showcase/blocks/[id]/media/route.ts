import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, created, error, unauthorized, forbidden, notFound, serverError } from "@/lib/api-response";
import { canManageResources } from "@/lib/branch-scope";
import { createAuditLog } from "@/lib/services/config.service";
import { ApiError } from "@/lib/services/employment.service";
import {
  assertShowcaseMediaCapacity,
  nextMediaOrder,
  MediaKindT,
} from "@/lib/services/showcase.service";
import {
  uploadShowcaseFile,
  deleteShowcaseFiles,
  showcasePath,
} from "@/lib/storage/showcase-storage";
import { randomUUID } from "crypto";

const KINDS: MediaKindT[] = ["image", "gif", "video", "audio", "youtube", "telegram", "pdf"];
const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
  "audio/mpeg": "mp3",
  "video/mp4": "mp4",
};

async function loadBlock(req: NextRequest, blockId: string) {
  const auth = requireAuth(req);
  if (!auth) return { err: unauthorized() as NextResponse };
  if (!canManageResources(auth)) return { err: forbidden() as NextResponse };
  const block = await prisma.showcaseBlock.findFirst({
    where: { id: blockId, deletedAt: null },
    select: { id: true, clinicId: true },
  });
  if (!block) return { err: notFound() as NextResponse };
  if (auth.role !== "super_admin" && block.clinicId !== auth.clinicId)
    return { err: forbidden() as NextResponse };
  return { auth, block };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await loadBlock(req, params.id);
  if ("err" in r) return r.err;
  const media = await prisma.showcaseMedia.findMany({
    where: { blockId: params.id, deletedAt: null },
    orderBy: { sortOrder: "asc" },
  });
  return ok(media);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const r = await loadBlock(req, params.id);
  if ("err" in r) return r.err;
  const { auth, block } = r;
  const ctype = req.headers.get("content-type") || "";
  try {
    if (ctype.includes("multipart/form-data")) {
      const fd = await req.formData();
      const file = fd.get("file") as File | null;
      const kind = String(fd.get("kind") || "") as MediaKindT;
      if (!file) return error("Fayl yo'q", 400);
      if (!KINDS.includes(kind)) return error("kind noto'g'ri", 400);
      const bytes = file.size;
      await prisma.$transaction(async (tx) =>
        assertShowcaseMediaCapacity(tx, block.clinicId, block.id, kind, "upload", bytes)
      );
      const ext = MIME_EXT[file.type] || (file.name.split(".").pop() ?? "bin");
      const mediaId = randomUUID();
      const path = showcasePath(block.clinicId, block.id, mediaId, ext);
      const buf = Buffer.from(await file.arrayBuffer());
      const { url } = await uploadShowcaseFile(path, buf, file.type);
      try {
        const sortOrder = await nextMediaOrder(prisma, block.id);
        const media = await prisma.showcaseMedia.create({
          data: {
            id: mediaId,
            blockId: block.id,
            sortOrder,
            kind,
            mediaSource: "upload",
            storagePath: path,
            url,
            shape: fd.get("shape") === "circle" ? "circle" : "original",
            aspectW: fd.get("aspectW") ? Number(fd.get("aspectW")) : null,
            aspectH: fd.get("aspectH") ? Number(fd.get("aspectH")) : null,
            title: fd.get("title") ? String(fd.get("title")) : null,
            caption: fd.get("caption") ? String(fd.get("caption")) : null,
            mimeType: file.type,
            fileSizeBytes: bytes,
          },
        });
        await createAuditLog(
          auth.userId,
          "showcase.media_created",
          { mediaId: media.id, kind, source: "upload" },
          block.clinicId
        );
        return created(media);
      } catch (dbErr) {
        try {
          await deleteShowcaseFiles([path]);
        } catch {}
        throw dbErr;
      }
    }

    const b = await req.json();
    const kind = String(b.kind || "") as MediaKindT;
    if (!KINDS.includes(kind)) return error("kind noto'g'ri", 400);
    if (kind === "youtube" || kind === "telegram") {
      if (!b.embedRef) return error("embed havola kerak", 400);
    } else if (!b.url) {
      return error("URL kerak", 400);
    }
    const media = await prisma.$transaction(async (tx) => {
      await assertShowcaseMediaCapacity(tx, block.clinicId, block.id, kind, "url", 0);
      const sortOrder = await nextMediaOrder(tx, block.id);
      return tx.showcaseMedia.create({
        data: {
          blockId: block.id,
          sortOrder,
          kind,
          mediaSource: "url",
          url: b.url ?? null,
          embedRef: b.embedRef ?? null,
          posterUrl: b.posterUrl ?? null,
          shape: b.shape === "circle" ? "circle" : "original",
          aspectW: b.aspectW ? Number(b.aspectW) : null,
          aspectH: b.aspectH ? Number(b.aspectH) : null,
          title: b.title ?? null,
          caption: b.caption ?? null,
        },
      });
    });
    await createAuditLog(
      auth.userId,
      "showcase.media_created",
      { mediaId: media.id, kind, source: "url" },
      block.clinicId
    );
    return created(media);
  } catch (e: unknown) {
    if (e instanceof ApiError) return error(e.message, e.statusCode);
    console.error("showcase media POST", e);
    return serverError();
  }
}
