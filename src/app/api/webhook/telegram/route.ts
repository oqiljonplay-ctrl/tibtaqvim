import { NextRequest } from "next/server";
import TelegramBot from "node-telegram-bot-api";
import { ok, error } from "@/lib/api-response";
import { handleStart } from "../../../../../bot/handlers/start";
import { handleMessage } from "../../../../../bot/handlers/message";
import { handleCallback } from "../../../../../bot/handlers/callback";

let bot: TelegramBot | null = null;

function getBot() {
  if (!bot) {
    bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { webHook: true });
  }
  return bot;
}

export async function POST(req: NextRequest) {
  try {
    const update = await req.json();
    const b = getBot();

    if (update.message) {
      const msg = update.message;
      if (msg.text === "/start") {
        await handleStart(b, msg);
      } else {
        await handleMessage(b, msg);
      }
    } else if (update.callback_query) {
      await handleCallback(b, update.callback_query);
    }

    return ok({ ok: true });
  } catch (err) {
    console.error("[Webhook] error:", err);
    return error("Webhook error", 500);
  }
}
