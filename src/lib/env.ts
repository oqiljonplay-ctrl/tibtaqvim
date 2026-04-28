const required = [
  "DATABASE_URL",
  "JWT_SECRET",
  "NEXTAUTH_SECRET",
] as const;

const optional = [
  "TELEGRAM_BOT_TOKEN",
  "DEFAULT_CLINIC_ID",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_WEBAPP_URL",
] as const;

export function validateEnv() {
  const missing: string[] = [];

  for (const key of required) {
    if (!process.env[key]) missing.push(key);
  }

  if (missing.length > 0) {
    throw new Error(
      `[ENV] Majburiy environment o'zgaruvchilar topilmadi:\n  ${missing.join("\n  ")}\n\n.env faylini tekshiring.`
    );
  }

  if (process.env.NODE_ENV === "production") {
    if (!process.env.TELEGRAM_BOT_TOKEN) {
      console.warn("[ENV] TELEGRAM_BOT_TOKEN topilmadi — Telegram bot ishlamaydi");
    }
    if (!process.env.DEFAULT_CLINIC_ID) {
      console.warn("[ENV] DEFAULT_CLINIC_ID topilmadi — bot klinikasiz ishga tushadi");
    }
    if (!process.env.CRON_SECRET) {
      console.warn("[ENV] CRON_SECRET topilmadi — /api/reminders himoyasiz ishlaydi");
    }
  }
}

export function getEnv() {
  validateEnv();
  return {
    DATABASE_URL: process.env.DATABASE_URL!,
    JWT_SECRET: process.env.JWT_SECRET!,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET!,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ?? "",
    DEFAULT_CLINIC_ID: process.env.DEFAULT_CLINIC_ID ?? "",
    APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  };
}
