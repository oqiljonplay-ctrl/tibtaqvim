import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, error } from "@/lib/api-response";
import { cleanUrl } from "@/lib/showcase/clean-url";

export const dynamic = "force-dynamic";

const VALID_TABS = ["doctors", "services"] as const;
type Tab = (typeof VALID_TABS)[number];

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const clinicId = params.id;
  if (!clinicId) return error("clinicId majburiy", 400);

  const tabParam = req.nextUrl.searchParams.get("tab");
  if (!tabParam || !VALID_TABS.includes(tabParam as Tab)) {
    return error("tab 'doctors' yoki 'services' bo'lishi shart", 400);
  }
  const tab = tabParam as Tab;

  try {
    const blocks = await prisma.showcaseBlock.findMany({
      where: { clinicId, tab, isActive: true, deletedAt: null },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        tab: true,
        sortOrder: true,
        source: true,
        employeeId: true,
        serviceId: true,
        title: true,
        subtitle: true,
        showRating: true,
        cta: true,
        employee: { select: { compositeRating: true, ratingCount: true } },
        media: {
          where: { isActive: true, deletedAt: null },
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            sortOrder: true,
            kind: true,
            mediaSource: true,
            url: true,
            embedRef: true,
            posterUrl: true,
            shape: true,
            aspectW: true,
            aspectH: true,
            title: true,
            caption: true,
            // admin-only maydonlar ataylab tashqarida:
            // storagePath, posterStoragePath, mimeType, fileSizeBytes, durationSec
          },
        },
      },
    });

    const data = blocks.map((b) => {
      const rating =
        b.showRating && b.employeeId && b.employee?.compositeRating != null
          ? {
              value: Number(b.employee.compositeRating),
              count: b.employee.ratingCount ?? 0,
            }
          : null;

      return {
        id: b.id,
        tab: b.tab,
        sortOrder: b.sortOrder,
        source: b.source,
        employeeId: b.employeeId,
        serviceId: b.serviceId,
        title: b.title,
        subtitle: b.subtitle,
        cta: b.cta,
        rating,
        media: b.media.map((m) => ({
          id: m.id,
          sortOrder: m.sortOrder,
          kind: m.kind,
          mediaSource: m.mediaSource,
          url: cleanUrl(m.url),
          embedRef: cleanUrl(m.embedRef),
          posterUrl: cleanUrl(m.posterUrl),
          shape: m.shape,
          aspectW: m.aspectW,
          aspectH: m.aspectH,
          title: m.title,
          caption: m.caption,
        })),
      };
    });

    return ok({ tab, blocks: data });
  } catch (e) {
    console.error("[SHOWCASE] fetch error", e);
    return error("Showcase ma'lumotlarini olishda xatolik", 500);
  }
}
