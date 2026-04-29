import { NextRequest } from "next/server";
import { ok, notFound, error } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

// GET /api/user/by-telegram?telegramId=123456789
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const telegramId = searchParams.get("telegramId");
    if (!telegramId) return error("telegramId is required");

    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: { firstName: true, phone: true, tibId: true },
    });

    if (!user || !user.phone) return notFound("User not found");

    return ok({
      firstName: user.firstName,
      phone: user.phone,
      tibId: user.tibId ?? null,
    });
  } catch {
    return error("Server error", 500);
  }
}
