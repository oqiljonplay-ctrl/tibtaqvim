✅ Vazifa (aniq va qisqa)
Mavjud kodga TEGMASLIK. Faqat bitta yangi tugma qo'shish: "📡 Jonli joylashuv" — "📍 Joylashuvni yuborish" tugmasi yoniga.
Bemor o'zi tanlaydi:
📍 Oddiy joylashuv (hozirgidek ishlaydi — kod o'zgarmaydi)
📡 Jonli joylashuv (8 soat — yangi)
Yoki ikkalasini ham ketma-ket yuboradi
📋 Plan (mavjud kodga TEGMAYMIZ)
1️⃣ DB — yangi ustunlar (live uchun alohida)
Mavjud locationLat, locationLng — bron paytidagi oddiy joylashuv (TEGMAYMIZ).
Yangi ustunlar — live location uchun alohida:
✅ DB tayyor.
📝 BOT KODI O'ZGARISHLARI (mavjud kodga tegmasdan)
📂 FAYL 1: prisma/schema.prisma
Appointment modelida — mavjud location maydonlari yonida yangilarni qo'shing:
model Appointment {
  // ... mavjud maydonlar (TEGMAYDI) ...
  
  // Mavjud (bron paytidagi oddiy joylashuv) — TEGMAYDI
  locationLat        Float?
  locationLng        Float?
  locationLivePeriod Int?
  locationSharedAt   DateTime?  @db.Timestamp(6)
  
  // YANGI — live location (alohida, real-time)
  liveLat            Float?
  liveLng            Float?
  liveStartedAt      DateTime?  @db.Timestamp(6)
  liveExpiresAt      DateTime?  @db.Timestamp(6)
  liveLastUpdatedAt  DateTime?  @db.Timestamp(6)
  liveMessageId      BigInt?
  liveStatus         String?
  
  // ... boshqa maydonlar ...
  
  @@index([liveStatus, liveExpiresAt], map: "appointments_live_active_idx")
}
Keyin:
📂 FAYL 2: Tugmalar bloki — 📡 Jonli joylashuv qo'shish
Topish: Faylda request_location: true bor joyni qidiring (location so'rash xabari yuboriladigan).
Hozirgi kod (taxminan shunday):
// ESKI — tegmaymiz, lekin keyboard'ni o'zgartiramiz
reply_markup: {
  keyboard: [
    [{ text: '📍 Joylashuvni yuborish', request_location: true }],
    [
      { text: '❓ GPS yordam' },
      { text: '⏭️ Keyinroq yuboraman' }
    ]
  ],
  resize_keyboard: true,
}
Yangi keyboard — birinchi qatorga 📡 Jonli joylashuv qo'shamiz:
reply_markup: {
  keyboard: [
    [
      { text: '📍 Joylashuvni yuborish', request_location: true },
      { text: '📡 Jonli joylashuv' }   // ← YANGI: oddiy text tugma
    ],
    [
      { text: '❓ GPS yordam' },
      { text: '⏭️ Keyinroq yuboraman' }
    ]
  ],
  resize_keyboard: true,
}
⚠️ Muhim: request_location: true faqat oddiy joylashuv beradi — bot boshqaruvi orqali "live" rejimini majburlash mumkin emas. Shuning uchun 📡 Jonli joylashuv tugmasi shunchaki matn tugmasi, u bosilganda bot ko'rsatma beradi — "Telegramda 📎 → Joylashuv → Jonli joylashuv → 8 soat tanlang".
📂 FAYL 3: bot/handlers/message.ts — 📡 Jonli joylashuv handler
Mavjud 📍 Joylashuvni yuborish mantiqi TEGMAYDI. Yoniga yangi handler qo'shing:
// ============================================
// 📡 Jonli joylashuv tugmasi — ko'rsatma berish
// ============================================
if (text === '📡 Jonli joylashuv') {
  const tgId = String(ctx.from.id);
  const state = await getState(tgId);
  
  // Faqat awaiting_location state'da ishlaydi
  if (!state || state.step !== 'awaiting_location') {
    await ctx.reply(
      '⚠️ Jonli joylashuv faqat bron jarayonida ishlaydi.\n' +
      'Avval "🏠 Uyda bemor ko\'rish" orqali bron qiling.'
    );
    return;
  }
  
  await ctx.reply(
    '📡 *Jonli joylashuv qanday yuboriladi?*\n\n' +
    'Telegram bu funksiyani _ichki menyusi_ orqali beradi:\n\n' +
    '1️⃣ Pastdagi *📎 (skrepka)* tugmasini bosing\n' +
    '2️⃣ *📍 Joylashuv* (Location)ni tanlang\n' +
    '3️⃣ Pastda *📡 Jonli joylashuvimni ulashish* yashil tugmasini bosing\n' +
    '4️⃣ Davomiyligi: *8 soatni* tanlang\n' +
    '5️⃣ Tasdiqlang ✅\n\n' +
    '_Eslatma: oddiy joylashuv ham yuborgan bo\'lsangiz, ikkalasi ham saqlanadi._\n' +
    '_Doktor yetib borguncha sizning harakatingizni real vaqtda kuzatadi._',
    {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [
          [
            { text: '📍 Joylashuvni yuborish', request_location: true },
            { text: '📡 Jonli joylashuv' }
          ],
          [
            { text: '❓ GPS yordam' },
            { text: '⏭️ Keyinroq yuboraman' }
          ]
        ],
        resize_keyboard: true,
      }
    }
  );
  return;
}
📂 FAYL 4: Location handler — live'ni alohida ushlash
Topish: Mavjud location qabul qilish bloki (if (ctx.message?.location)).
TEGMAYMIZ. Faqat shartni qo'shamiz — agar live_period bo'lsa, alohida ustunlarga yozsin:
// MAVJUD KOD (tegmaymiz):
if (ctx.message && 'location' in ctx.message && ctx.message.location) {
  const location = ctx.message.location;
  const tgId = String(ctx.from.id);
  
  const state = await getState(tgId);
  if (!state || state.step !== 'awaiting_location') {
    // ... mavjud
    return;
  }
  
  const appointmentId = state.data.appointmentId;
  // ...
  
  // ⬇️ FAQAT BU PRISMA UPDATE QISMINI O'ZGARTIRAMIZ
  
  const isLive = !!location.live_period;
  const messageId = ctx.message.message_id;
  
  if (isLive) {
    // 📡 LIVE LOCATION
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + location.live_period * 1000);
    
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        // Live ustunlari
        liveLat: location.latitude,
        liveLng: location.longitude,
        liveStartedAt: startedAt,
        liveExpiresAt: expiresAt,
        liveLastUpdatedAt: startedAt,
        liveMessageId: BigInt(messageId),
        liveStatus: 'active',
        // Mavjud locationLat/Lng — agar bo'sh bo'lsa, birinchi marta to'ldiramiz
        locationLat: location.latitude,
        locationLng: location.longitude,
        locationLivePeriod: location.live_period,
        locationSharedAt: startedAt,
      },
    });
    
    const hours = Math.round(location.live_period / 3600);
    
    await ctx.reply(
      ✅ *Jonli joylashuv qabul qilindi!*\n\n +
      📡 ${hours} soat davomida real vaqtda yangilanadi\n +
      🚗 Doktor sizning harakatingizni kuzatadi\n +
      ⏰ ${expiresAt.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}gacha aktiv\n\n +
      Klinika tez orada siz bilan bog\'lanadi.,
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
  } else {
    // 📍 ODDIY LOCATION — mavjud kod (tegmaymiz, faqat boshqa ustunlarga yozadi)
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        locationLat: location.latitude,
        locationLng: location.longitude,
        locationLivePeriod: null,
        locationSharedAt: new Date(),
      },
    });
    
    await ctx.reply(
      '✅ *Joylashuv qabul qilindi!*\n\n' +
      '📍 Doktor sizning manzilingizga yetib boradi.\n\n' +
      'Klinika tez orada siz bilan bog\'lanadi.\n\n' +
      '_Aniqroq topish uchun 📡 Jonli joylashuv ham yuborishingiz mumkin._',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          keyboard: [
            [
              { text: '📡 Jonli joylashuv ham yuborish' },
            ],
            [
              { text: '✅ Tugatish' }
            ]
          ],
          resize_keyboard: true,
          one_time_keyboard: true,
        }
      }
    );
    return;  // ⚠️ DIQQAT: state'ni tozalamayman, chunki user live ham yuborishi mumkin
  }
  
  // Faqat live yuborilgan bo'lsa state tozalanadi
  if (isLive) {
    await clearState(tgId);
  }
  return;
}
📂 FAYL 5: bot/handlers/message.ts — qo'shimcha tugmalar
Oddiy joylashuv yuborilgach, "📡 Jonli ham yuborish" va "✅ Tugatish" tugmalarini ushlash:
// ============================================
// 📡 Jonli ham yuborish (oddiy joylashuvdan keyin)
// ============================================
if (text === '📡 Jonli joylashuv ham yuborish') {
  const tgId = String(ctx.from.id);
  const state = await getState(tgId);
  
  if (!state || state.step !== 'awaiting_location') {
    await ctx.reply('Sessiya tugagan. /start bosing.');
    return;
  }
  
  await ctx.reply(
    '📡 *Jonli joylashuv qanday yuboriladi?*\n\n' +
    '1️⃣ 📎 (skrepka) → 📍 Joylashuv\n' +
    '2️⃣ 📡 *Jonli joylashuvimni ulashish* (yashil tugma)\n' +
    '3️⃣ Davomiyligi: *8 soat*\n' +
    '4️⃣ Tasdiqlang',
    {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [
          [{ text: '✅ Tugatish' }]
        ],
        resize_keyboard: true,
      }
    }
  );
  return;
}

