import TelegramBot from "node-telegram-bot-api";
import { handleStart } from "./handlers/start";
import { handleCallback } from "./handlers/callback";
import { handleMessage } from "./handlers/message";

export function setupBotHandlers(bot: TelegramBot): void {
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
      try {
        await bot.answerCallbackQuery(query.id, { text: "Xatolik yuz berdi. Qayta urinib ko'ring." });
      } catch {}
    }
  });
}
