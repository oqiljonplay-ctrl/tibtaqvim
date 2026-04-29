import { NextRequest } from "next/server";
import { ok, notFound, error } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { assignTibId } from "@/lib/services/tib-id.service";

// GET /api/user/by-telegram?telegramId=123456789
// phone yo'q userlarni ham qaytaradi (phone: null)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const telegramId = searchParams.get("telegramId");
    if (!telegramId) return error("telegramId is required");

    const user = await prisma.user.findUnique({
      where: { telegramId },
      select: { id: true, firstName: true, phone: true, tibId: true },
    });

    if (!user) return notFound("User not found");

    let tibId = user.tibId;
    if (!tibId) {
      tibId = await assignTibId(user.id);
    }

    return ok({
      firstName: user.firstName,
      phone: user.phone ?? null,
      tibId,
      hasPhone: !!user.phone,
    });
  } catch {
    return error("Server error", 500);
  }
}
