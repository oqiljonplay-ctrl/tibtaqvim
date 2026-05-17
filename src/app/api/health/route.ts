import { prisma } from "@/lib/prisma";
import { ok, error } from "@/lib/api-response";
import { NextRequest } from "next/server";

// Vercel cold start'da bu reset bo'ladi — warm instance'da indikatsiya beradi.
const startedAt = Date.now();

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout: ${label}`)), ms)
    ),
  ]);
}

async function checkTelegramWebhook(): Promise<{
  ok: boolean;
  url?: string;
  pendingUpdates?: number;
  lastErrorMessage?: string | null;
  error?: string;
}> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN missing" };
  try {
    const res = await withTimeout(
      fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`),
      3000,
      "telegram"
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await res.json();
    if (!json.ok) return { ok: false, error: json.description ?? "Telegram API error" };
    return {
      ok: !!json.result?.url,
      url: json.result?.url ?? undefined,
      pendingUpdates: json.result?.pending_update_count ?? 0,
      lastErrorMessage: json.result?.last_error_message ?? null,
    };
  } catch (err: unknown) {
    return { ok: false, error: String(err instanceof Error ? err.message : err) };
  }
}

function checkEnv(): { missing: string[]; warnings: string[] } {
  const required = ["DATABASE_URL", "JWT_SECRET", "NEXTAUTH_SECRET"];
  const productionRequired = [
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_WEBHOOK_SECRET",
    "DEFAULT_CLINIC_ID",
    "CRON_SECRET",
    "NEXT_PUBLIC_APP_URL",
  ];
  const missing = required.filter((k) => !process.env[k]);
  const warnings =
    process.env.NODE_ENV === "production"
      ? productionRequired.filter((k) => !process.env[k])
      : [];
  return { missing, warnings };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const verbose = url.searchParams.get("verbose") === "1";

  // ─── DB tekshiruvi (har doim) ─────────────────────────────────────────────
  let dbOk = false;
  let dbErrMsg: string | null = null;
  try {
    await withTimeout(prisma.$queryRawUnsafe("SELECT 1"), 2000, "db");
    dbOk = true;
  } catch (err: unknown) {
    dbErrMsg = String(err instanceof Error ? err.message : err);
  }

  if (!dbOk) {
    return error({ code: "DB_DOWN", message: dbErrMsg ?? "DB ulanmadi" }, 503);
  }

  // ─── Base response (har doim qaytadi) ────────────────────────────────────
  const env = checkEnv();
  const base = {
    status: env.missing.length === 0 ? "ok" : "degraded",
    db: "connected",
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    environment: process.env.NODE_ENV ?? "development",
    version: process.env.npm_package_version ?? "1.0.0",
    region: process.env.VERCEL_REGION ?? "local",
    env: {
      missing: env.missing,
      warnings: env.warnings,
    },
  };

  if (!verbose) {
    return ok(base);
  }

  // ─── ?verbose=1 — qo'shimcha tekshiruvlar ────────────────────────────────
  const [webhook, botStatesCount, lastAppointment] = await Promise.all([
    checkTelegramWebhook(),
    withTimeout(
      prisma.botState.count({ where: { expiresAt: { gt: new Date() } } }),
      2000,
      "bot_states"
    ).catch(() => -1),
    withTimeout(
      prisma.appointment.findFirst({
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      2000,
      "last_appointment"
    ).catch(() => null),
  ]);

  return ok({
    ...base,
    webhook,
    botStates: { activeCount: botStatesCount },
    lastAppointmentAt: lastAppointment?.createdAt?.toISOString() ?? null,
  });
}
