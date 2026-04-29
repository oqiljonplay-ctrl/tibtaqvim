import { NextRequest } from "next/server";
import { ok, error } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/utils/phone";
import { assignTibId } from "@/lib/services/tib-id.service";

// POST /api/user/register — getOrCreateUser
// phone ixtiyoriy: telegramId bo'lsa phone yo'q ham yaratiladi (bot /start uchun)
// Ketma-ket izlash: telegramId → phone → yaratish
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, firstName, telegramId, clinicId } = body;

    if (!firstName) return error("firstName majburiy", 400);
    if (!phone && !telegramId) return error("phone yoki telegramId kerak", 400);

    const normalized = phone ? normalizePhone(phone) : null;
    const tgId = telegramId ? String(telegramId) : null;

    let user = null;

    // 1. TelegramId bo'yicha (eng ishonchli)
    if (tgId) {
      user = await prisma.user.findUnique({ where: { telegramId: tgId } });
    }

    // 2. Phone bo'yicha (telegramId topilmasa)
    if (!user && normalized) {
      user = await prisma.user.findFirst({ where: { phone: normalized } });
    }

    if (user) {
      // Mavjud user — bo'sh maydonlarni to'ldirish
      const updates: Record<string, string | null> = {};
      if (!user.phone && normalized) updates.phone = normalized;
      if (!user.telegramId && tgId) updates.telegramId = tgId;
      if (!user.firstName || user.firstName === "—") updates.firstName = firstName.trim();
      if (Object.keys(updates).length > 0) {
        user = await prisma.user.update({ where: { id: user.id }, data: updates });
      }
    } else {
      // Yangi user yaratish
      user = await prisma.user.create({
        data: {
          phone: normalized,
          firstName: firstName.trim(),
          telegramId: tgId,
          clinicId: clinicId || null,
          role: "patient",
        },
      });
    }

    const tibId = user.tibId ?? (await assignTibId(user.id));
    return ok({ tibId, userId: user.id, hasPhone: !!user.phone });
  } catch {
    return error("Server xatosi", 500);
  }
}
