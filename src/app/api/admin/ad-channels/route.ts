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

  const channels = await prisma.adChannel.findMany({
    where: isSuperAdmin ? {} : { clinicId: user.clinicId! },
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

  const isSuperAdmin = user.role === "super_admin";
  const isClinicAdmin = user.role === "clinic_admin";
  if (!isSuperAdmin && !isClinicAdmin) return forbidden();

  const body = await req.json();
  const { title, chatId, type, username, memberCount, scope, clinicId } = body;

  if (!title?.trim()) return error("title majburiy");
  if (!chatId?.trim()) return error("chatId majburiy");
  if (!type || !["channel", "group"].includes(type)) return error("type: channel yoki group");

  // clinic_admin: scope majburiy clinic, clinicId = o'z klinikasi
  if (isClinicAdmin) {
    if (!user.clinicId) return error("Klinika ID topilmadi");

    const existing = await prisma.adChannel.findUnique({ where: { chatId: chatId.trim() } });
    if (existing) {
      if (existing.clinicId === user.clinicId) {
        return error("Bu kanal allaqachon klinikangizga ulangan");
      }
      // myChatMember tomonidan scope=platform yaratilgan → claim qilib scope=clinic ga o'tkazish
      if (existing.scope === "platform" && !existing.clinicId) {
        const updated = await prisma.adChannel.update({
          where: { chatId: chatId.trim() },
          data: { scope: "clinic", clinicId: user.clinicId, isActive: false },
        });
        return created(updated);
      }
      return error("Bu kanal/guruh boshqa klinikaga tegishli");
    }

    const channel = await prisma.adChannel.create({
      data: {
        title:       title.trim(),
        chatId:      chatId.trim(),
        type,
        username:    username?.trim() || null,
        memberCount: memberCount ? Number(memberCount) : null,
        scope:       "clinic",
        clinicId:    user.clinicId,
        addedById:   user.userId,
        isActive:    false, // super_admin tasdiqlagunicha nofaol
      },
    });
    return created(channel);
  }

  // super_admin: scope default platform, ixtiyoriy clinicId
  const finalScope: "clinic" | "platform" = (scope === "clinic" || scope === "platform") ? scope : "platform";
  if (finalScope === "clinic" && !clinicId) return error("clinic scope uchun clinicId majburiy");

  const existingForSuper = await prisma.adChannel.findUnique({ where: { chatId: chatId.trim() } });
  if (existingForSuper) {
    return error("Bu chatId allaqachon mavjud. Kanalni ro'yxatdan tahrirlang.");
  }

  const channel = await prisma.adChannel.create({
    data: {
      title:       title.trim(),
      chatId:      chatId.trim(),
      type,
      username:    username?.trim() || null,
      memberCount: memberCount ? Number(memberCount) : null,
      scope:       finalScope,
      clinicId:    finalScope === "clinic" ? clinicId : null,
      addedById:   user.userId,
    },
  });

  return created(channel);
}
