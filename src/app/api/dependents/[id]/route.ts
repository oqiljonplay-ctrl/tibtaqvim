import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, error } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireAuth(req);
  if (!auth) return error("Unauthorized", 401);

  try {
    const existing = await prisma.dependent.findFirst({
      where: { id: params.id, userId: auth.userId, deletedAt: null },
    });
    if (!existing) return error("Topilmadi", 404);

    const body = await req.json();
    const data: Record<string, unknown> = {};

    if (body.firstName !== undefined) {
      const fn = body.firstName?.trim();
      if (!fn || fn.length < 2 || fn.length > 50) {
        return error("Ism 2-50 ta harf bo'lishi kerak", 400);
      }
      data.firstName = fn;
    }
    if (body.lastName !== undefined) data.lastName = body.lastName?.trim() || null;
    if (body.phone !== undefined) {
      const p = body.phone?.trim() || null;
      if (p && !/^\+998\d{9}$/.test(p)) {
        return error("Telefon formati noto'g'ri", 400);
      }
      data.phone = p;
    }
    if (body.relation !== undefined) data.relation = body.relation?.trim() || null;
    if (body.birthYear !== undefined) data.birthYear = body.birthYear || null;

    const updated = await prisma.dependent.update({
      where: { id: params.id },
      data,
      select: { id: true, firstName: true, lastName: true, phone: true, relation: true, birthYear: true },
    });

    return ok(updated);
  } catch (err) {
    console.error("[PATCH /api/dependents/[id]] error:", err);
    return error("Yangilab bo'lmadi", 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireAuth(req);
  if (!auth) return error("Unauthorized", 401);

  try {
    const existing = await prisma.dependent.findFirst({
      where: { id: params.id, userId: auth.userId, deletedAt: null },
    });
    if (!existing) return error("Topilmadi", 404);

    await prisma.dependent.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    });

    return ok({ deleted: true });
  } catch (err) {
    console.error("[DELETE /api/dependents/[id]] error:", err);
    return error("O'chirib bo'lmadi", 500);
  }
}
