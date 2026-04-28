import "dotenv/config";
import TelegramBot from "node-telegram-bot-api";
import { handleStart } from "./handlers/start";
import { handleCallback } from "./handlers/callback";
import { handleMessage } from "./handlers/message";
import { cleanExpiredState } from "./state";

const required = ["TELEGRAM_BOT_TOKEN", "DEFAULT_CLINIC_ID", "NEXT_PUBLIC_APP_URL"] as const;
for (const key of required) {
  if (!process.env[key]) {
    console.error(`[ENV] ${key} topilmadi. .env faylini tekshiring.`);
    if (key === "TELEGRAM_BOT_TOKEN") process.exit(1);
  }
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
export const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Har 5 daqiqada eskirgan state'larni tozalash
setInterval(cleanExpiredState, 5 * 60 * 1000);

bot.on("message", async (msg) => {
  try {
    if (msg.text === "/start") {
      await handleStart(bot, msg);
    } else {
      await handleMessage(bot, msg);
    }
  } catch (err) {
    console.error("[Bot] message handler error:", err);
  }
});

bot.on("callback_query", async (query) => {
  try {
    await handleCallback(bot, query);
  } catch (err) {
    console.error("[Bot] callback handler error:", err);
    await bot.answerCallbackQuery(query.id, { text: "Xatolik yuz berdi. Qayta urinib ko'ring." });
  }
});

bot.on("polling_error", (err) => {
  console.error("[Bot] polling error:", err.message);
});

console.log("✅ ClinicBot ishga tushdi");
console.log(`📡 Klinika: ${process.env.DEFAULT_CLINIC_ID}`);
console.log(`🌐 API: ${process.env.NEXT_PUBLIC_APP_URL}`);
