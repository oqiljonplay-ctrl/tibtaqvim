📝 BOT KODI O'ZGARISHLARI — Yo'nalish 2
📂 FAYL 1: prisma/schema.prisma
1.1. User modelida phone ga @unique qo'shing:
model User {
  // ... mavjud maydonlar ...
  
  phone  String?  @unique   // ← @unique qo'shing
  
  // ... boshqa maydonlar ...
  
  // Yangi relation qo'shing (model oxiriga, @@... orqasidan oldin)
  telegramIdHistory  TelegramIdHistory[]
}
1.2. Faylning eng oxiriga yangi modelni qo'shing:
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
1.3. Terminalda:
npx prisma db pull
npx prisma generate
📂 FAYL 2: bot/helpers/phone.ts (yangi fayl)
To'liq mazmun:
// bot/helpers/phone.ts
// Telefon raqamini bitta standart formatga keltirish

/**
 * O'zbekiston raqamlarini +998XXXXXXXXX formatga keltiradi
 * 
 * Misollar:
 *   "998914434000"      → "+998914434000"
 *   "+998 91 443 40 00" → "+998914434000"
 *   "0914434000"        → "+998914434000"
 *   "914434000"         → "+998914434000"
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  
  // Probellar, qavslar, chiziqchalar va boshqa belgilarni olib tashlash
  let cleaned = phone.replace(/[\s\-()+\.]/g, '');
  
  // Faqat raqamlar qoldi
  if (!/^\d+$/.test(cleaned)) {
    return null; // notog'ri format
  }
  
  // Endi prefix qo'shamiz
  if (cleaned.startsWith('998')) {
    // 998xxxxxxxxx → +998xxxxxxxxx
    cleaned = cleaned;
  } else if (cleaned.length === 9) {
    // xxxxxxxxx → 998xxxxxxxxx (9 ta raqam — operator + raqam)
    cleaned = '998' + cleaned;
  } else if (cleaned.length === 10 && cleaned.startsWith('0')) {
    // 0xxxxxxxxx → 998xxxxxxxxx
    cleaned = '998' + cleaned.slice(1);
  } else if (cleaned.length === 12 && cleaned.startsWith('998')) {
    // Allaqachon 998xxxxxxxxx (12 ta raqam)
    cleaned = cleaned;
  } else {
    return null; // notog'ri uzunlik
  }
  
  // Yakuniy validatsiya: 12 ta raqam (998 + 9 ta raqam)
  if (cleaned.length !== 12) return null;
  
  return '+' + cleaned;
}

/**
 * Telefon raqami O'zbekiston formatiga to'g'ri keladimi
 */
