import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, unauthorized, forbidden, notFound } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { sendAdPost, POST_DELAY_MS } from "../../../../../../../bot/ad-broadcast";
import { logger } from "@/lib/logger";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = requireAuth(req);
  if (!user) return unauthorized();
  if (user.role !== "super_admin") return forbidden();

  const campaign = await prisma.adCampaign.findUnique({
    where: { id: params.id },
    include: {
      channels: {
        include: { channel: true },
        where: { channel: { isActive: true } },
      },
    },
  });

  if (!campaign) return notFound("Kampaniya topilmadi");
  if (campaign.channels.length === 0) {
    return ok({ sent: 0, failed: 0, warning: "Kampaniyada faol kanal yo'q. Avval kanal biriktiring." });
  }

  const results: { channelTitle: string; status: string; error?: string }[] = [];

  for (const cc of campaign.channels) {
    const channel = cc.channel;

    const result = await sendAdPost({
      chatId:     channel.chatId,
      adText:     campaign.adText,
      imageUrl:   campaign.imageUrl,
      buttonText: campaign.buttonText,
      buttonUrl:  campaign.buttonUrl,
    });

    await prisma.adPost.create({
      data: {
        id:         `manual-${campaign.id}-${channel.id}-${Date.now()}`,
        campaignId: campaign.id,
        channelId:  channel.id,
        messageId:  result.ok ? result.messageId : null,
        status:     result.ok ? "sent" : "failed",
        errorText:  result.ok ? null : result.error,
      },
    });

    results.push({
      channelTitle: channel.title,
      status:       result.ok ? "sent" : "failed",
      ...(!result.ok && { error: result.error }),
    });

    if (!result.ok && (result.error?.includes("admin emas") || result.error?.includes("Forbidden"))) {
      await prisma.adChannel.update({ where: { id: channel.id }, data: { isActive: false } });
    }

    await sleep(POST_DELAY_MS);
  }

  const sent   = results.filter((r) => r.status === "sent").length;
  const failed = results.filter((r) => r.status === "failed").length;

  logger.info("[send-now] Manual broadcast", { campaignId: params.id, sent, failed });
  return ok({ sent, failed, results });
}