// ============================================
// ✅ Tugatish — state'ni tozalash
// ============================================
if (text === '✅ Tugatish') {
  const tgId = String(ctx.from.id);
  await clearState(tgId);
  
  await ctx.reply(
    '✅ Tayyor! Klinika tez orada siz bilan bog\'lanadi.',
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
  return;
}
📂 FAYL 6: edited_message handler — live yangilanishlari
Live location har 60 sekundda yangilanadi, yangilanish edited_message event sifatida keladi. Yangi handler kerak.
bot/index.ts yoki bot bootstrap fayliga (qaerda bot.on(...) lar bo'lsa):
// ============================================
// 📡 Live location yangilanishlari (edited_message)
// ============================================
bot.on('edited_message', async (ctx) => {
  const editedMsg = ctx.editedMessage;
  if (!editedMsg  !('location' in editedMsg)  !editedMsg.location) return;
  
  const location = editedMsg.location;
  const messageId = BigInt(editedMsg.message_id);
  
  try {
    // Bu xabar qaysi appointment uchun? — liveMessageId orqali topamiz
    const appointment = await prisma.appointment.findFirst({
      where: { 
        liveMessageId: messageId,
        liveStatus: 'active',
      },
    });
    
    if (!appointment) return;  // Bizning bron emas
    
    const now = new Date();
    
    // Muddati tugaganmi?
    if (appointment.liveExpiresAt && appointment.liveExpiresAt < now) {
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: { liveStatus: 'expired' },
      });
      return;
    }
    
    // Yangilanishni yozish
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        liveLat: location.latitude,
        liveLng: location.longitude,
        liveLastUpdatedAt: now,
      },
    });
  } catch (err) {
    console.error('[edited_message] live update failed:', err);
  }
});
⚠️ Muhim: Telegraf'da bot.on('edited_message', ...) qo'shilishi kerak. Agar Telegraf'ning yangi versiyasi bo'lsa, sintaksis biroz farq qiladi: bot.on('edited_message:location', ...). Sizdagi versiyaga qarang.
🎯 Yakuniy flow
Bron tasdiqlandi
   ↓
