import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, unauthorized, forbidden, notFound, error as apiError } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { sendAdPost, POST_DELAY_MS } from "../../../../../../../bot/ad-broadcast";
import { logger } from "@/lib/logger";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = requireAuth(req);
  if (!user) return unauthorized();

  const isSuperAdmin = user.role === "super_admin";
  const isClinicAdmin = user.role === "clinic_admin";
  if (!isSuperAdmin && !isClinicAdmin) return forbidden();

  try {
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
    if (isClinicAdmin && campaign.clinicId !== user.clinicId) return forbidden();

    if (campaign.channels.length === 0) {
      return ok({ sent: 0, failed: 0, warning: "Kampaniyada faol kanal yo'q. Avval kanal biriktiring." });
    }

    const results: { channelTitle: string; status: string; error?: string }[] = [];

    for (const cc of campaign.channels) {
      const channel = cc.channel;

      let result: { ok: true; messageId: string } | { ok: false; error: string };
      try {
        result = await sendAdPost({
          chatId:     channel.chatId,
          title:      campaign.title,
          adText:     campaign.adText,
          imageUrl:   campaign.imageUrl,
          buttonText: campaign.buttonText,
          buttonUrl:  campaign.buttonUrl,
        });
      } catch (err: unknown) {
        result = { ok: false, error: err instanceof Error ? err.message : String(err) };
      }

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
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error("[send-now] Unexpected error", { campaignId: params.id, error: msg });
    return apiError(`Yuborishda xatolik: ${msg}`, 500);
  }
}
