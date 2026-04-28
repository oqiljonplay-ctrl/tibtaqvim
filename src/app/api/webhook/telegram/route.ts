import { NextRequest } from "next/server";
import TelegramBot from "node-telegram-bot-api";
import { ok, error } from "@/lib/api-response";
import { setupBotHandlers } from "../../../../../bot/webhook-setup";

let bot: TelegramBot | null = null;

function getBot() {
  if (!bot) {
    bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { webHook: true });
    setupBotHandlers(bot);
  }
  return bot;
}

export async function POST(req: NextRequest) {
  try {
    const update = await req.json();
    getBot().processUpdate(update);
    return ok({ ok: true });
  } catch {
    return error("Webhook error", 500);
  }
}
