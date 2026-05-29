import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, unauthorized, forbidden, notFound, error } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = requireAuth(req);
  if (!user) return unauthorized();

  const isSuperAdmin = user.role === "super_admin";
  const isClinicAdmin = user.role === "clinic_admin";
  if (!isSuperAdmin && !isClinicAdmin) return forbidden();

  const campaign = await prisma.adCampaign.findUnique({
    where: { id: params.id },
    include: {
      clinic: { select: { id: true, name: true, subscriptionPlan: true } },
      channels: { include: { channel: true } },
      posts: { orderBy: { sentAt: "desc" }, take: 50 },
    },
  });

  if (!campaign) return notFound("Kampaniya topilmadi");
  if (isClinicAdmin && campaign.clinicId !== user.clinicId) return forbidden();
  return ok(campaign);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = requireAuth(req);
  if (!user) return unauthorized();

  const isSuperAdmin = user.role === "super_admin";
  const isClinicAdmin = user.role === "clinic_admin";
  if (!isSuperAdmin && !isClinicAdmin) return forbidden();

  const campaign = await prisma.adCampaign.findUnique({ where: { id: params.id } });
  if (!campaign) return notFound("Kampaniya topilmadi");

  // clinic_admin faqat o'z kampaniyasini tahrirlay oladi
  if (isClinicAdmin && campaign.clinicId !== user.clinicId) return forbidden();

  if (campaign.status === "completed" || campaign.status === "cancelled") {
    return error("Tugagan yoki bekor qilingan kampaniyani o'zgartirish mumkin emas");
  }

  const body = await req.json();
  const {
    title, adText, imageUrl, buttonText, buttonUrl,
    startDate, endDate, frequency, status, priority, channelIds,
  } = body;

  // clinic_admin: faqat o'z klinikasining kanallarini ishlatishi mumkin
  if (isClinicAdmin && channelIds !== undefined && (channelIds as string[]).length > 0) {
    const ownChannels = await prisma.adChannel.findMany({
      where: { id: { in: channelIds as string[] }, clinicId: user.clinicId ?? undefined },
    });
    if (ownChannels.length !== (channelIds as string[]).length) return forbidden();
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (channelIds !== undefined) {
      await tx.adCampaignChannel.deleteMany({ where: { campaignId: params.id } });
      if ((channelIds as string[]).length > 0) {
        await tx.adCampaignChannel.createMany({
          data: (channelIds as string[]).map((channelId) => ({
            id:         `${Date.now()}-${channelId}`,
            campaignId: params.id,
            channelId,
          })),
        });
      }
    }

    return tx.adCampaign.update({
      where: { id: params.id },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(adText !== undefined && { adText: adText.trim() }),
        ...(imageUrl !== undefined && { imageUrl: imageUrl?.trim() || null }),
        ...(buttonText !== undefined && { buttonText: buttonText?.trim() || null }),
        ...(buttonUrl !== undefined && { buttonUrl: buttonUrl?.trim() || null }),
        ...(startDate !== undefined && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: new Date(endDate) }),
        ...(frequency !== undefined && { frequency }),
        ...(status !== undefined && { status }),
        ...(priority !== undefined && { priority: Number(priority) }),
      },
      include: {
        clinic:   { select: { id: true, name: true } },
        channels: { include: { channel: { select: { id: true, title: true } } } },
      },
    });
  });

  return ok(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = requireAuth(req);
  if (!user) return unauthorized();

  const isSuperAdmin = user.role === "super_admin";
  const isClinicAdmin = user.role === "clinic_admin";
  if (!isSuperAdmin && !isClinicAdmin) return forbidden();

  const campaign = await prisma.adCampaign.findUnique({ where: { id: params.id } });
  if (!campaign) return notFound("Kampaniya topilmadi");

  if (isClinicAdmin && campaign.clinicId !== user.clinicId) return forbidden();

  if (campaign.status === "active") {
    await prisma.adCampaign.update({
      where: { id: params.id },
      data:  { status: "cancelled" },
    });
    return ok({ cancelled: true });
  }

  await prisma.adCampaign.delete({ where: { id: params.id } });
  return ok({ deleted: true });
}
