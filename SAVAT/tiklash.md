📝 BOT KODI — Yo'nalish 2 (yangilangan mantiq)
📂 FAYL 1: prisma/schema.prisma
User modelida:
model User {
  // ... mavjud maydonlar
  
  phone  String?  @unique   // ← @unique qo'shing (agar yo'q bo'lsa)
  
  // Yangi relation
  telegramIdHistory  TelegramIdHistory[]
}
Faylning eng oxiriga:
model TelegramIdHistory {
  id              Int       @id @default(autoincrement())
  userId          String
  tibId           String
  oldTelegramId   String?
  newTelegramId   String
  reason          String?
  changedAt       DateTime  @default(now()) @db.Timestamp(6)
  
  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
  @@index([tibId])
  @@map("telegram_id_history")
}
Keyin:
npx prisma db pull
npx prisma generate
📂 FAYL 2: bot/helpers/phone.ts (yangi fayl)
// bot/helpers/phone.ts
// Telefon raqamini bitta standart formatga keltirish

const ARCHIVED_PREFIX = '[archived]';

export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  
  let cleaned = phone.replace(/[\s\-()+\.]/g, '');
  if (!/^\d+$/.test(cleaned)) return null;
  
  if (cleaned.startsWith('998')) {
    // 998xxxxxxxxx — ok
  } else if (cleaned.length === 9) {
    cleaned = '998' + cleaned;
  } else if (cleaned.length === 10 && cleaned.startsWith('0')) {
    cleaned = '998' + cleaned.slice(1);
  } else {
    return null;
  }
  
  if (cleaned.length !== 12) return null;
  return '+' + cleaned;
}

export function isValidUzbekPhone(phone: string): boolean {
  return /^\+998\d{9}$/.test(phone);
}

export function archivePhone(phone: string): string {
  // Vaqt belgisi bilan: [archived_2026-05-04T12:34:56]+998914434000
  const timestamp = new Date().toISOString().split('.')[0];
  return ${ARCHIVED_PREFIX}_${timestamp}_${phone};
}

export function isArchivedPhone(phone: string | null): boolean {
  return phone !== null && phone.startsWith(ARCHIVED_PREFIX);
}
📂 FAYL 3: Kontakt qabul qilish (asosiy mantiq)
Fayl: bot/handlers/message.ts yoki bot/handlers/contact.ts — qaerda kontakt qabul qilingan bo'lsa.
import { normalizePhone, isValidUzbekPhone, archivePhone } from '../helpers/phone';
import { setState, getState, clearState } from '../state/dbState';

