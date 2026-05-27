import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, unauthorized, forbidden } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const user = requireAuth(req);
  if (!user) return unauthorized();
  if (user.role !== "super_admin") return forbidden();

  const [
    totalChannels,
    activeChannels,
    platformChannels,
    totalCampaigns,
    activeCampaigns,
    totalPosts,
    failedPosts,
    recentPosts,
  ] = await Promise.all([
    prisma.adChannel.count(),
    prisma.adChannel.count({ where: { isActive: true } }),
    prisma.adChannel.count({ where: { scope: "platform", isActive: true } }),
    prisma.adCampaign.count(),
    prisma.adCampaign.count({ where: { status: "active" } }),
    prisma.adPost.count({ where: { status: "sent" } }),
    prisma.adPost.count({ where: { status: "failed" } }),
    prisma.adPost.findMany({
      orderBy: { sentAt: "desc" },
      take: 20,
      include: {
        campaign: { select: { title: true, clinicId: true } },
        channel:  { select: { title: true, type: true } },
      },
    }),
  ]);

  return ok({
    channels: { total: totalChannels, active: activeChannels, platform: platformChannels },
    campaigns: { total: totalCampaigns, active: activeCampaigns },
    posts: { sent: totalPosts, failed: failedPosts },
    recentPosts,
  });
}
