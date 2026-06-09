import TelegramBot, { Message } from "node-telegram-bot-api";
import { userState } from "../state";
import { fetchServices, fetchUserByTelegramId } from "../api";
import { normalizePhone, isValidUzbekPhone } from "../helpers/phone";
import { prisma } from "@/lib/prisma";
import { linkPhoneToTelegramUser } from "@/lib/identity";
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
    const livePeriod = (msg.location as any).live_period as number | undefined;
    const isLive = !!livePeriod;
    try {
      if (isLive) {
        // ─── 📡 Live location
        const startedAt = new Date();
        const expiresAt = new Date(startedAt.getTime() + livePeriod! * 1000);
        await prisma.appointment.update({
          where: { id: appointmentId },
          data: {
            liveLat: msg.location.latitude,
            liveLng: msg.location.longitude,
            liveStartedAt: startedAt,
            liveExpiresAt: expiresAt,
            liveLastUpdatedAt: startedAt,
            liveMessageId: BigInt(msg.message_id),
            liveStatus: "active",
            locationLat: msg.location.latitude,
            locationLng: msg.location.longitude,
            locationLivePeriod: livePeriod,
            locationSharedAt: startedAt,
          },
        });
        const hours = Math.round(livePeriod! / 3600);
        const expiresTime = expiresAt.toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
        await bot.sendMessage(
          chatId,
          `✅ *Jonli joylashuv qabul qilindi!*\n\n` +
          `📡 ${hours} soat davomida real vaqtda yangilanadi\n` +
          `🚗 Doktor sizning harakatingizni kuzatadi\n` +
          `⏰ ${expiresTime}gacha aktiv\n\n` +
          `Klinika tez orada siz bilan bog'lanadi.`,
          { parse_mode: "Markdown", reply_markup: mkWebAppReplyKeyboard(chatId) as any }
        );
        await userState.delete(chatId);
      } else {
        // ─── 📍 Oddiy location — state tozalanmaydi (user live ham yuborishi mumkin)
        await prisma.appointment.update({
          where: { id: appointmentId },
          data: {
            locationLat: msg.location.latitude,
            locationLng: msg.location.longitude,
            locationLivePeriod: null,
            locationSharedAt: new Date(),
          },
        });
        await bot.sendMessage(
          chatId,
          "✅ *Joylashuv qabul qilindi!*\n\n" +
          "📍 Doktor sizning manzilingizga yetib boradi.\n\n" +
          "Klinika tez orada siz bilan bog'lanadi.\n\n" +
          "_Aniqroq topish uchun 📡 Jonli joylashuv ham yuborishingiz mumkin._",
          {
            parse_mode: "Markdown",
            reply_markup: {
              keyboard: [
                [{ text: "📡 Jonli joylashuv ham yuborish" }],
                [{ text: "✅ Tugatish" }],
              ],
              resize_keyboard: true,
              one_time_keyboard: true,
            } as any,
          }
        );
        // ⚠️ state saqlanadi — user live ham yuborishi mumkin
      }
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

    // Jonli joylashuv — ko'rsatma
    if (text === "📡 Jonli joylashuv" || text === "📡 Jonli joylashuv ham yuborish") {
      await bot.sendMessage(
        chatId,
        "📡 *Jonli joylashuv qanday yuboriladi?*\n\n" +
        "Telegram bu funksiyani _ichki menyusi_ orqali beradi:\n\n" +
        "1️⃣ Pastdagi *📎 (skrepka)* tugmasini bosing\n" +
        "2️⃣ *📍 Joylashuv* (Location)ni tanlang\n" +
        "3️⃣ Pastda *📡 Jonli joylashuvimni ulashish* yashil tugmasini bosing\n" +
        "4️⃣ Davomiyligi: *8 soatni* tanlang\n" +
        "5️⃣ Tasdiqlang ✅\n\n" +
        "_Eslatma: oddiy joylashuv ham yuborgan bo'lsangiz, ikkalasi ham saqlanadi._\n" +
        "_Doktor yetib borguncha sizning harakatingizni real vaqtda kuzatadi._",
        {
          parse_mode: "Markdown",
          reply_markup: {
            keyboard: [
              [
                { text: "📍 Joylashuvni yuborish", request_location: true },
                { text: "📡 Jonli joylashuv" },
              ],
              [{ text: "✅ Tugatish" }],
            ],
            resize_keyboard: true,
          } as any,
        }
      );
      return;
    }

    // Tugatish — state tozalash
    if (text === "✅ Tugatish") {
      await userState.delete(chatId);
      await bot.sendMessage(
        chatId,
        "✅ Tayyor! Klinika tez orada siz bilan bog'lanadi.",
        { reply_markup: mkWebAppReplyKeyboard(chatId) as any }
      );
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
    const msgSched = await (async () => {
      try {
        const s = await prisma.clinicSettings.findUnique({ where: { clinicId: DEFAULT_CLINIC_ID }, select: { is24Hours: true, holidays: true } });
        if (!s) return { is24Hours: false, holidays: [] };
        return { is24Hours: s.is24Hours, holidays: Array.isArray(s.holidays) ? s.holidays as string[] : [] };
      } catch { return { is24Hours: false, holidays: [] }; }
    })();
    const sent = await bot.sendMessage(chatId, "📅 Qaysi kunga yozilmoqchisiz?", {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: mkDateKeyboard("select_service", msgSched) },
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
    // Guruh chatlarda spam yubormaslik
    if (msg.chat.type === "group" || msg.chat.type === "supergroup") return;
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

      // ─── linkPhoneToTelegramUser: markaziy identity helper ────────────────
      // Telegram user allaqachon bor deb hisoblanadi (start handler yaratgan)
      // Agar yo'q bo'lsa — avval register qilamiz
      let userByTgId = await prisma.user.findUnique({
        where: { telegramId: tgId },
        select: { id: true, phone: true, tibId: true },
      });

      if (!userByTgId) {
        // Yangi user — yaratamiz
        const created = await prisma.user.create({
          data: {
            telegramId: tgId,
            phone,
            firstName,
            lastName: lastName ?? undefined,
            role: "patient",
            clinicId: clinicId || undefined,
          },
          select: { id: true, phone: true, tibId: true },
        });
        userByTgId = created;
        tibId = created.tibId;
      } else {
        // Mavjud user — linkPhoneToTelegramUser orqali phone ulash
        const linkResult = await linkPhoneToTelegramUser(tgId, phone);

        if (linkResult.status === "conflict_two_telegram") {
          await bot.sendMessage(
            chatId,
            "❌ Bu telefon raqami boshqa Telegram foydalanuvchiga bog'langan.\n\nIltimos, klinikaga murojaat qiling."
          );
          return;
        }
        if (linkResult.status === "error") {
          await bot.sendMessage(
            chatId,
            `❌ Telefon ulashda xato: ${linkResult.message}\n\nQayta urinib ko'ring.`,
            { reply_markup: mkContactKeyboard() as any }
          );
          return;
        }
        // "already", "already_has_different", "ok" — davom etamiz
        // tibId ni eng so'nggi user'dan olamiz
        const refreshed = await prisma.user.findUnique({
          where: { telegramId: tgId },
          select: { tibId: true },
        });
        tibId = refreshed?.tibId ?? userByTgId.tibId;

        // Ism yangilash (agar Telegram'dan kelgan bo'lsa)
        if (firstName && firstName !== "Foydalanuvchi") {
          prisma.user.update({
            where: { telegramId: tgId },
            data: { firstName, ...(lastName ? { lastName } : {}) },
          }).catch(() => {});
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

  // ─── Qaramog'idagi ismi ──────────────────────────────────────────────────────
  if (state.step === "add_dep_name") {
    if (text.length < 2 || text.length > 50) {
      await bot.sendMessage(chatId, "❌ Ism 2-50 harf bo'lishi kerak. Qaytadan kiriting:");
      return;
    }
    await userState.set(chatId, { ...state, tempDepFirstName: text.trim(), step: "add_dep_lastname" });
    await bot.sendMessage(chatId,
      "Familiyasini kiriting (familiya bo'lmasa — yuboring):",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "⏭ Familiyasiz davom etish", callback_data: "dep_relation:skip_lastname" }],
            [{ text: "⬅️ Orqaga", callback_data: "patient:back" }],
          ],
        },
      }
    );
    return;
  }

  // ─── Qaramog'idagi familiyasi ─────────────────────────────────────────────
  if (state.step === "add_dep_lastname") {
    const lastName = text.trim() || null;
    await userState.set(chatId, { ...state, tempDepLastName: lastName, step: "add_dep_relation" });
    const relations = ["Onam", "Otam", "O'g'lim", "Qizim", "Xotinim", "Erim", "Aka", "Singil", "Boshqa"];
    await bot.sendMessage(
      chatId,
      "Kim bo'ladi? (tugmadan tanlang yoki o'tkazib yuboring)",
      {
        reply_markup: {
          inline_keyboard: [
            ...relations.map((r) => [{ text: r, callback_data: `dep_relation:${r}` }]),
            [{ text: "⏭ O'tkazib yuborish", callback_data: "dep_relation:skip" }],
          ],
        },
      }
    );
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