if (ctx.message?.contact) {
  const rawPhone = ctx.message.contact.phone_number;
  const phone = normalizePhone(rawPhone);
  const tgId = String(ctx.from.id);
  const firstName = ctx.message.contact.first_name  ctx.from.first_name  '';
  const lastName = ctx.message.contact.last_name  ctx.from.last_name  null;
  
  // Validatsiya
  if (!phone || !isValidUzbekPhone(phone)) {
    await ctx.reply(
      '❌ Telefon raqami noto\'g\'ri formatda.\n\n' +
      'Iltimos, O\'zbekiston raqamingizni yuboring.'
    );
    return;
  }
  
  // ============================================
  // 1: Bu Telegram ID DB'da bormi?
  // ============================================
  const userByTgId = await prisma.user.findUnique({
    where: { telegramId: tgId },
  });
  
  if (userByTgId) {
    // Bu Telegram allaqachon ro'yxatdan o'tgan — odatdagidek davom etish
    await proceedToMenu(ctx, tgId, userByTgId);
    return;
  }
  
  // ============================================
  // 2: Bu telefon DB'da bormi (boshqa Telegram ID bilan)?
  // ============================================
  const userByPhone = await prisma.user.findUnique({
    where: { phone: phone },
  });
  
  if (userByPhone) {
    // ⚠️ Telefon topildi, lekin BOSHQA Telegram'da
    // User'dan SO'RAYMIZ — bu sizning eski profilingizmi?
    
    // Ism familiyasini ko'rsatish (lekin to'liq emas — xavfsizlik uchun)
    const maskedName = userByPhone.firstName 
      ? userByPhone.firstName.charAt(0) + '***' + (userByPhone.firstName.slice(-1) || '')
      : '***';
    
    // State'ga saqlaymiz — keyingi callback'da kerak bo'ladi
    await setState(tgId, 'awaiting_relink_decision', {
      pendingPhone: phone,
      pendingFirstName: firstName,
      pendingLastName: lastName,
      existingUserId: userByPhone.id,
      existingTibId: userByPhone.tibId,
    });
    
    await ctx.reply(
      🔍 *Bu telefon raqami avval ro'yxatdan o'tgan*\n\n +
      📞 ${phone}\n +
      👤 Egasi: ${maskedName}\n\n +
      Bu sizning eski profilingizmi?\n\n +
      Agar HA bo'lsa — eski ID va bron tarixingiz tiklanadi.\n +
      Agar YO'Q bo'lsa — yangi profil yaratiladi.,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Ha, mening profilim', callback_data: 'relink_yes' },
              { text: '🆕 Yo\'q, yangi boshlayman', callback_data: 'relink_no' }
            ]
          ]
        }
      }
    );
    return;
  }
  
  // ============================================
  // 3: Yangi user — odatdagidek
  // ============================================
  const newUser = await prisma.user.create({
    data: {
      telegramId: tgId,
      phone: phone,
      firstName: firstName,
      lastName: lastName,
      role: 'patient',
      clinicId: CLINIC_ID,
      updatedAt: new Date(),
      // tibId — DB trigger avtomatik beradi
    },
  });
  
  await ctx.reply(
    ✅ Ro'yxatdan o'tdingiz!\n\n🆔 ID: *${newUser.tibId}*,
    { parse_mode: 'Markdown' }
  );
  
  await proceedToMenu(ctx, tgId, newUser);
}
📂 FAYL 4: Callback handler — relink_yes va relink_no
Fayl: bot/handlers/callback.ts
import { archivePhone } from '../helpers/phone';

// ============================================
// Eski profil tiklash — HA
// ============================================
if (data === 'relink_yes') {
  const tgId = String(ctx.from.id);
  const state = await getState(tgId);
  
  if (!state || state.step !== 'awaiting_relink_decision') {
    await ctx.answerCbQuery('Sessiya muddati o\'tdi. /start bosing.');
    return;
  }
  
  const { existingUserId, existingTibId, pendingFirstName, pendingLastName } = state.data;
  
  // Eski user'ni topamiz
  const existingUser = await prisma.user.findUnique({
    where: { id: existingUserId },
  });
  
  if (!existingUser) {
    await ctx.answerCbQuery('Profil topilmadi');
    await clearState(tgId);
    return;
  }
  
  const oldTgId = existingUser.telegramId;
  
  // Audit log
  await prisma.telegramIdHistory.create({
    data: {
      userId: existingUserId,
      tibId: existingTibId,
      oldTelegramId: oldTgId,
      newTelegramId: tgId,
      reason: 'user-confirmed-relink',
    },
  });
  
  // telegramId yangilanadi
  await prisma.user.update({
    where: { id: existingUserId },
    data: {
      telegramId: tgId,
      firstName: pendingFirstName || existingUser.firstName,
      lastName: pendingLastName || existingUser.lastName,
    },
  });
  
  await ctx.answerCbQuery();
  await ctx.editMessageText(
    ✅ *Eski profilingiz tiklandi!*\n\n +
    🆔 ID: *${existingTibId}*\n +
    📞 ${existingUser.phone}\n\n +
    Barcha avvalgi bronlaringiz va ma'lumotlaringiz saqlanib qolgan.,
    { parse_mode: 'Markdown' }
  );
  
  await clearState(tgId);
  
  // Asosiy menyuga o'tkazish
  const updatedUser = { ...existingUser, telegramId: tgId };
  await proceedToMenu(ctx, tgId, updatedUser);
  return;
}

