import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, created, unauthorized, forbidden, error } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const user = requireAuth(req);
  if (!user) return unauthorized();

  const isSuperAdmin = user.role === "super_admin";
  const isClinicAdmin = user.role === "clinic_admin";
  if (!isSuperAdmin && !isClinicAdmin) return forbidden();

  if (isClinicAdmin && !user.clinicId) return forbidden("Klinika ID topilmadi");

  const { searchParams } = new URL(req.url);
  const clinicId = searchParams.get("clinicId");
  const status = searchParams.get("status");

  // clinic_admin faqat o'z klinikasini ko'ra oladi
  const effectiveClinicId = isSuperAdmin ? clinicId : user.clinicId!;

  const campaigns = await prisma.adCampaign.findMany({
    where: {
      ...(effectiveClinicId && { clinicId: effectiveClinicId }),
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

  const isSuperAdmin = user.role === "super_admin";
  const isClinicAdmin = user.role === "clinic_admin";
  if (!isSuperAdmin && !isClinicAdmin) return forbidden();

  const body = await req.json();
  const {
    title, adText, imageUrl, buttonText, buttonUrl,
    startDate, endDate, frequency, status, priority, channelIds,
  } = body;

  // clinic_admin: clinicId o'zidan, targetType="own" (avtomatik)
  // super_admin: clinicId body'dan, targetType="platform" (avtomatik)
  const effectiveClinicId = isSuperAdmin ? body.clinicId : user.clinicId;
  const effectiveTargetType = isSuperAdmin ? "platform" : "own";

  if (!effectiveClinicId) return error("clinicId majburiy");
  if (!title?.trim()) return error("title majburiy");
  if (!adText?.trim()) return error("adText majburiy");
  if (!startDate || !endDate) return error("startDate va endDate majburiy");
  if (new Date(startDate) > new Date(endDate)) return error("startDate endDate'dan oldin bo'lishi kerak");

  // clinic_admin: faqat o'z klinikasining kanallarini ishlatishi mumkin
  if (isClinicAdmin && channelIds?.length) {
    const ownChannels = await prisma.adChannel.findMany({
      where: { id: { in: channelIds as string[] }, clinicId: user.clinicId ?? undefined },
    });
    if (ownChannels.length !== (channelIds as string[]).length) {
      return forbidden();
    }
  }

  const campaign = await prisma.adCampaign.create({
    data: {
      clinicId:    effectiveClinicId,
      title:       title.trim(),
      adText:      adText.trim(),
      imageUrl:    imageUrl?.trim() || null,
      buttonText:  buttonText?.trim() || null,
      buttonUrl:   buttonUrl?.trim() || null,
      targetType:  effectiveTargetType,
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
