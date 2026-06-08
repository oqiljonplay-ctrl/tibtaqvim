import { NextRequest, NextResponse } from "next/server";
import TelegramBot from "node-telegram-bot-api";
import { ok, error } from "@/lib/api-response";
import { handleStart } from "../../../../../bot/handlers/start";
import { handleMessage } from "../../../../../bot/handlers/message";
import { handleCallback } from "../../../../../bot/handlers/callback";
import { handleEditedMessage } from "../../../../../bot/handlers/editedMessage";
import { handleMyChatMember } from "../../../../../bot/handlers/myChatMember";

let bot: TelegramBot | null = null;

function getBot() {
  if (!bot) {
    bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { webHook: true });
  }
  return bot;
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!expected) {
    console.error("[webhook] TELEGRAM_WEBHOOK_SECRET env not configured");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  if (secret !== expected) {
    console.warn("[webhook] Invalid secret token", {
      hasSecret: !!secret,
      ip: req.headers.get("x-forwarded-for") || "unknown",
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const update = await req.json();
    const b = getBot();

    if (update.message) {
      const msg = update.message;
      const isStartCommand = /^\/start(@\w+)?(\s|$)/.test(msg.text || "");
      if (isStartCommand) {
        await handleStart(b, msg);
      } else {
        await handleMessage(b, msg);
      }
    } else if (update.callback_query) {
      await handleCallback(b, update.callback_query);
    } else if (update.edited_message) {
      await handleEditedMessage(b, update.edited_message);
    } else if (update.my_chat_member) {
      await handleMyChatMember(b, update.my_chat_member);
    }

    return ok({ ok: true });
  } catch (err) {
    console.error("[Webhook] error:", err);
    return error("Webhook error", 500);
  }
}