// ============================================
// Eski profil tiklash — YO'Q (yangi profil)
// ============================================
if (data === 'relink_no') {
  const tgId = String(ctx.from.id);
  const state = await getState(tgId);
  
  if (!state || state.step !== 'awaiting_relink_decision') {
    await ctx.answerCbQuery('Sessiya muddati o\'tdi. /start bosing.');
    return;
  }
  
  const { 
    pendingPhone, 
    pendingFirstName, 
    pendingLastName, 
    existingUserId 
  } = state.data;
  
  // 1) Eski user telefonini ARXIVLAYMIZ ([archived]_TIMESTAMP_+998...)
  const existingUser = await prisma.user.findUnique({
    where: { id: existingUserId },
  });
  
  if (existingUser?.phone) {
    await prisma.user.update({
      where: { id: existingUserId },
      data: { phone: archivePhone(existingUser.phone) },
    });
  }
  
  // 2) Yangi user yaratamiz (xuddi shu telefon endi bo'sh)
  const newUser = await prisma.user.create({
    data: {
      telegramId: tgId,
      phone: pendingPhone,
      firstName: pendingFirstName,
      lastName: pendingLastName,
      role: 'patient',
      clinicId: CLINIC_ID,
      updatedAt: new Date(),
      // tibId — DB trigger avtomatik beradi
    },
  });
  
  await ctx.answerCbQuery();
  await ctx.editMessageText(
    ✅ Yangi profil yaratildi!\n\n +
    🆔 ID: *${newUser.tibId}*\n +
    📞 ${pendingPhone}\n\n +
    Klinikaga kelganda ushbu ID ni ko'rsating.,
    { parse_mode: 'Markdown' }
  );
  
  await clearState(tgId);
  await proceedToMenu(ctx, tgId, newUser);
  return;
}
⚠️ proceedToMenu — sizning kodingizdagi keyingi qadam (xizmat tanlash menyusi). Hozir kodingizda u qanday chaqirilsa, shuni ishlating.
🧪 Test sxemasi
Test 1: Yangi user (yangi telefon)
Yangi TG → /start → kontakt yangi telefon
→ "Ro'yxatdan o'tdingiz! ID: tib000031"
Test 2: O'sha user qaytib keldi
Mavjud TG → /start → kontakt
→ Odatdagidek davom etadi, hech qanday savol yo'q
Test 3: 🎯 Asosiy — yangi TG, eski telefon (HA)
Yangi TG akkaunt → kontakt eski telefon (+998914434000 — Aliyev vali'niki)
→ "Bu telefon avval ro'yxatdan o'tgan. Egasi: A***v"
   [Ha, mening profilim] [Yo'q, yangi]
→ "Ha" bosadi
→ "Eski profilingiz tiklandi! ID: tib000001"
→ DB'da: telegramId yangilandi, audit log qo'shildi
Test 4: Yangi TG, eski telefon (YO'Q)
Yangi TG → kontakt eski telefon
→ "Bu telefon avval ro'yxatdan o'tgan..."
   [Ha, mening] [Yo'q, yangi]
→ "Yo'q" bosadi
→ Eski user phone = "[archived]_2026-05-04T...+998914434000"
→ Yangi user yaratiladi: tib000032, phone = +998914434000
→ "Yangi profil yaratildi! ID: tib000032"
📋 Sizdan kerak
Vazifa
Fayl
1. phone @unique + TelegramIdHistory model
prisma/schema.prisma
2. npx prisma db pull && generate
terminal
3. phone.ts helper yaratish
bot/helpers/phone.ts
4. Kontakt qabul mantiqini yangilash
bot/handlers/message.ts
5. relink_yes va relink_no callback'lari
bot/handlers/callback.ts
6. git push → Vercel deploy
terminal
7. Test 3 va Test 4 ni o'tkazish
Telegram
Tayyor bo'lgach, "qildim" deb ayting — DB'dan auditni tekshiraman.
Yordam kerak bo'lsa, fayl topishda:
findstr /S /I /N "contact" bot\handlers\*.ts
findstr /S /I /N "phone_number" bot\handlers\*.ts
