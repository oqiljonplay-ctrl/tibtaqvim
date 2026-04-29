import { NextRequest } from "next/server";
import { ok, error } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/utils/phone";
import { assignTibId } from "@/lib/services/tib-id.service";

// POST /api/user/register
// Bot tomonidan bronlashdan keyin chaqiriladi
// Foydalanuvchini yaratadi yoki yangilaydi, tibId qaytaradi
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, firstName, telegramId, clinicId } = body;

    if (!phone || !firstName) {
      return error("phone va firstName majburiy", 400);
    }

    const normalized = normalizePhone(phone);
    const tgId = telegramId ? String(telegramId) : null;

    // Avval telefon yoki telegramId bo'yicha izlaymiz
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { phone: normalized },
          ...(tgId ? [{ telegramId: tgId }] : []),
        ],
      },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          phone: normalized,
          firstName: firstName.trim(),
          telegramId: tgId,
          clinicId: clinicId || null,
          role: "patient",
        },
      });
    } else {
      // Bo'sh maydonlarni to'ldirish
      const updates: Record<string, string | null> = {};
      if (!user.phone) updates.phone = normalized;
      if (!user.telegramId && tgId) updates.telegramId = tgId;
      if (!user.firstName || user.firstName === "—") updates.firstName = firstName.trim();
      if (Object.keys(updates).length > 0) {
        user = await prisma.user.update({ where: { id: user.id }, data: updates });
      }
    }

    const tibId = user.tibId ?? (await assignTibId(user.id));
    return ok({ tibId });
  } catch {
    return error("Server xatosi", 500);
  }
}
