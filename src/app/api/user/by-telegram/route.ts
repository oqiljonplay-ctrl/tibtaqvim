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
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        tibId: true,
        dependents: {
          where: { deletedAt: null },
          select: { id: true, firstName: true, lastName: true, phone: true, relation: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!user) return notFound("User not found");

    let tibId = user.tibId;
    if (!tibId) {
      tibId = await assignTibId(user.id);
    }

    return ok({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName ?? null,
      fullName: [user.firstName, user.lastName].filter(Boolean).join(" "),
      phone: user.phone ?? null,
      tibId,
      hasPhone: !!user.phone,
      dependents: user.dependents,
      canAddDependent: user.dependents.length < 2,
    });
  } catch {
    return error("Server error", 500);
  }
}
