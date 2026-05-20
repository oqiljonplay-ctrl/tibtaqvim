import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, error } from "@/lib/api-response";

export const dynamic = "force-dynamic";

// PATCH /api/user/update-name
// Body: { telegramId, firstName, lastName? }
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();

    const telegramId = body.telegramId?.trim();
    if (!telegramId) return error("telegramId majburiy", 400);

    const firstName = body.firstName?.trim();
    if (!firstName || firstName.length < 2 || firstName.length > 50) {
      return error("Ism 2-50 ta harf bo'lishi kerak", 400);
    }

    const lastName = body.lastName?.trim() || null;
    if (lastName && lastName.length > 50) {
      return error("Familiya 50 ta harfdan oshmasligi kerak", 400);
    }

    const updated = await prisma.user.update({
      where: { telegramId },
      data: { firstName, lastName },
      select: { id: true, firstName: true, lastName: true, phone: true },
    });

    return ok(updated);
  } catch (err: any) {
    if (err?.code === "P2025") return error("Foydalanuvchi topilmadi", 404);
    console.error("[PATCH /api/user/update-name] error:", err);
    return error("Yangilab bo'lmadi", 500);
  }
}