"Joylashuvingizni yuboring":
   [📍 Joylashuvni yuborish] [📡 Jonli joylashuv]
   [❓ GPS yordam] [⏭️ Keyinroq]
   ↓
   ├─ Bemor 📍 oddiy yubordi
   │     ↓
   │     locationLat/Lng to'ldi (mavjud kod)
   │     ↓
   │     "✅ Qabul qilindi. 📡 Jonli ham yuborasizmi?"
   │     ↓
   │     ├─ Ha → ko'rsatma → live yuboradi → liveLat/Lng to'ldi
   │     └─ ✅ Tugatish → clearState
   │
   ├─ Bemor 📡 jonli yubordi (1-bosqichdan o'tib)
   │     ↓
   │     liveLat/Lng + locationLat/Lng ikkalasi to'ldi
   │     ↓
   │     "✅ Jonli qabul qilindi. 8 soat aktiv"
   │     ↓
   │     clearState
   │
   └─ Bemor "❓ GPS yordam" yoki "⏭️ Keyinroq" — mavjud kod
📋 Sizdan kerak
Vazifa
Holat
1. DB live ustunlari
✅ Men qildim
2. prisma/schema.prisma ga 7 ta yangi maydon
⏳ Siz
3. npx prisma db pull && generate
⏳ Siz
4. Keyboard'ga 📡 Jonli joylashuv tugmasi
⏳ Siz
5. 📡 Jonli joylashuv text handler — ko'rsatma
⏳ Siz
6. Location handler'da live_period shart
⏳ Siz
7. 📡 Jonli ham yuborish + ✅ Tugatish handler
⏳ Siz
8. edited_message event handler
⏳ Siz
9. git push → Vercel deploy
⏳ Siz
⚠️ Diqqat — eng ehtiyotlanish kerak bo'lgan joylar
Mavjud locationLat/Lng mantig'iga TEGMAYDI — frontend xarita tugmalari avvalgidek ishlaydi
Yangi liveLat/Lng alohida — frontend keyinroq qo'shamiz
edited_message handler — yangi event tipi, alohida ulanishi kerak
State'ni erta tozalamang — bemor ikkalasini ham yuborishi mumkin
Boshlang VS Code'da. Tayyor bo'lgach "qildim" deysiz, men:
Vercel deploy tasdiqlayman
DB'da liveLat/Lng/liveStatus to'layotganini tekshiraman