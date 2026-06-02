import crypto from "crypto";
import { NextRequest } from "next/server";

export interface WebappAuthResult {
  telegramId: string;
  verified: boolean;
}

// Telegram initData HMAC-SHA256 validatsiyasi
// Spec: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
export function validateTelegramInitData(initData: string): {
  valid: boolean;
  telegramId?: string;
  error?: string;
} {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return { valid: false, error: "hash topilmadi" };

    const authDate = params.get("auth_date");
    if (!authDate) return { valid: false, error: "auth_date topilmadi" };

    // 24 soatdan eski initData rad etiladi
    const ageSeconds = Date.now() / 1000 - parseInt(authDate, 10);
    if (ageSeconds > 86400) return { valid: false, error: "initData muddati o'tgan" };

    // Hash ni olib tashlab, qolganlarni saralab data-check-string yasash
    params.delete("hash");
    const pairs: string[] = [];
    params.sort(); // leksikografik tartib
    params.forEach((value, key) => pairs.push(`${key}=${value}`));
    const dataCheckString = pairs.join("\n");

    // Secret = HMAC-SHA256("WebAppData", bot_token)
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return { valid: false, error: "Bot token sozlanmagan" };

    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(botToken)
      .digest();

    const computedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    // Constant-time comparison (timing attack oldini olish)
    const hashBuf = Buffer.from(hash, "hex");
    const computedBuf = Buffer.from(computedHash, "hex");
    if (hashBuf.length !== computedBuf.length) return { valid: false, error: "Hash uzunligi mos emas" };
    if (!crypto.timingSafeEqual(hashBuf, computedBuf)) {
      return { valid: false, error: "Hash mos emas" };
    }

    const userStr = params.get("user");
    if (!userStr) return { valid: false, error: "user ma'lumoti topilmadi" };

    const user = JSON.parse(userStr);
    if (!user?.id) return { valid: false, error: "user.id topilmadi" };

    return { valid: true, telegramId: String(user.id) };
  } catch {
    return { valid: false, error: "initData parse xatosi" };
  }
}

// Webapp endpoint'larida telegramId aniqlash uchun yagona funksiya.
// Log-only rejim: initData bo'lmasa query/body param dan oladi, lekin warn log yozadi.
// initData bo'lsa va noto'g'ri bo'lsa → null qaytaradi (401 uchun).
export function resolveWebappTelegramId(
  req: NextRequest,
  fallbackTelegramId: string | null
): WebappAuthResult | null {
  const initData = req.headers.get("x-telegram-init-data");

  if (initData) {
    const result = validateTelegramInitData(initData);
    if (!result.valid || !result.telegramId) {
      console.warn("[WEBAPP-AUTH] initData validatsiyasi muvaffaqiyatsiz:", result.error, {
        path: req.nextUrl.pathname,
      });
      return null; // initData berildi, lekin noto'g'ri → rad et
    }
    return { telegramId: result.telegramId, verified: true };
  }

  // initData yo'q — log-only rejim (backward compat)
  if (!fallbackTelegramId) return null;
  console.warn("[WEBAPP-AUTH:UNVERIFIED] initData yo'q, fallback telegramId ishlatilmoqda:", {
    telegramId: fallbackTelegramId,
    path: req.nextUrl.pathname,
    ip: req.headers.get("x-forwarded-for") || "unknown",
  });
  return { telegramId: fallbackTelegramId, verified: false };
}
