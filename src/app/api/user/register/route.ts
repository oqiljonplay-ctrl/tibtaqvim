import { NextRequest } from "next/server";
import { ok, error } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/utils/phone";
import { assignTibId } from "@/lib/services/tib-id.service";

// POST /api/user/register — getOrCreateUser (race-condition safe)
// phone ixtiyoriy: telegramId bo'lsa phone yo'q ham yaratiladi (bot /start uchun)
// Ketma-ket izlash: telegramId → phone → yaratish
// P2002 (unique constraint) → qayta qidirish (concurrent request bo'lsa)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, firstName, telegramId, clinicId } = body;

    if (!firstName) return error("firstName majburiy", 400);
    if (!phone && !telegramId) return error("phone yoki telegramId kerak", 400);

    const normalized = phone ? normalizePhone(phone) : null;
    const tgId = telegramId ? String(telegramId) : null;

    let user = await resolveUser(tgId, normalized);

    if (user) {
      // Mavjud user — bo'sh maydonlarni to'ldirish
      const updates: Record<string, string | null> = {};
      if (!user.phone && normalized) updates.phone = normalized;
      if (!user.telegramId && tgId) updates.telegramId = tgId;
      if (!user.firstName || user.firstName === "—") updates.firstName = firstName.trim();
      if (Object.keys(updates).length > 0) {
        try {
          user = await prisma.user.update({ where: { id: user.id }, data: updates });
        } catch {
          // Update conflict (e.g. telegramId already taken by another user) — ignore, use existing
          user = await resolveUser(tgId, normalized) ?? user;
        }
      }
    } else {
      // Yangi user yaratish — race condition uchun P2002 ni ushlash
      try {
        user = await prisma.user.create({
          data: {
            phone: normalized,
            firstName: firstName.trim(),
            telegramId: tgId,
            clinicId: clinicId || null,
            role: "patient",
          },
        });
      } catch (err: any) {
        if (err?.code === "P2002") {
          // Concurrent request allaqachon user yaratdi — qayta qidirish
          user = await resolveUser(tgId, normalized);
          if (!user) return error("Server xatosi", 500);
        } else {
          throw err;
        }
      }
    }

    if (!user) return error("Server xatosi", 500);

    const tibId = user.tibId ?? (await assignTibId(user.id));
    return ok({ tibId, userId: user.id, hasPhone: !!user.phone });
  } catch {
    return error("Server xatosi", 500);
  }
}

async function resolveUser(tgId: string | null, phone: string | null) {
  if (tgId) {
    const u = await prisma.user.findUnique({ where: { telegramId: tgId } });
    if (u) return u;
  }
  if (phone) {
    const u = await prisma.user.findFirst({ where: { phone } });
    if (u) return u;
  }
  return null;
}
