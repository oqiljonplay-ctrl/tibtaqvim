🎯 Vazifa nima qilinishini aniq tushundim
Yangi tugma qo'shish: Pastki menyuda "🏠 Uyda bemor ko'rish" — Profilim'ning o'ng tomoniga
Mantiq o'zgarmaydi: Mavjud "Uyda bemor ko'rish" xizmati ketma-ketligi qanday bo'lsa, shunday qoladi
Faqat 1 ta yangilik: Bron tasdiqlangandan keyin → bot Telegram live location (jonli joylashuvni ulashish) so'raydi → user joylashuvni yuboradi → DB'ga saqlanadi (xodim doktor uyga borishi uchun)
📂 1-fayl: Pastki menyuga tugma qo'shish
Fayl: bot/handlers/start.ts yoki bot/keyboards.ts (qaerda Profilim tugmasi bor bo'lsa)
Profilim so'zini qidiring. Topgach reply_keyboard topiladi:
// ❌ ESKI
reply_markup: {
  keyboard: [
    [{ text: '👤 Profilim' }]
  ],
  resize_keyboard: true,
  is_persistent: true,
}
// ✅ YANGI
reply_markup: {
  keyboard: [
    [
      { text: '👤 Profilim' },
      { text: '🏠 Uyda bemor ko\'rish' }   // ← yangi tugma o'ng tomonda
    ]
  ],
  resize_keyboard: true,
  is_persistent: true,
}
📂 2-fayl: Tugma bosilganda mavjud xizmatga yo'naltirish
Fayl: bot/handlers/message.ts
Faylda Profilim matnini ushlaydigan handler bor (if (text === '👤 Profilim') shaklida). Uning yoniga yangi handler qo'shing:
// 🏠 Uyda bemor ko'rish — to'g'ridan-to'g'ri xizmat tanlanganidek davom etadi
if (text === '🏠 Uyda bemor ko\'rish') {
  // Mavjud xizmat ID'sini topib (DB'da "Uyda bemor ko'rish" yoki shunga o'xshash)
  // to'g'ridan-to'g'ri xizmat tanlangan kabi davom etamiz
  
  const homeService = await prisma.service.findFirst({
    where: { 
      clinicId: CLINIC_ID, 
      name: { contains: 'Uyda', mode: 'insensitive' } 
    },
  });
  
  if (!homeService) {
    await ctx.reply('❌ Bu xizmat hozir mavjud emas');
    return;
  }
  
  // Mavjud "service tanlangan" callback'ni chaqiramiz
  // Ya'ni xuddi user inline tugmadan tanlagandek
  await handleServiceSelected(ctx, homeService.id, tgId);
  return;
}
⚠️ handleServiceSelected — sizning kodingizdagi haqiqiy funksiya nomi bilan almashtiriladi. bot/handlers/callback.ts'da service_* callback bosilganda chaqiriladigan funksiyani toping.
📂 3-fayl: DB'ga liveLocation ustunini qo'shish
Avval DB tomondan men qilaman:
✅ DB tayyor. Endi sizdan kerak: prisma/schema.prisma da Appointment modeliga shularni qo'shing:
model Appointment {
  // ... mavjud maydonlar ...
  
  locationLat        Float?     // ← YANGI
  locationLng        Float?     // ← YANGI
  locationAddress    String?    // ← YANGI
  locationLivePeriod Int?       // ← YANGI
  locationSharedAt   DateTime?  @db.Timestamp(6)  // ← YANGI
  
  // ... boshqa maydonlar ...
}
Keyin
npx prisma db pull
npx prisma generate
📂 4-fayl: Bron tasdiqlangach — joylashuv so'rash
Fayl: Appointment yaratiladigan joy (ehtimol bot/handlers/callback.ts "tasdiqlash" qismida yoki bot/api.ts'da)
prisma.appointment.create qo'shilgandan keyin, tasdiqlash xabari yuborilgach, quyidagini qo'shing:
// ============================================
// Agar xizmat "Uyda bemor ko'rish" bo'lsa — joylashuv so'raymiz
// ============================================
const service = await prisma.service.findUnique({
  where: { id: appointment.serviceId },
});

const isHomeVisit = service?.name?.toLowerCase().includes('uyda');

if (isHomeVisit) {
  // State'ga "joylashuv kutilmoqda" rejimini saqlaymiz
  await setState(tgId, 'awaiting_location', {
    appointmentId: appointment.id,
  });
  
  await ctx.reply(
    '📍 *Joylashuvingizni ulashing*\n\n' +
    'Doktor sizning uyingizga borishi uchun *jonli joylashuvni* (Live Location) yuboring.\n\n' +
    '👉 Skrepka (📎) tugmasini bosing → *Joylashuv* (Location) → *Live location*ni tanlang → kamida *1 soat* davomiylikni belgilang.\n\n' +
    'Yoki shunchaki bir martalik joylashuv ham yuborishingiz mumkin.',
    {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [
          [{ 
            text: '📍 Joylashuvni yuborish', 
            request_location: true   // ← Telegram'ning native location tugmasi
          }],
          [{ text: '⏭️ Keyinroq yuboraman' }]
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      }
    }
  );
}

📂 5-fayl: Joylashuv qabul qilish
Fayl: bot/handlers/message.ts
Telegramdan location tipidagi xabar alohida event sifatida keladi. Faylga yangi handler qo'shing (text handler'lardan tashqari):
// ============================================
// Joylashuv (Location) qabul qilish
// ============================================
if (ctx.message && 'location' in ctx.message) {
  const location = ctx.message.location;
  const tgId = String(ctx.from.id);
  
  const state = await getState(tgId);
  
  if (!state || state.step !== 'awaiting_location') {
    // Foydalanuvchi tasodifan joylashuv yuborgan, e'tibor bermaymiz
    return;
  }
  
  const appointmentId = state.data.appointmentId;
  
  if (!appointmentId) {
    await ctx.reply('❌ Appointment topilmadi. Iltimos, /start bosing.');
    await clearState(tgId);
    return;
  }
  
  // DB'ga saqlash
  await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      locationLat: location.latitude,
      locationLng: location.longitude,
      locationLivePeriod: location.live_period ?? null,  // live bo'lsa raqam, oddiy bo'lsa null
      locationSharedAt: new Date(),
    },
  });
  
  const isLive = !!location.live_period;
  const durationText = isLive 
    ? \n⏱️ Davomiyligi: ${Math.round(location.live_period / 60)} daqiqa 
    : '';
  
  await ctx.reply(
    '✅ *Joylashuv qabul qilindi*\n\n' +
    📍 Doktor sizning manzilingizga yetib boradi.${durationText}\n\n +
    'Klinika tez orada siz bilan bog\'lanadi.',
    { 
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [
          [{ text: '👤 Profilim' }, { text: '🏠 Uyda bemor ko\'rish' }]
        ],
        resize_keyboard: true,
        is_persistent: true,
      }
    }
  );
  
  await clearState(tgId);
  return;
}
"Keyinroq yuboraman" tugmasini ushlash
Yana message.ts'da, text handler ichida:
if (text === '⏭️ Keyinroq yuboraman') {
  await ctx.reply(
    'Yaxshi. Joylashuvni keyinroq yuborishingiz mumkin.\n\n' +
    'Klinika xodimi siz bilan telefon orqali bog\'lanadi.',
    {
      reply_markup: {
        keyboard: [
          [{ text: '👤 Profilim' }, { text: '🏠 Uyda bemor ko\'rish' }]
        ],
        resize_keyboard: true,
        is_persistent: true,
      }
    }
  );
  await clearState(tgId);
  return;
}
📂 6-fayl (ixtiyoriy): Live location yangilanishi
⚠️ Muhim texnik nuqta: Telegram live location'ni vaqt o'tgan sayin yangilab turadi (har 60 sekundda). Yangilanish edited_message event sifatida keladi, oddiy message emas.
Agar live location yangilanishlarini ham saqlab borishni xohlasangiz, alohida handler kerak. Hozir bu shart emas — bitta to'g'ri joylashuv yetarli, doktor uyga borish uchun. Lekin keyinchalik kerak bo'lsa qilamiz.
🧪 Test sxemasi
/start bosing → Pastki menyuda 2 ta tugma ko'rinishi kerak: 👤 Profilim | 🏠 Uyda bemor ko'rish
🏠 Uyda bemor ko'rish bosing → odatdagi xizmat tanlanganidek davom etadi
Sana → Vaqt → Tasdiqlash
Tasdiqlash xabaridan keyin → "📍 Joylashuvingizni ulashing" so'rovi
Telegramda: 📎 → Location → Live location → 1 soat
Bot: "✅ Joylashuv qabul qilindi"
DB'da appointments.locationLat, locationLng, locationLivePeriod to'lganini men tekshiraman
Agar bot/handlers/ ichida Profilim tugmasi qaysi faylda ekanligini topa olmasangiz:
findstr /S /I /N "Profilim" bot\*.ts
findstr /S /I /N "request_location" bot\*.ts