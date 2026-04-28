import { NextRequest } from "next/server";
import { processBooking } from "@/lib/services/booking.service";
import { validateBookingInput } from "@/lib/validators/booking";
import { ok, error } from "@/lib/api-response";
import { logger, generateRequestId } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";

// Bir IP'dan 1 daqiqada max 10 ta so'rov
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  if (!rateLimit(`book:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)) {
    logger.warn("Rate limit exceeded", { ip });
    return error("Juda ko'p so'rov. Biroz kuting.", 429);
  }

  const reqId = generateRequestId();
  try {
    const body = await req.json();

    const validationError = validateBookingInput(body);
    if (validationError) return error(validationError, 400);

    const result = await processBooking(body);

    if (!result.success) {
      logger.warn("POST /api/book rejected", { reqId, code: result.error.code });
      return error(result.error, result.status);
    }

    logger.info("POST /api/book success", { reqId, appointmentId: result.data.id });
    return ok(result.data, 201);
  } catch (err) {
    logger.error("POST /api/book error", { reqId, error: String(err) });
    return error("Server xatosi", 500);
  }
}
