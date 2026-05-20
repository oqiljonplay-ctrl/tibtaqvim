import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, error } from "@/lib/api-response";

export const dynamic = "force-dynamic";

const MAX_DEPENDENTS = 2;

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth) return error("Unauthorized", 401);

  const list = await prisma.dependent.findMany({
    where: { userId: auth.userId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      relation: true,
      birthYear: true,
    },
  });

  return ok({ items: list, count: list.length, max: MAX_DEPENDENTS, canAdd: list.length < MAX_DEPENDENTS });
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth) return error("Unauthorized", 401);

  try {
    const body = await req.json();

    const firstName = body.firstName?.trim();
    if (!firstName || firstName.length < 2 || firstName.length > 50) {
      return error("Ism 2-50 ta harf bo'lishi kerak", 400);
    }

    const lastName = body.lastName?.trim() || null;
    const phone = body.phone?.trim() || null;
    const relation = body.relation?.trim() || null;
    const birthYear = body.birthYear ? parseInt(body.birthYear, 10) : null;

    if (phone && !/^\+998\d{9}$/.test(phone)) {
      return error("Telefon formati noto'g'ri (+998XXXXXXXXX)", 400);
    }

    if (birthYear && (birthYear < 1900 || birthYear > new Date().getFullYear())) {
      return error("Tug'ilgan yil noto'g'ri", 400);
    }

    const count = await prisma.dependent.count({
      where: { userId: auth.userId, deletedAt: null },
    });

    if (count >= MAX_DEPENDENTS) {
      return error(`Maksimal ${MAX_DEPENDENTS} ta qaramog'idagi shaxs qo'shishingiz mumkin`, 400);
    }

    const created = await prisma.dependent.create({
      data: { userId: auth.userId, firstName, lastName, phone, relation, birthYear },
      select: { id: true, firstName: true, lastName: true, phone: true, relation: true, birthYear: true },
    });

    return ok(created, 201);
  } catch (err: any) {
    if (err?.message?.includes("DEPENDENTS_LIMIT_EXCEEDED")) {
      return error(`Maksimal ${MAX_DEPENDENTS} ta qaramog'idagi shaxs qo'shishingiz mumkin`, 400);
    }
    console.error("[POST /api/dependents] error:", err);
    return error("Qaramog'idagini qo'shib bo'lmadi", 500);
  }
}
