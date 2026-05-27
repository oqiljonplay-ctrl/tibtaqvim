import { NextRequest } from "next/server";
import { ok, error, unauthorized } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { sendAdPost, POST_DELAY_MS } from "../../../../../bot/ad-broadcast";
import { logger } from "@/lib/logger";

function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
  if (req.headers.get("x-cron-secret") === secret) return true;
  return false;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return unauthorized();

  const { start, end } = todayRange();
  const now = new Date();

  // Bugun aktiv bo'lishi kerak bo'lgan kampaniyalar (status=active OR scheduled+started)
  const campaigns = await prisma.adCampaign.findMany({
    where: {
      status:    { in: ["active", "scheduled"] },
      startDate: { lte: now },
      endDate:   { gte: now },
    },
    orderBy: [{ priority: "asc" }, { startDate: "asc" }],
    include: {
      channels: {
        include: {
          channel: true,
        },
        where: {
          channel: { isActive: true },
        },
      },
    },
  });

  // Yangilanmagan scheduled → active
  const toActivate = campaigns.filter((c) => c.status === "scheduled");
  if (toActivate.length > 0) {
    await prisma.adCampaign.updateMany({
      where: { id: { in: toActivate.map((c) => c.id) } },
      data:  { status: "active" },
    });
  }

  const results: { campaignId: string; channelId: string; status: string }[] = [];

  for (const campaign of campaigns) {
    for (const cc of campaign.channels) {
      const channel = cc.channel;

      // Bugun allaqachon yuborilganmi?
      const alreadySent = await prisma.adPost.findFirst({
        where: {
          campaignId: campaign.id,
          channelId:  channel.id,
          sentAt:     { gte: start, lte: end },
          status:     "sent",
        },
      });
      if (alreadySent) continue;

      // Yuborish
      const result = await sendAdPost({
        chatId:     channel.chatId,
        adText:     campaign.adText,
        imageUrl:   campaign.imageUrl,
        buttonText: campaign.buttonText,
        buttonUrl:  campaign.buttonUrl,
      });

      const postId = `${campaign.id}-${channel.id}-${Date.now()}`;
      await prisma.adPost.create({
        data: {
          id:         postId,
          campaignId: campaign.id,
          channelId:  channel.id,
          messageId:  result.ok ? result.messageId : null,
          status:     result.ok ? "sent" : "failed",
          errorText:  result.ok ? null : result.error,
        },
      });

      results.push({
        campaignId: campaign.id,
        channelId:  channel.id,
        status:     result.ok ? "sent" : "failed",
      });

      if (!result.ok) {
        logger.warn("[ad-broadcast] Post yuborishda xatolik", {
          campaignId: campaign.id,
          channelId:  channel.id,
          error:      result.error,
        });
        // Bot admin emas bo'lsa — kanalni deactivate
        if (result.error?.includes("admin emas") || result.error?.includes("Forbidden")) {
          await prisma.adChannel.update({
            where: { id: channel.id },
            data:  { isActive: false },
          });
        }
      }

      await sleep(POST_DELAY_MS);
    }

    // Kampaniya tugash sanasi o'tganmi?
    if (campaign.endDate < now) {
      await prisma.adCampaign.update({
        where: { id: campaign.id },
        data:  { status: "completed" },
      });
    }
  }

  logger.info("[ad-broadcast] Cron tugadi", { sent: results.length });
  return ok({ processed: campaigns.length, results });
}

// Manual trigger (super_admin POST)
export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    // super_admin token tekshiruvi yo'q — cron secret bilan ishlatish tavsiya
    return error("CRON_SECRET majburiy", 401);
  }
  return GET(req);
}
