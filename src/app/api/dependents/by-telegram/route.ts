import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, error } from "@/lib/api-response";

export const dynamic = "force-dynamic";

const MAX_DEPENDENTS = 2;

// POST /api/dependents/by-telegram — Telegram WebApp uchun (cookie yo'q)
// Body: { telegramId, firstName, lastName?, relation?, phone? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const telegramId = body.telegramId?.trim();
    if (!telegramId) return error("telegramId majburiy", 400);

    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: { id: true },
    });
    if (!user) return error("Foydalanuvchi topilmadi", 404);

    const firstName = body.firstName?.trim();
    if (!firstName || firstName.length < 2 || firstName.length > 50) {
      return error("Ism 2-50 ta harf bo'lishi kerak", 400);
    }

    const lastName = body.lastName?.trim() || null;
    const phone = body.phone?.trim() || null;
    const relation = body.relation?.trim() || null;

    if (phone && !/^\+998\d{9}$/.test(phone)) {
      return error("Telefon formati noto'g'ri (+998XXXXXXXXX)", 400);
    }

    const count = await prisma.dependent.count({
      where: { userId: user.id, deletedAt: null },
    });
    if (count >= MAX_DEPENDENTS) {
      return error(`Maksimal ${MAX_DEPENDENTS} ta qaramog'idagi shaxs qo'shishingiz mumkin`, 400);
    }

    const created = await prisma.dependent.create({
      data: { userId: user.id, firstName, lastName, phone, relation },
      select: { id: true, firstName: true, lastName: true, phone: true, relation: true },
    });

    return ok(created, 201);
  } catch (err: any) {
    if (err?.message?.includes("DEPENDENTS_LIMIT_EXCEEDED")) {
      return error(`Maksimal ${MAX_DEPENDENTS} ta qaramog'idagi shaxs qo'shishingiz mumkin`, 400);
    }
    console.error("[POST /api/dependents/by-telegram] error:", err);
    return error("Qaramog'idagini qo'shib bo'lmadi", 500);
  }
}
