import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, unauthorized, forbidden, notFound } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = requireAuth(req);
  if (!user) return unauthorized();

  const isSuperAdmin = user.role === "super_admin";
  const isClinicAdmin = user.role === "clinic_admin";
  if (!isSuperAdmin && !isClinicAdmin) return forbidden();

  const channel = await prisma.adChannel.findUnique({ where: { id: params.id } });
  if (!channel) return notFound("Kanal topilmadi");

  // clinic_admin faqat o'z klinikasining kanalini o'zgartira oladi
  if (isClinicAdmin && channel.clinicId !== user.clinicId) return forbidden();

  const body = await req.json();
  const { title, username, memberCount, isActive, scope, clinicId } = body;

  // clinic_admin scope va clinicId o'zgartira olmaydi
  const updated = await prisma.adChannel.update({
    where: { id: params.id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(username !== undefined && { username: username?.trim() || null }),
      ...(memberCount !== undefined && { memberCount: memberCount ? Number(memberCount) : null }),
      ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      ...(isSuperAdmin && scope !== undefined && { scope }),
      ...(isSuperAdmin && clinicId !== undefined && { clinicId: clinicId || null }),
    },
  });

  return ok(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = requireAuth(req);
  if (!user) return unauthorized();

  const isSuperAdmin = user.role === "super_admin";
  const isClinicAdmin = user.role === "clinic_admin";
  if (!isSuperAdmin && !isClinicAdmin) return forbidden();

  const channel = await prisma.adChannel.findUnique({ where: { id: params.id } });
  if (!channel) return notFound("Kanal topilmadi");

  if (isClinicAdmin && channel.clinicId !== user.clinicId) return forbidden();

  const postCount = await prisma.adPost.count({ where: { channelId: params.id } });
  if (postCount > 0) {
    await prisma.adChannel.update({ where: { id: params.id }, data: { isActive: false } });
    return ok({ deactivated: true });
  }

  await prisma.adChannel.delete({ where: { id: params.id } });
  return ok({ deleted: true });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = requireAuth(req);
  if (!user) return unauthorized();

  const isSuperAdmin = user.role === "super_admin";
  const isClinicAdmin = user.role === "clinic_admin";
  if (!isSuperAdmin && !isClinicAdmin) return forbidden();

  const channel = await prisma.adChannel.findUnique({
    where: { id: params.id },
    include: {
      clinic: { select: { id: true, name: true } },
      _count: { select: { posts: true } },
    },
  });
  if (!channel) return notFound("Kanal topilmadi");
  if (isClinicAdmin && channel.clinicId !== user.clinicId) return forbidden();

  return ok(channel);
}
