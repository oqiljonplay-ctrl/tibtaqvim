import { NextRequest } from "next/server";
import { ok, error } from "@/lib/api-response";
import { getTibIdByPhone, getTibIdByTelegramId } from "@/lib/services/tib-id.service";

// GET /api/user/tib?phone=+998901234567
// GET /api/user/tib?telegramId=123456789
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const phone = searchParams.get("phone");
  const telegramId = searchParams.get("telegramId");

  if (!phone && !telegramId) {
    return error("phone yoki telegramId majburiy");
  }

  try {
    const tibId = phone
      ? await getTibIdByPhone(phone)
      : await getTibIdByTelegramId(telegramId!);

    return ok({ tibId: tibId ?? null });
  } catch {
    return ok({ tibId: null });
  }
}
