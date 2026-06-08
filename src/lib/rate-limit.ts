import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

// RATE_LIMIT_ENFORCE=true bo'lgunga qadar log-only rejim (shadow mode)
// Real false-positive tekshiruvi uchun: Vercel'da RATE_LIMIT_ENFORCE=true qo'yilgunga qadar faqat warn log
const ENFORCE = process.env.RATE_LIMIT_ENFORCE === "true";

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const now = BigInt(Date.now());
  const windowMsBig = BigInt(windowMs);

  const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
    INSERT INTO rate_limits (key, count, window_start, window_ms)
    VALUES (${key}, 1, ${now}, ${windowMsBig})
    ON CONFLICT (key) DO UPDATE
    SET
      count = CASE
        WHEN rate_limits.window_start + rate_limits.window_ms < ${now}
        THEN 1
        ELSE rate_limits.count + 1
      END,
      window_start = CASE
        WHEN rate_limits.window_start + rate_limits.window_ms < ${now}
        THEN ${now}
        ELSE rate_limits.window_start
      END,
      window_ms = ${windowMsBig}
    RETURNING count
  `;

  const count = Number(result[0]?.count ?? 1);
  const exceeded = count > limit;

  if (exceeded) {
    logger.warn("rate_limit_exceeded", { key, count, limit, enforce: ENFORCE });
    if (!ENFORCE) return true; // shadow: log yozig, lekin o'tkaz
  }

  return !exceeded;
}
