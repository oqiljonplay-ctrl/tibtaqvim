import { Prisma, PrismaClient } from "@prisma/client";
import { ApiError } from "@/lib/services/employment.service";

type Tx = Prisma.TransactionClient | PrismaClient;
export type ShowcaseTabT = "doctors" | "services";
export type MediaKindT = "image" | "gif" | "video" | "audio" | "youtube" | "telegram" | "pdf";

const KB = 1024;
const MB = 1024 * 1024;

export async function assertShowcaseBlockCapacity(tx: Tx, clinicId: string, tab: ShowcaseTabT) {
  const limits = await tx.clinicShowcaseLimits.findUnique({ where: { clinicId } });
  if (!limits) throw new ApiError(403, "Showcase limiti sozlanmagan. Superadmin belgilashi kerak.");
  const max = tab === "doctors" ? limits.maxBlocksDoctors : limits.maxBlocksServices;
  if (max === 0)
    throw new ApiError(
      403,
      `${tab === "doctors" ? "Shifokor" : "Xizmat"} bloklari limiti 0 — superadmin ruxsat berishi kerak.`
    );
  const current = await tx.showcaseBlock.count({ where: { clinicId, tab, deletedAt: null } });
  if (current >= max) throw new ApiError(403, `Blok limiti to'ldi (${current}/${max}).`);
}

export async function nextBlockOrder(tx: Tx, clinicId: string, tab: ShowcaseTabT): Promise<number> {
  const last = await tx.showcaseBlock.findFirst({
    where: { clinicId, tab, deletedAt: null },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  return (last?.sortOrder ?? -1) + 1;
}

export async function nextMediaOrder(tx: Tx, blockId: string): Promise<number> {
  const last = await tx.showcaseMedia.findFirst({
    where: { blockId, deletedAt: null },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  return (last?.sortOrder ?? -1) + 1;
}

export function kbLimitFor(
  l: {
    maxImageKb: number;
    maxGifKb: number;
    maxVideoKb: number;
    maxAudioKb: number;
    maxPdfKb: number;
  },
  kind: MediaKindT
): number {
  switch (kind) {
    case "image": return l.maxImageKb;
    case "gif":   return l.maxGifKb;
    case "video": return l.maxVideoKb;
    case "audio": return l.maxAudioKb;
    case "pdf":   return l.maxPdfKb;
    default:      return 0;
  }
}

export async function assertShowcaseMediaCapacity(
  tx: Tx,
  clinicId: string,
  blockId: string,
  kind: MediaKindT,
  mediaSource: "upload" | "url",
  uploadBytes: number
) {
  const limits = await tx.clinicShowcaseLimits.findUnique({ where: { clinicId } });
  if (!limits) throw new ApiError(403, "Showcase limiti sozlanmagan.");
  const formats = (limits.allowedFormats as string[]) ?? [];
  const allowed =
    formats.includes(kind) ||
    (mediaSource === "url" && kind === "image" && formats.includes("url"));
  if (!allowed) throw new ApiError(403, `"${kind}" formati bu klinikada ruxsat etilmagan.`);
  if (kind === "video" && (!limits.allowVideoUpload || limits.videoMaxSec === 0)) {
    throw new ApiError(403, "Video yuklash hozir o'chirilgan (embed YouTube/Telegram ishlating).");
  }
  const mediaCount = await tx.showcaseMedia.count({ where: { blockId, deletedAt: null } });
  if (mediaCount >= limits.maxMediaPerBlock)
    throw new ApiError(403, `Blokdagi media limiti to'ldi (${mediaCount}/${limits.maxMediaPerBlock}).`);

  if (mediaSource === "upload") {
    const kbMax = kbLimitFor(limits, kind);
    if (kbMax === 0) throw new ApiError(403, `"${kind}" yuklash limiti 0.`);
    if (uploadBytes > kbMax * KB)
      throw new ApiError(413, `Fayl katta: ${Math.round(uploadBytes / KB)}KB > ${kbMax}KB.`);
    const agg = await tx.showcaseMedia.aggregate({
      where: { block: { clinicId }, deletedAt: null, mediaSource: "upload" },
      _sum: { fileSizeBytes: true },
    });
    const used = Number(agg._sum.fileSizeBytes ?? 0);
    if (used + uploadBytes > limits.storageTotalMb * MB)
      throw new ApiError(
        413,
        `Klinika storage limiti oshib ketadi (${Math.round(used / MB)}MB + yangi > ${limits.storageTotalMb}MB).`
      );
  }
}
