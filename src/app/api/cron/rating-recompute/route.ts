import { NextRequest } from "next/server";
import { ok, error, unauthorized } from "@/lib/api-response";
import { recomputeAllRatings } from "@/lib/services/rating.service";
import { logger } from "@/lib/logger";

function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
  if (req.headers.get("x-cron-secret") === secret) return true;
  return false;
}

// GET /api/cron/rating-recompute
// Tungi barcha employee reytinglarini qayta hisoblash (01:00 UTC = 06:00 Toshkent)
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return unauthorized();

  try {
    const result = await recomputeAllRatings();
    logger.info("[cron/rating-recompute] done", result);
    return ok({ ok: true, ...result });
  } catch (err) {
    logger.error("[cron/rating-recompute] error", { error: String(err) });
    return error("Server xatosi", 500);
  }
}
