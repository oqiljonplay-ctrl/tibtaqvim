import TelegramBot from "node-telegram-bot-api";
import { prisma } from "@/lib/prisma";

interface MyChatMemberUpdate {
  chat: { id: number; title?: string; username?: string; type: string };
  from: { id: number };
  new_chat_member: { user: { id: number }; status: string };
}

export async function handleMyChatMember(
  bot: TelegramBot,
  update: MyChatMemberUpdate
): Promise<void> {
  const { chat, new_chat_member } = update;
  const botId = Number(process.env.BOT_ID || 0);
  const isBot = new_chat_member.user.id === botId || !botId;

  if (!isBot) return;

  const status = new_chat_member.status;

  if (status === "administrator" || status === "member") {
    // Bot admin qilingan — kanal ro'yxatda yo'q bo'lsa pending holatда qo'shish
    // scope="platform" default; super_admin paneldan clinicId va scope sozlaydi
    const chatId = String(chat.id);
    const type = chat.type === "channel" ? "channel" : "group";

    const existing = await prisma.adChannel.findUnique({ where: { chatId } });
    if (!existing) {
      await prisma.adChannel.create({
        data: {
          title:     chat.title || chatId,
          chatId,
          type,
          username:  chat.username || null,
          scope:     "platform",
          addedById: "auto",
          isActive:  false, // super_admin tasdiqlagunicha nofaol
        },
      });
      console.log(`[myChatMember] Yangi kanal aniqlandi: ${chat.title} (${chatId})`);
    } else if (!existing.isActive && status === "administrator") {
      // Bot qayta admin qilindi — faollashtirish
      await prisma.adChannel.update({ where: { chatId }, data: { isActive: true } });
    }
  } else if (status === "kicked" || status === "left") {
    // Bot chiqarib yuborildi — deactivate
    const chatId = String(chat.id);
    await prisma.adChannel.updateMany({
      where:  { chatId },
      data:   { isActive: false },
    });
    console.log(`[myChatMember] Bot kanaldan chiqarildi: ${chat.title} (${chatId})`);
  }
}
