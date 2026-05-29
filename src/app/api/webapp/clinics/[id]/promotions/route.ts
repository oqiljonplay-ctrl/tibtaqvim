import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, error } from "@/lib/api-response";

// GET /api/webapp/clinics/[id]/promotions?tgid=
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const clinicId = params.id;
  if (!clinicId) return error("clinicId majburiy", 400);

  try {
    const [promotions, clinic] = await Promise.all([
      prisma.clinicPromotion.findMany({
        where: { clinicId, isActive: true },
        orderBy: [{ sortOrder: "asc" }, { publishedAt: "desc" }],
        select: {
          id: true,
          embedId: true,
          postUrl: true,
          type: true,
          source: true,
          title: true,
          showSubscribeButton: true,
          subscribeUsername: true,
          publishedAt: true,
        },
      }),
      prisma.clinic.findUnique({
        where: { id: clinicId },
        select: {
          telegramChannelUsername: true,
          telegramGroupUsername: true,
        },
      }),
    ]);

    const data = promotions.map((p) => ({
      ...p,
      subscribeUsername:
        p.subscribeUsername ||
        (p.source === "kanal" ? clinic?.telegramChannelUsername : clinic?.telegramGroupUsername) ||
        null,
    }));

    return ok({
      promotions: data,
      clinic: {
        telegramChannelUsername: clinic?.telegramChannelUsername ?? null,
        telegramGroupUsername: clinic?.telegramGroupUsername ?? null,
      },
    });
  } catch {
    return error("Server error", 500);
  }
}
