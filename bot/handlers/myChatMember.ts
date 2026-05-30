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

    // Qo'shgan foydalanuvchi clinic_admin bo'lsa → scope=clinic, clinicId=uning klinikasi
    let resolvedScope: "clinic" | "platform" = "platform";
    let resolvedClinicId: string | null = null;
    if (from?.id) {
      const adminUser = await prisma.user.findFirst({
        where: { telegramId: String(from.id), role: "clinic_admin" },
        select: { clinicId: true },
      });
      if (adminUser?.clinicId) {
        resolvedScope = "clinic";
        resolvedClinicId = adminUser.clinicId;
      }
    }

    if (!existing) {
      await prisma.adChannel.create({
        data: {
          title:     chat.title || chatId,
          chatId,
          type,
          username:  chat.username || null,
          scope:     resolvedScope,
          clinicId:  resolvedClinicId,
          addedById: "auto",
          isActive:  false, // tasdiqlagunicha nofaol
        },
      });
      console.log(`[myChatMember] Yangi kanal: ${chat.title} (${chatId}) scope=${resolvedScope}`);
    } else {
      const updates: Record<string, unknown> = {};

      // scope=platform, clinicId=null → clinic_admin qo'shsa → scope=clinic ga yangilash
      if (existing.scope === "platform" && existing.clinicId === null && resolvedClinicId) {
        updates.scope = "clinic";
        updates.clinicId = resolvedClinicId;
      }

      if (!existing.isActive && status === "administrator") {
        updates.isActive = true;
      }

      if (Object.keys(updates).length > 0) {
        await prisma.adChannel.update({ where: { chatId }, data: updates });
        console.log(`[myChatMember] Kanal yangilandi: ${chat.title} (${chatId})`, updates);
      }
    }
  } else if (status === "kicked" || status === "left") {
    await prisma.adChannel.updateMany({
      where: { chatId },
      data:  { isActive: false },
    });
    console.log(`[myChatMember] Bot kanaldan chiqarildi: ${chat.title}`);
  }
}
