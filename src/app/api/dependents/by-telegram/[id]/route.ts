import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, error } from "@/lib/api-response";

export const dynamic = "force-dynamic";

// DELETE /api/dependents/by-telegram/[id]
// Body: { telegramId }
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const telegramId = body.telegramId?.trim();
    if (!telegramId) return error("telegramId majburiy", 400);

    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: { id: true },
    });
    if (!user) return error("Foydalanuvchi topilmadi", 404);

    const existing = await prisma.dependent.findFirst({
      where: { id: params.id, userId: user.id, deletedAt: null },
    });
    if (!existing) return error("Topilmadi", 404);

    await prisma.dependent.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    });

    return ok({ deleted: true });
  } catch (err) {
    console.error("[DELETE /api/dependents/by-telegram/[id]] error:", err);
    return error("O'chirib bo'lmadi", 500);
  }
}
