import TelegramBot, { Message } from "node-telegram-bot-api";
import { fetchUserByTelegramId, registerUserAtStart } from "../api";
import { userState } from "../state";
import {
  mkWelcomeBackKeyboard,
  mkWebAppReplyKeyboard,
  mkClinicKeyboard,
} from "../helpers/render";
import { prisma } from "@/lib/prisma";

const WEBAPP_URL =
  process.env.NEXT_PUBLIC_WEBAPP_URL ||
  (process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/webapp` : "") ||
  "https://tibtaqvim.vercel.app/webapp";

export async function handleStart(bot: TelegramBot, msg: Message) {
  const chatId = msg.chat.id;
  const chatType = msg.chat.type;
  const tgFirstName = msg.from?.first_name || "Foydalanuvchi";

  // Guruh/supergroup chatida bron oqimini boshlamaslik — deep link jo'natish
  if (chatType === "group" || chatType === "supergroup") {
    const botUsername = process.env.TELEGRAM_BOT_USERNAME || "tibtaqvim_bot";
    await bot.sendMessage(
      chatId,
      "🩺 Bron qilish uchun botni shaxsiy chatda oching 👇",
      {
        reply_markup: {
          inline_keyboard: [[
            { text: "🩺 Bron qilish", url: `https://t.me/${botUsername}?start=group` },
          ]],
        },
      }
    );
    return;
  }

  // WebApp'dan "share_phone" deep link orqali kelgan — kontakt keyboard ko'rsatish
  const startPayload = msg.text?.split(" ")[1]?.trim() ?? "";
  if (startPayload === "share_phone") {
    const { mkContactKeyboard } = await import("../helpers/render");
    await bot.sendMessage(
      chatId,
      "📱 Telefon raqamingizni ulash uchun quyidagi tugmani bosing:",
      { reply_markup: mkContactKeyboard() as any }
    );
    await userState.set(chatId, {
      step: "share_contact",
      clinicId: "",
      _services: [],
      _createdAt: Date.now(),
    });
    return;
  }

  // Profilim tugmasi
  if (WEBAPP_URL) {
    await bot.sendMessage(chatId, "👤 *Profilingizni ko'rish uchun:*", {
      parse_mode: "Markdown",
      reply_markup: mkWebAppReplyKeyboard(chatId) as any,
    });
  }

  const [savedUser, regResult] = await Promise.all([
    fetchUserByTelegramId(chatId),
    registerUserAtStart(chatId, tgFirstName),
  ]);

  const tibId = savedUser?.tibId || regResult?.tibId;

  // Klinikalar ro'yxatini olish
  const clinics = await prisma.clinic.findMany({
    where: {
      isActive:           true,
      deletedAt:          null,
      subscriptionStatus: { in: ["trial", "active"] },
    },
    select: { id: true, name: true, city: true },
    orderBy: { name: "asc" },
    take:    20,
  });

  if (!clinics.length) {
    await bot.sendMessage(chatId, "⚠️ Hozirda faol klinikalar yo'q. Keyinroq urinib ko'ring.");
    return;
  }

  // Qaytib kelgan user — profilini ko'rsatib klinika tanlatamiz
  if (savedUser?.phone) {
    const idLine = tibId ? `\n🆔 ID: *${tibId}*` : "";
    await bot.sendMessage(
      chatId,
      `👋 *Qaytib keldingiz!*\n\n👤 Ism: *${savedUser.firstName}*\n📞 Tel: *${savedUser.phone}*${idLine}\n\nUshbu ma'lumotlardan foydalanasizmi?`,
      { parse_mode: "Markdown", reply_markup: { inline_keyboard: mkWelcomeBackKeyboard() } }
    );
    await userState.set(chatId, {
      step:         "welcome_back",
      _clinics:     clinics,
      _createdAt:   Date.now(),
      patientName:  savedUser.firstName,
      patientPhone: savedUser.phone,
    });
    return;
  }

  // Klinika tanlash
  await showClinicSelection(bot, chatId, clinics);
}

export async function showClinicSelection(
  bot: TelegramBot,
  chatId: number,
  clinics?: Array<{ id: string; name: string; city?: string | null }>
) {
  const list = clinics ?? await prisma.clinic.findMany({
    where: { isActive: true, deletedAt: null, subscriptionStatus: { in: ["trial", "active"] } },
    select: { id: true, name: true, city: true },
    orderBy: { name: "asc" },
    take: 20,
  });

  // Agar faqat 1 ta klinika — avtomatik o'tkazib yuborish
  if (list.length === 1) {
    await userState.set(chatId, {
      step:      "select_branch",
      clinicId:  list[0].id,
      _clinics:  list,
      _createdAt: Date.now(),
    });
    const { showBranchOrService } = await import("./clinicFlow");
    return showBranchOrService(bot, chatId, list[0].id);
  }

  const sent = await bot.sendMessage(
    chatId,
    "🏥 *Klinikani tanlang:*",
    { parse_mode: "Markdown", reply_markup: { inline_keyboard: mkClinicKeyboard(list) } }
  );

  await userState.set(chatId, {
    step:      "select_clinic",
    _clinics:  list,
    _createdAt: Date.now(),
    messageId: sent.message_id,
  });
}
