import { NextRequest } from "next/server";
import { ok, error } from "@/lib/api-response";
import { getOrCreateUser } from "@/lib/services/user.service";

// POST /api/user/register — universal getOrCreate (bot, webapp, api)
// phone ixtiyoriy: telegramId bo'lsa phone yo'q ham yaratiladi
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, firstName, telegramId, clinicId } = body;

    if (!firstName) return error("firstName majburiy", 400);
    if (!phone && !telegramId) return error("phone yoki telegramId kerak", 400);

    const user = await getOrCreateUser({
      phone,
      firstName,
      telegramId: telegramId ? String(telegramId) : null,
      clinicId: clinicId || null,
    });

    return ok({ tibId: user.tibId, userId: user.id, hasPhone: user.hasPhone });
  } catch {
    return error("Server xatosi", 500);
  }
}
