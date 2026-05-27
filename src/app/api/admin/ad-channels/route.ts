import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, created, unauthorized, forbidden, error } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const user = requireAuth(req);
  if (!user) return unauthorized();
  if (user.role !== "super_admin") return forbidden();

  const channels = await prisma.adChannel.findMany({
    orderBy: { addedAt: "desc" },
    include: {
      clinic: { select: { id: true, name: true } },
      _count: { select: { posts: true } },
    },
  });

  return ok(channels);
}

export async function POST(req: NextRequest) {
  const user = requireAuth(req);
  if (!user) return unauthorized();
  if (user.role !== "super_admin") return forbidden();

  const body = await req.json();
  const { title, chatId, type, username, memberCount, scope, clinicId } = body;

  if (!title?.trim()) return error("title majburiy");
  if (!chatId?.trim()) return error("chatId majburiy");
  if (!type || !["channel", "group"].includes(type)) return error("type: channel yoki group");
  if (!scope || !["clinic", "platform"].includes(scope)) return error("scope: clinic yoki platform");
  if (scope === "clinic" && !clinicId) return error("clinic scope uchun clinicId majburiy");

  const channel = await prisma.adChannel.create({
    data: {
      title:       title.trim(),
      chatId:      chatId.trim(),
      type,
      username:    username?.trim() || null,
      memberCount: memberCount ? Number(memberCount) : null,
      scope,
      clinicId:    scope === "clinic" ? clinicId : null,
      addedById:   user.userId,
    },
  });

  return created(channel);
}