export function isValidUzbekPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return normalized !== null && /^\+998\d{9}$/.test(normalized);
}
📂 FAYL 3: Kontakt qabul qilish — eski mantiqni yangilash
Avval qaysi faylda kontakt qabul qilinishini topish kerak. Lokal terminalda:
findstr /S /I /N "contact" bot\handlers\*.ts
findstr /S /I /N "phone_number" bot\handlers\*.ts
Bu sizga aniq fayl + qator beradi. Kutilgan fayl: bot/handlers/message.ts yoki bot/handlers/contact.ts.
Mantiq o'zgarishi (umumiy sxema):
Eski mantiq:
if (ctx.message?.contact) {
  const phone = ctx.message.contact.phone_number;
  const tgId = String(ctx.from.id);
  
  // Telegram ID bo'yicha qidirish/yaratish
  await prisma.user.upsert({
    where: { telegramId: tgId },
    create: { telegramId: tgId, phone, ... },
    update: { phone },
  });
}
Yangi mantiq:
import { normalizePhone, isValidUzbekPhone } from '@/bot/helpers/phone';

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
      'Iltimos, O\'zbekiston raqamingizni yuboring (+998XXXXXXXXX).'
    );
    return;
  }
  
  // ============================================
  // 🔍 1-tekshiruv: Bu Telegram ID bilan user bormi?
  // ============================================
  const userByTgId = await prisma.user.findUnique({
    where: { telegramId: tgId },
  });
  
  if (userByTgId) {
    // Telegram ID bilan topildi — telefon o'zgarganmi tekshiramiz
    if (userByTgId.phone !== phone) {
      // Telefon o'zgargan — yangilashimiz mumkin (lekin ehtiyotkorlik kerak)
      // Avval yangi telefon boshqa user'da bormi tekshiramiz
      const conflictingUser = await prisma.user.findUnique({
        where: { phone: phone },
      });
      
      if (conflictingUser && conflictingUser.id !== userByTgId.id) {
        // Boshqa user'da bu telefon bor — to'g'ri kelmaydi
        await ctx.reply(
          '❌ Bu telefon raqami boshqa profilga bog\'langan.\n\n' +
          'Iltimos, klinikaga murojaat qiling.'
        );
        return;
      }
      
      // Telefon yangilanadi
      await prisma.user.update({
        where: { id: userByTgId.id },
        data: { phone, firstName, lastName },
      });
    }
    
    // Davom etamiz
    await proceedToMenu(ctx, tgId, userByTgId.tibId!, userByTgId.id);
    return;
  }
  
  // ============================================
  // 🔍 2-tekshiruv: Bu telefon bilan eski user bormi?
  // ============================================
  const userByPhone = await prisma.user.findUnique({
    where: { phone: phone },
  });
  
  if (userByPhone) {
    // ⚡️ TOPILDI — eski profil yangi Telegram'ga bog'lanadi
    
    const oldTgId = userByPhone.telegramId;
    
    // Audit log yozamiz
    await prisma.telegramIdHistory.create({
      data: {
        userId: userByPhone.id,
        tibId: userByPhone.tibId!,
        oldTelegramId: oldTgId,
        newTelegramId: tgId,
        reason: 'auto-relink-via-phone',
      },
    });
    
    // telegramId ni yangilaymiz
    await prisma.user.update({
      where: { id: userByPhone.id },
      data: { 
        telegramId: tgId,
        firstName: firstName || userByPhone.firstName,
        lastName: lastName || userByPhone.lastName,
      },
    });
    
    await ctx.reply(
      ✅ *Xush kelibsiz!*\n\n +
      🔄 Avvalgi profilingiz topildi va yangi Telegram'ga ulandi.\n\n +
      🆔 ID: *${userByPhone.tibId}*\n +
      📞 Tel: ${phone}\n +
      👤 Ism: ${firstName}\n\n +
      Barcha avvalgi bronlaringiz va ma'lumotlaringiz saqlanib qolgan.,
      { parse_mode: 'Markdown' }
    );
    
    await proceedToMenu(ctx, tgId, userByPhone.tibId!, userByPhone.id);
    return;
  }
  
  // ============================================
  // 🆕 3: Yangi user yaratamiz
  // ============================================
  const newUser = await prisma.user.create({
    data: {
      telegramId: tgId,
      phone: phone,
      firstName: firstName,
      lastName: lastName,
      role: 'patient',
      clinicId: CLINIC_ID, // o'z konstantangiz
      updatedAt: new Date(),
      // tibId — DB trigger avtomatik beradi
    },
  });
  
  await ctx.reply(
    ✅ Ro'yxatdan o'tdingiz!\n\n +
    🆔 ID: *${newUser.tibId}*\n +
    Klinikaga kelganda ushbu ID ni ko'rsating.,
    { parse_mode: 'Markdown' }
  );
  
  await proceedToMenu(ctx, tgId, newUser.tibId!, newUser.id);
  }
  ⚠️ Eslatma: proceedToMenu — bu sizning kodingizdagi keyingi qadam (xizmat tanlash menyusi). Hozir kodingizda u qanday chaqirilsa — shuni ishlating. Misollar:
await showServicesMenu(ctx)
await sendServicesList(ctx)
await setState(tgId, 'choose_service', { userId, tibId }) + xizmatlar yuborish
🧪 Test sxemasi
Deploy bo'lgach quyidagi 3 ta ssenariyni testlash kerak:
Test 1: Yangi user (odatdagi flow)
Yangi Telegram akkaunt → /start → kontakt yuborish
→ Yangi tibId beriladi (masalan tib000031)
→ DB: yangi user yaratiladi
→ telegram_id_history: bo'sh
Test 2: Mavjud user (qaytib kelish)
Mavjud Telegram → /start → kontakt yuborish
→ Eski tibId qaytariladi (tib000001)
→ DB: o'zgarish yo'q
→ telegram_id_history: bo'sh
Test 3: 🎯 Asosiy test — Telegram o'zgargan user
Eski Telegram'da user tib000001, phone=+998914434000
→ Yangi Telegram akkaunti → /start → kontakt yuborish (xuddi o'sha telefon)
→ "Avvalgi profilingiz topildi va yangi Telegram'ga ulandi"
→ Eski tibId qaytariladi (tib000001)
→ DB: users.telegramId yangilanadi
→ telegram_id_history: yangi yozuv qo'shiladi
Test 3 dan keyin men menga ayting — DB'da audit log to'g'ri yozilganligini tasdiqlayman.
📊 Sizdan kerak bo'lgan ish
Vazifa
Holat
prisma/schema.prisma da phone @unique + TelegramIdHistory model
⏳ Siz
npx prisma db pull && generate
⏳ Siz
bot/helpers/phone.ts yangi fayl
⏳ Siz (yuqorida to'liq kod)
Kontakt qabul qilish mantiqini yangilash
⏳ Siz (yuqorida to'liq kod)
git push → Vercel deploy
⏳ Siz
Test 3'ni o'tkazish
⏳ Siz
DB'da auditni tasdiqlash
⏳ Men (siz aytsangiz)
❓ Yordam kerak bo'lsa
Lokal kompyuteringizda kontakt qabul qilish faylini topishda yordam kerak bo'lsa, terminaldagi findstr natijasini menga yuboring. Men aniq qaysi qatorda nima yozilishini ko'rsataman.