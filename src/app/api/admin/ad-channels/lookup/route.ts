import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, unauthorized, forbidden, error } from "@/lib/api-response";
import TelegramBot from "node-telegram-bot-api";

let _bot: TelegramBot | null = null;
function getBot(): TelegramBot {
  if (!_bot) _bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: false });
  return _bot;
}

export async function GET(req: NextRequest) {
  const user = requireAuth(req);
  if (!user) return unauthorized();

  const isSuperAdmin = user.role === "super_admin";
  const isClinicAdmin = user.role === "clinic_admin";
  if (!isSuperAdmin && !isClinicAdmin) return forbidden();

  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username")?.trim();
  if (!username) return error("username majburiy");

  // @username yoki t.me/username formatini qo'llab-quvvatlash
  const cleanUsername = username.replace(/^(https?:\/\/)?(t\.me\/|@)/, "@").replace(/^([^@])/, "@$1");

  try {
    const bot = getBot();
    const chat = await bot.getChat(cleanUsername) as {
      id: number;
      title?: string;
      username?: string;
      type: string;
      description?: string;
    };

    // Bot admin tekshiruvi
    let isAdmin = false;
    try {
      const botInfo = await bot.getMe();
      const member = await bot.getChatMember(chat.id, botInfo.id);
      isAdmin = ["administrator", "creator"].includes(member.status);
    } catch {
      isAdmin = false;
    }

    // A'zolar soni (kanallar uchun)
    let memberCount: number | null = null;
    try {
      memberCount = await bot.getChatMemberCount(chat.id);
    } catch {
      memberCount = null;
    }

    return ok({
      chatId:      String(chat.id),
      title:       chat.title || cleanUsername,
      username:    chat.username ? `@${chat.username}` : null,
      type:        chat.type === "channel" ? "channel" : "group",
      memberCount,
      isAdmin,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return error(`Kanal topilmadi: ${msg}`);
  }
}
