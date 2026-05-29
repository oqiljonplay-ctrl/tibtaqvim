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
  const { chat, new_chat_member, from } = update;

  // Bot ID: process.env.BOT_ID yokHa getMe() orqali
  let botId = Number(process.env.BOT_ID || 0);
  if (!botId) {
    try {
      const me = await bot.getMe();
      botId = me.id;
    } catch {
      botId = 0;
    }
  }

  const isBot = botId ? new_chat_member.user.id === botId : true;
  if (!isBot) return;

  const status = new_chat_member.status;
  const chatId = String(chat.id);
  const type = chat.type === "channel" ? "channel" : "group";

  if (status === "administrator" || status === "member") {
    const existing = await prisma.adChannel.findUnique({ where: { chatId } });

    if (!existing) {
      // Kanalga qo'shgan foydalanuvchi clinic_admin bo'lsa → scope=clinic
      let scope: "clinic" | "platform" = "platform";
      let clinicId: string | null = null;

      if (from?.id) {
        const adminUser = await prisma.user.findFirst({
          where: { telegramId: String(from.id), role: "clinic_admin" },
          select: { clinicId: true },
        });
        if (adminUser?.clinicId) {
          scope = "clinic";
          clinicId = adminUser.clinicId;
        }
      }

      await prisma.adChannel.create({
        data: {
          title:     chat.title || chatId,
          chatId,
          type,
          username:  chat.username || null,
          scope,
          clinicId,
          addedById: "auto",
          isActive:  false, // tasdiqlagunicha nofaol
        },
      });
      console.log(`[myChatMember] Yangi kanal: ${chat.title} (${chatId}) scope=${scope}`);
    } else if (!existing.isActive && status === "administrator") {
      await prisma.adChannel.update({ where: { chatId }, data: { isActive: true } });
      console.log(`[myChatMember] Kanal faollashtirildi: ${chat.title}`);
    }
  } else if (status === "kicked" || status === "left") {
    await prisma.adChannel.updateMany({
      where: { chatId },
      data:  { isActive: false },
    });
    console.log(`[myChatMember] Bot kanaldan chiqarildi: ${chat.title}`);
  }
}
