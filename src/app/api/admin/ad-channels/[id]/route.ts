import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, unauthorized, forbidden, notFound, error } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = requireAuth(req);
  if (!user) return unauthorized();
  if (user.role !== "super_admin") return forbidden();

  const channel = await prisma.adChannel.findUnique({ where: { id: params.id } });
  if (!channel) return notFound("Kanal topilmadi");

  const body = await req.json();
  const { title, username, memberCount, isActive, scope, clinicId } = body;

  const updated = await prisma.adChannel.update({
    where: { id: params.id },
    data: {
      ...(title !== undefined && { title: title.trim() }),
      ...(username !== undefined && { username: username?.trim() || null }),
      ...(memberCount !== undefined && { memberCount: memberCount ? Number(memberCount) : null }),
      ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      ...(scope !== undefined && { scope }),
      ...(clinicId !== undefined && { clinicId: clinicId || null }),
    },
  });

  return ok(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = requireAuth(req);
  if (!user) return unauthorized();
  if (user.role !== "super_admin") return forbidden();

  const channel = await prisma.adChannel.findUnique({ where: { id: params.id } });
  if (!channel) return notFound("Kanal topilmadi");

  const postCount = await prisma.adPost.count({ where: { channelId: params.id } });
  if (postCount > 0) {
    await prisma.adChannel.update({ where: { id: params.id }, data: { isActive: false } });
    return ok({ deactivated: true });
  }

  await prisma.adChannel.delete({ where: { id: params.id } });
  return ok({ deleted: true });
}
