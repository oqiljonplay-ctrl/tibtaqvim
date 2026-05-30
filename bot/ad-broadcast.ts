import TelegramBot from "node-telegram-bot-api";

export interface BroadcastPayload {
  chatId: string;
  title?: string | null;
  adText: string;
  imageUrl?: string | null;
  buttonText?: string | null;
  buttonUrl?: string | null;
}

let _bot: TelegramBot | null = null;

function getBot(): TelegramBot {
  if (!_bot) {
    _bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: false });
  }
  return _bot;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function sendWithRetry(
  fn: () => Promise<TelegramBot.Message>,
  retries = 2
): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const msg = await fn();
      return { ok: true, messageId: String(msg.message_id) };
    } catch (err: unknown) {
      const e = err as { code?: string; response?: { body?: unknown } };
      const rawBody = e?.response?.body;
      let body: { description?: string; parameters?: { retry_after?: number } } = {};
      try {
        body = rawBody
          ? (typeof rawBody === "string" ? JSON.parse(rawBody) : (rawBody as typeof body))
          : {};
      } catch {
        body = {};
      }

      if (body.parameters?.retry_after) {
        const wait = (body.parameters.retry_after + 1) * 1000;
        console.warn(`[ad-broadcast] 429 rate limit, ${wait}ms kutilmoqda`);
        await sleep(wait);
        continue;
      }

      const msg = body.description || (err instanceof Error ? err.message : String(err));
      return { ok: false, error: msg };
    }
  }
  return { ok: false, error: "Max retries exceeded" };
}

export async function sendAdPost(
  payload: BroadcastPayload
): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const bot = getBot();
  const { chatId, title, adText, imageUrl, buttonText, buttonUrl } = payload;
  const fullText = title?.trim() ? `<b>${title.trim()}</b>\n\n${adText}` : adText;

  const replyMarkup =
    buttonText && buttonUrl
      ? { inline_keyboard: [[{ text: buttonText, url: buttonUrl }]] }
      : undefined;

  const chatIdNum = Number(chatId);

  // Check bot is still admin
  try {
    const botInfo = await bot.getMe();
    const member = await bot.getChatMember(chatIdNum, botInfo.id);
    if (!["administrator", "creator"].includes(member.status)) {
      return { ok: false, error: "Bot admin emas" };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `getChatMember xatolik: ${msg}` };
  }

  if (imageUrl) {
    // base64 data URI → Buffer (Telegram HTTPS URL qabul qilmaydi)
    const base64Match = /^data:image\/\w+;base64,(.+)$/.exec(imageUrl);
    const photoSource: string | Buffer = base64Match
      ? Buffer.from(base64Match[1], "base64")
      : imageUrl;

    return sendWithRetry(() =>
      bot.sendPhoto(chatIdNum, photoSource, {
        caption:      fullText,
        parse_mode:   "HTML",
        reply_markup: replyMarkup as TelegramBot.InlineKeyboardMarkup,
      })
    );
  }

  return sendWithRetry(() =>
    bot.sendMessage(chatIdNum, fullText, {
      parse_mode:   "HTML",
      reply_markup: replyMarkup as TelegramBot.InlineKeyboardMarkup,
    })
  );
}

// Throttle: 3 soniya kanal/guruh orasida
export const POST_DELAY_MS = 3_000;
