import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, unauthorized, forbidden, notFound } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import TelegramBot from "node-telegram-bot-api";

let _bot: TelegramBot | null = null;
function getBot(): TelegramBot {
  if (!_bot) _bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: false });
  return _bot;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = requireAuth(req);
  if (!user) return unauthorized();

  const isSuperAdmin = user.role === "super_admin";
  const isClinicAdmin = user.role === "clinic_admin";
  if (!isSuperAdmin && !isClinicAdmin) return forbidden();

  const channel = await prisma.adChannel.findUnique({ where: { id: params.id } });
  if (!channel) return notFound("Kanal topilmadi");
  if (isClinicAdmin && channel.clinicId !== user.clinicId) return forbidden();

  try {
    const bot = getBot();
    const botInfo = await bot.getMe();
    const member = await bot.getChatMember(Number(channel.chatId), botInfo.id);
    const isAdmin = ["administrator", "creator"].includes(member.status);
    return ok({ isAdmin, status: member.status, botId: botInfo.id, botUsername: botInfo.username });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return ok({ isAdmin: false, status: "error", error: msg });
  }
}
