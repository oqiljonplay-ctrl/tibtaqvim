import { NextRequest } from "next/server";
import { ok, error } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/utils/phone";
import { assignTibId } from "@/lib/services/tib-id.service";

// POST /api/user/register — getOrCreateUser
// Ketma-ket izlash: telegramId → phone → yaratish
// Har doim tibId qaytaradi
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, firstName, telegramId, clinicId } = body;

    if (!phone || !firstName) {
      return error("phone va firstName majburiy", 400);
    }

    const normalized = normalizePhone(phone);
    const tgId = telegramId ? String(telegramId) : null;

    let user = null;

    // 1. TelegramId bo'yicha izlash (eng ishonchli — bitta kishi)
    if (tgId) {
      user = await prisma.user.findUnique({ where: { telegramId: tgId } });
    }

    // 2. Phone bo'yicha izlash (telegramId topilmagan holda)
    if (!user) {
      user = await prisma.user.findFirst({ where: { phone: normalized } });
    }

    if (user) {
      // Mavjud user — bo'sh maydonlarni to'ldirish
      const updates: Record<string, string | null> = {};
      if (!user.phone) updates.phone = normalized;
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
    return ok({ tibId, userId: user.id });
  } catch {
    return error("Server xatosi", 500);
  }
}
