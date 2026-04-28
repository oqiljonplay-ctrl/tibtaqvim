import { NextRequest } from "next/server";
import { sendDayBeforeReminders, sendTwoHourReminders } from "@/lib/services/reminder.service";
import { ok, error, unauthorized, forbidden } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";

const REMINDER_LIMIT = 10;
const REMINDER_WINDOW_MS = 60_000;

function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  // Vercel cron sends: Authorization: Bearer <CRON_SECRET>
  if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
  // Custom cron services may send: x-cron-secret
  if (req.headers.get("x-cron-secret") === secret) return true;
  return false;
}

async function runReminder(req: NextRequest) {
  const type = new URL(req.url).searchParams.get("type");

  if (type === "day_before") {
    const result = await sendDayBeforeReminders();
    logger.info("day_before reminders triggered");
    return ok(result);
  }

  if (type === "two_hours") {
    const result = await sendTwoHourReminders();
    logger.info("two_hours reminders triggered");
    return ok(result);
  }

  return error("type: day_before yoki two_hours bo'lishi kerak");
}

// GET — Vercel Cron Jobs ishlatadi (Authorization: Bearer <CRON_SECRET>)
export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`reminders:${ip}`, REMINDER_LIMIT, REMINDER_WINDOW_MS)) {
    return error("Rate limit oshirildi", 429);
  }
  try {
    if (!isCronAuthorized(req)) return unauthorized();
    return await runReminder(req);
  } catch (err) {
    logger.error("Reminder GET error", { error: String(err) });
    return error("Server xatosi", 500);
  }
}

// POST — Admin yoki manual trigger uchun
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(`reminders:${ip}`, REMINDER_LIMIT, REMINDER_WINDOW_MS)) {
    return error("Rate limit oshirildi", 429);
  }
  try {
    if (isCronAuthorized(req)) {
      return await runReminder(req);
    }
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (!["super_admin"].includes(auth.role)) return forbidden();
    return await runReminder(req);
  } catch (err) {
    logger.error("Reminder POST error", { error: String(err) });
    return error("Server xatosi", 500);
  }
}
