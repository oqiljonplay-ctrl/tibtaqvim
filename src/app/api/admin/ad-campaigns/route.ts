import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, created, unauthorized, forbidden, error } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const user = requireAuth(req);
  if (!user) return unauthorized();
  if (user.role !== "super_admin") return forbidden();

  const { searchParams } = new URL(req.url);
  const clinicId = searchParams.get("clinicId");
  const status = searchParams.get("status");

  const campaigns = await prisma.adCampaign.findMany({
    where: {
      ...(clinicId && { clinicId }),
      ...(status && { status: status as never }),
    },
    orderBy: [{ priority: "asc" }, { startDate: "asc" }],
    include: {
      clinic: { select: { id: true, name: true, subscriptionPlan: true } },
      channels: { include: { channel: { select: { id: true, title: true, type: true, scope: true } } } },
      _count: { select: { posts: true } },
    },
  });

  return ok(campaigns);
}

export async function POST(req: NextRequest) {
  const user = requireAuth(req);
  if (!user) return unauthorized();
  if (user.role !== "super_admin") return forbidden();

  const body = await req.json();
  const {
    clinicId, title, adText, imageUrl, buttonText, buttonUrl,
    targetType, startDate, endDate, frequency, status, priority, channelIds,
  } = body;

  if (!clinicId) return error("clinicId majburiy");
  if (!title?.trim()) return error("title majburiy");
  if (!adText?.trim()) return error("adText majburiy");
  if (!startDate || !endDate) return error("startDate va endDate majburiy");
  if (new Date(startDate) > new Date(endDate)) return error("startDate endDate'dan oldin bo'lishi kerak");

  const campaign = await prisma.adCampaign.create({
    data: {
      clinicId,
      title:       title.trim(),
      adText:      adText.trim(),
      imageUrl:    imageUrl?.trim() || null,
      buttonText:  buttonText?.trim() || null,
      buttonUrl:   buttonUrl?.trim() || null,
      targetType:  targetType || "own",
      startDate:   new Date(startDate),
      endDate:     new Date(endDate),
      frequency:   frequency || "daily",
      status:      status || "scheduled",
      priority:    priority ? Number(priority) : 0,
      createdById: user.userId,
      ...(channelIds?.length && {
        channels: {
          create: (channelIds as string[]).map((channelId) => ({
            id:        `${Date.now()}-${channelId}`,
            channelId,
          })),
        },
      }),
    },
    include: {
      clinic:   { select: { id: true, name: true } },
      channels: { include: { channel: { select: { id: true, title: true } } } },
    },
  });

  return created(campaign);
}
