import TelegramBot from "node-telegram-bot-api";

export interface BroadcastPayload {
  chatId: string;
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
      const e = err as { code?: string; response?: { body?: string } };
      const body = e?.response?.body ? JSON.parse(e.response.body) : {};

      if (body.parameters?.retry_after) {
        const wait = (body.parameters.retry_after + 1) * 1000;
        console.warn(`[ad-broadcast] 429 rate limit, ${wait}ms kutilmoqda`);
        await sleep(wait);
        continue;
      }

      const msg = body.description || String(err);
      return { ok: false, error: msg };
    }
  }
  return { ok: false, error: "Max retries exceeded" };
}

export async function sendAdPost(
  payload: BroadcastPayload
): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const bot = getBot();
  const { chatId, adText, imageUrl, buttonText, buttonUrl } = payload;

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
  } catch {
    return { ok: false, error: "getChatMember xatolik" };
  }

  if (imageUrl) {
    return sendWithRetry(() =>
      bot.sendPhoto(chatIdNum, imageUrl, {
        caption:      adText,
        parse_mode:   "HTML",
        reply_markup: replyMarkup as TelegramBot.InlineKeyboardMarkup,
      })
    );
  }

  return sendWithRetry(() =>
    bot.sendMessage(chatIdNum, adText, {
      parse_mode:   "HTML",
      reply_markup: replyMarkup as TelegramBot.InlineKeyboardMarkup,
    })
  );
}

// Throttle: 3 soniya kanal/guruh orasida
export const POST_DELAY_MS = 3_000;
