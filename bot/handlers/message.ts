import TelegramBot, { Message } from "node-telegram-bot-api";
import { userState } from "../state";
import { fetchServices, fetchUserByTelegramId } from "../api";
import { normalizePhone, isValidUzbekPhone } from "../helpers/phone";
import { prisma } from "@/lib/prisma";
import {
  editOrSend,
  mkNameKeyboard,
  mkAddressKeyboard,
  mkConfirmKeyboard,
  mkConfirmText,
  mkContactKeyboard,
  mkDateKeyboard,
  mkLocationKeyboard,
  mkWebAppReplyKeyboard,
} from "../helpers/render";

export async function handleMessage(bot: TelegramBot, msg: Message) {
  const chatId = msg.chat.id;
  const text = msg.text?.trim() || "";
  const state = await userState.get(chatId);

  // ─── Joylashuv (Location) ─────────────────────────────────────────────────
  if (msg.location) {
    if (!state || state.step !== "awaiting_location") {
      await bot.sendMessage(
        chatId,
        "📍 Joylashuv qabul qilindi, lekin aktiv bron topilmadi.\n\nAgar uyda bemor ko'rish uchun joylashuv yuborayotgan bo'lsangiz, avval bron qiling.",
        { reply_markup: mkWebAppReplyKeyboard(chatId) as any }
      );
      return;
    }
    const appointmentId = state.appointmentId as string | undefined;
    if (!appointmentId) {
      await bot.sendMessage(chatId, "❌ Bron topilmadi. /start bosing.");
      await userState.delete(chatId);
      return;
    }
    try {
      await prisma.appointment.update({
        where: { id: appointmentId },
        data: {
          locationLat: msg.location.latitude,
          locationLng: msg.location.longitude,
          locationLivePeriod: (msg.location as any).live_period ?? null,
          locationSharedAt: new Date(),
        },
      });
      const livePeriod = (msg.location as any).live_period as number | undefined;
      const durationText = livePeriod
        ? `\n⏱️ Davomiyligi: ${Math.round(livePeriod / 60)} daqiqa`
        : "";
      await bot.sendMessage(
        chatId,
        `✅ *Joylashuv qabul qilindi!*\n\n📍 Doktor sizning manzilingizga yetib boradi.${durationText}\n\nKlinika tez orada siz bilan bog'lanadi.`,
        { parse_mode: "Markdown", reply_markup: mkWebAppReplyKeyboard(chatId) as any }
      );
      await userState.delete(chatId);
    } catch (err) {
      console.error("[location] DB write failed:", err);
      await bot.sendMessage(
        chatId,
        "❌ Joylashuvni saqlashda xatolik. Iltimos qayta urining yoki klinikaga qo'ng'iroq qiling."
      );
    }
    return;
  }

  // ─── awaiting_location holati — matn handlerlari ──────────────────────────
  if (state?.step === "awaiting_location") {
    // GPS yordam
    if (text === "❓ GPS yordam") {
      await bot.sendMessage(
        chatId,
        "📱 *GPS qanday yoqiladi?*\n\n" +
        "*Android uchun:*\n" +
        "1️⃣ Telefoningizning yuqori menyusini tushiring\n" +
        "2️⃣ \"📍\" (joylashuv) belgisini bosing — yashilga aylansin\n" +
        "3️⃣ Yoki: Sozlamalar → \"Joylashuv\" yoki \"Location\"\n" +
        "4️⃣ Yoqing\n" +
        "5️⃣ Botga qayting va \"📍 Joylashuvni yuborish\"ni bosing\n\n" +
        "*iPhone uchun:*\n" +
        "1️⃣ Sozlamalar → Maxfiylik va xavfsizlik\n" +
        "2️⃣ Joylashuv xizmatlari → Yoqing\n" +
        "3️⃣ Telegram bo'limini toping → \"Foydalanish paytida\"\n" +
        "4️⃣ Botga qayting va qayta urining\n\n" +
        "_Agar muammo davom etsa, klinikaga telefon orqali bog'laning._",
        {
          parse_mode: "Markdown",
          reply_markup: {
            keyboard: [
              [{ text: "📍 Joylashuvni yuborish", request_location: true }],
              [{ text: "🔄 Qayta urinib ko'rish" }, { text: "⏭️ Keyinroq yuboraman" }],
            ],
            resize_keyboard: true,
          } as any,
        }
      );
      return;
    }

    // Qayta urinib ko'rish
    if (text === "🔄 Qayta urinib ko'rish") {
      const newCount = ((state.attemptCount as number) || 1) + 1;
      await userState.set(chatId, {
        ...state,
        requestedAt: Date.now(),
        attemptCount: newCount,
      });
      await bot.sendMessage(
        chatId,
        `📍 *${newCount}-urinish*\n\nTelefoningizda GPS yoqilganligini tasdiqlab, quyidagi tugmani bosing:`,
        {
          parse_mode: "Markdown",
          reply_markup: {
            keyboard: [
              [{ text: "📍 Joylashuvni yuborish", request_location: true }],
              [{ text: "⏭️ Keyinroq yuboraman" }],
            ],
            resize_keyboard: true,
          } as any,
        }
      );
      return;
    }

    // Keyinroq yuboraman
    if (text === "⏭️ Keyinroq yuboraman") {
      await bot.sendMessage(
        chatId,
        "✅ Yaxshi.\n\nBron qilindi, lekin joylashuv yuborilmadi.\nKlinika xodimi siz bilan telefon orqali bog'lanadi.",
        { reply_markup: mkWebAppReplyKeyboard(chatId) as any }
      );
      await userState.delete(chatId);
      return;
    }

    // Boshqa matn — stateless timeout tekshirish
    const requestedAt = state.requestedAt as number | undefined;
    if (requestedAt) {
      const elapsedSec = Math.round((Date.now() - requestedAt) / 1000);
      if (elapsedSec > 60) {
        await bot.sendMessage(
          chatId,
          `⏱️ *${elapsedSec} sekund oldin joylashuv so'ragandik, lekin kelmadi.*\n\n` +
          "GPS yoqilganligini tekshiring va qayta urining:",
          {
            parse_mode: "Markdown",
            reply_markup: {
              keyboard: [
                [{ text: "📍 Joylashuvni yuborish", request_location: true }],
                [{ text: "❓ GPS yordam" }, { text: "⏭️ Keyinroq yuboraman" }],
              ],
              resize_keyboard: true,
            } as any,
          }
        );
        return;
      }
    }
    return;
  }

  // ─── 🏠 Uyda bemor ko'rish ───────────────────────────────────────────────
  if (text === "🏠 Uyda bemor ko'rish") {
    const DEFAULT_CLINIC_ID = process.env.DEFAULT_CLINIC_ID || "";
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" });
    const { services } = await fetchServices(DEFAULT_CLINIC_ID, today);
    const homeService = services.find((s: any) => s.type === "home_service");
    if (!homeService || homeService.isAvailable === false) {
      await bot.sendMessage(chatId, "❌ Bu xizmat hozir mavjud emas");
      return;
    }
    const savedUser = await fetchUserByTelegramId(chatId);
    const sent = await bot.sendMessage(chatId, "📅 Qaysi kunga yozilmoqchisiz?", {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: mkDateKeyboard() },
    });
    await userState.set(chatId, {
      step: "select_date",
      clinicId: DEFAULT_CLINIC_ID,
      serviceId: homeService.id,
      serviceType: homeService.type,
      servicePrice: homeService.price ?? null,
      serviceRequiresSlot: homeService.requiresSlot ?? false,
      serviceRequiresAddress: homeService.requiresAddress ?? false,
      messageId: sent.message_id,
      _createdAt: Date.now(),
      _services: services,
      ...(savedUser?.firstName && savedUser?.phone
        ? { patientName: savedUser.firstName, patientPhone: savedUser.phone }
        : {}),
    });
    return;
  }

  if (!state || !state.step) {
    await bot.sendMessage(chatId, "Boshlash uchun /start ni bosing");
    return;
  }

  const msgId: number | undefined = state.messageId;

  // ─── Kontakt ulashish (ism kiritgandan keyin, yoki boshlang'ich) ──────────
  if (state.step === "share_contact") {
    if (msg.contact) {
      const rawPhone = msg.contact.phone_number || "";
      const phone = normalizePhone(rawPhone);
      const firstName = state.patientName || msg.contact.first_name || msg.from?.first_name || "Foydalanuvchi";
      const lastName = msg.contact?.last_name || msg.from?.last_name || null;
      const tgId = String(chatId);
      const clinicId = state.clinicId || process.env.DEFAULT_CLINIC_ID || "";

      // Phone validatsiyasi
      if (!phone || !isValidUzbekPhone(phone)) {
        await bot.sendMessage(
          chatId,
          "❌ Telefon raqami noto'g'ri formatda.\n\nIltimos, O'zbekiston raqamingizni yuboring (+998XXXXXXXXX).",
          { reply_markup: mkContactKeyboard() as any }
        );
        return;
      }

      let tibId: string | null = null;

      // ─── 1-tekshiruv: Telegram ID bilan user bormi? ───────────────────────
      const userByTgId = await prisma.user.findUnique({ where: { telegramId: tgId } });

      if (userByTgId) {
        if (userByTgId.phone !== phone) {
          const conflict = await prisma.user.findUnique({ where: { phone } });
          if (conflict && conflict.id !== userByTgId.id) {
            await bot.sendMessage(
              chatId,
              "❌ Bu telefon raqami boshqa profilga bog'langan.\n\nIltimos, klinikaga murojaat qiling."
            );
            return;
          }
          await prisma.user.update({
            where: { id: userByTgId.id },
            data: { phone, firstName, lastName: lastName ?? undefined },
          });
        }
        tibId = userByTgId.tibId;
      } else {
        // ─── 2-tekshiruv: Bu telefon bilan eski user bormi? ─────────────────
        const userByPhone = await prisma.user.findUnique({ where: { phone } });

        if (userByPhone) {
          // Bu telefon boshqa profilga tegishli — foydalanuvchidan so'raymiz
          const maskedName = userByPhone.firstName
            ? userByPhone.firstName.charAt(0) + "***" + (userByPhone.firstName.slice(-1) || "")
            : "***";

          await userState.set(chatId, {
            step: "awaiting_relink_decision",
            pendingPhone: phone,
            pendingFirstName: firstName,
            pendingLastName: lastName,
            existingUserId: userByPhone.id,
            existingTibId: userByPhone.tibId,
            clinicId,
            _services: state._services,
            _createdAt: Date.now(),
          });

          await bot.sendMessage(
            chatId,
            `🔍 *Bu telefon raqami avval ro'yxatdan o'tgan*\n\n📞 ${phone}\n👤 Egasi: ${maskedName}\n\nBu sizning eski profilingizmi?\n\nAgar HA bo'lsa — eski ID va bron tarixingiz tiklanadi.\nAgar YO'Q bo'lsa — yangi profil yaratiladi.`,
            {
              parse_mode: "Markdown",
              reply_markup: {
                inline_keyboard: [[
                  { text: "✅ Ha, mening profilim", callback_data: "relink_yes" },
                  { text: "🆕 Yo'q, yangi boshlayman", callback_data: "relink_no" },
                ]],
              },
            }
          );
          return;
        } else {
          // ─── 3: Yangi user yaratish ──────────────────────────────────────
          const newUser = await prisma.user.create({
            data: {
              telegramId: tgId,
              phone,
              firstName,
              lastName: lastName ?? undefined,
              role: "patient",
              clinicId: clinicId || undefined,
            },
          });
          tibId = newUser.tibId;
        }
      }

      await bot.sendMessage(
        chatId,
        `✅ *Kontakt qabul qilindi!*\n\n👤 Ism: *${firstName}*\n📞 Tel: *${phone}*${tibId ? `\n🆔 ID: *${tibId}*` : ""}`,
        { parse_mode: "Markdown", reply_markup: { remove_keyboard: true } as any }
      );

      // Mid-booking context: patientName + booking data already in state
      if (state.patientName && state.date) {
        const updatedState = { ...state, patientPhone: phone, tibId };

        if (state.serviceType === "home_service") {
          const sent = await bot.sendMessage(
            chatId,
            `👤 Ism: *${firstName}*\n📞 Tel: *${phone}*\n\n📍 *To'liq manzilingizni kiriting:*\n\nMasalan: Toshkent, Yunusobod 5-mavze, 12-uy 👇`,
            { parse_mode: "Markdown", reply_markup: { inline_keyboard: mkAddressKeyboard() } }
          );
          await userState.set(chatId, { ...updatedState, step: "enter_address", messageId: sent.message_id });
        } else {
          const confirmState = { ...updatedState, step: "confirm" };
          const sent = await bot.sendMessage(
            chatId,
            mkConfirmText(confirmState),
            { parse_mode: "Markdown", reply_markup: { inline_keyboard: mkConfirmKeyboard() } }
          );
          await userState.set(chatId, { ...confirmState, messageId: sent.message_id });
        }
        return;
      }

      // Boshlang'ich flow: xizmat tanlash
      const services = state._services || [];
      if (!services.length) {
        await bot.sendMessage(chatId, "⚠️ Hozirda mavjud xizmatlar yo'q. /start");
        await userState.delete(chatId);
        return;
      }

      const { mkServiceKeyboard } = await import("../helpers/render");
      const sent = await bot.sendMessage(
        chatId,
        "🏥 Qaysi xizmatdan foydalanmoqchisiz?",
        { reply_markup: { inline_keyboard: mkServiceKeyboard(services) } }
      );
      await userState.set(chatId, {
        ...state,
        step: "select_service",
        patientName: firstName,
        patientPhone: phone,
        tibId,
        messageId: sent.message_id,
        _createdAt: Date.now(),
      });
      return;
    }

    // Kontakt yuborilmadi — eslatma
    await bot.sendMessage(
      chatId,
      "📱 Iltimos, *'Kontaktni ulashish'* tugmasini bosing:\n\n_Telegram raqamingiz avtomatik yuboriladi_",
      { parse_mode: "Markdown", reply_markup: mkContactKeyboard() as any }
    );
    return;
  }

  // ─── Ism ────────────────────────────────────────────────────────────────────
  if (state.step === "enter_name") {
    if (text.length < 2) {
      await editOrSend(
        bot, chatId, msgId,
        "❌ Iltimos, to'liq ismingizni kiriting (kamida 2 belgi):\n\n👤 *Ismingizni kiriting:*\n\n_Pastga yozing_ 👇",
        mkNameKeyboard(state._nameBack || "select_date")
      );
      return;
    }

    // Agar telefon raqam allaqachon saqlangan (qaytib kelgan user) — kontakt so'ramasdan o'tamiz
    if (state.patientPhone) {
      if (state.serviceType === "home_service") {
        const newMsgId = await editOrSend(
          bot, chatId, msgId,
          `👤 Ism: *${text}*\n📞 Tel: *${state.patientPhone}*\n\n📍 *To'liq manzilingizni kiriting:*\n\nMasalan: Toshkent, Yunusobod 5-mavze, 12-uy 👇`,
          mkAddressKeyboard()
        );
        await userState.set(chatId,{ ...state, patientName: text, step: "enter_address", messageId: newMsgId });
      } else {
        const updatedState = { ...state, patientName: text, step: "confirm" };
        const newMsgId = await editOrSend(
          bot, chatId, msgId,
          mkConfirmText(updatedState),
          mkConfirmKeyboard()
        );
        await userState.set(chatId,{ ...updatedState, messageId: newMsgId });
      }
      return;
    }

    // Yangi user — kontakt ulashish talab qilinadi
    // Inline xabarni yangilaymiz (orqaga tugmasi bilan)
    const newMsgId = await editOrSend(
      bot, chatId, msgId,
      `👤 Ism: *${text}*\n\n📱 Davom etish uchun kontaktingizni ulashing:`,
      [[{ text: "⬅️ Orqaga", callback_data: `back:${state._nameBack || "select_date"}` }]]
    );
    // Reply keyboard — kontakt tugmasi
    await bot.sendMessage(
      chatId,
      "👇 Kontaktni ulashish tugmasini bosing:",
      { parse_mode: "Markdown", reply_markup: mkContactKeyboard() as any }
    );
    await userState.set(chatId, { ...state, patientName: text, step: "share_contact", messageId: newMsgId });
    return;
  }

  // ─── Manzil ──────────────────────────────────────────────────────────────────
  if (state.step === "enter_address") {
    if (text.length < 5) {
      await editOrSend(
        bot, chatId, msgId,
        `👤 Ism: *${state.patientName}*\n📞 Tel: *${state.patientPhone}*\n\n❌ Iltimos, to'liq manzil kiriting:\n\n📍 *To'liq manzilingizni kiriting:* 👇`,
        mkAddressKeyboard()
      );
      return;
    }
    const updatedState = { ...state, address: text, step: "confirm" };
    const newMsgId = await editOrSend(
      bot, chatId, msgId,
      mkConfirmText(updatedState),
      mkConfirmKeyboard()
    );
    await userState.set(chatId, { ...updatedState, messageId: newMsgId });
    return;
  }

}
