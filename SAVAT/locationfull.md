Telegram'ning request_location: true tugmasini bosganda telefon tomonidan 3 xil natija bo'lishi mumkin:
✅ GPS yoqilgan → koordinata yuboriladi → bot oladi
❌ GPS o'chiq → telefon "GPS yoqing" deb so'raydi → user yoqsa OK, yoqmasa hech narsa yuborilmaydi
❌ User ruxsat bermadi → hech narsa yuborilmaydi
Variant 2 va 3 da bot xabar olmaydi — Telegram serverga ham bormaydi. Bot esa kutib o'tiradi (awaiting_location state'da). User ham nima qilishni bilmaydi.
💡 Yechim — 3 qatlamli yondashuv
Qatlam 1: Aniq ko'rsatma matni (avval)
Live location so'rashdan oldin aniq ko'rsatma:
📍 Joylashuvni yuborish

Doktor sizning manzilingizga yetib borishi uchun joylashuvingiz kerak.

⚠️ MUHIM: Avval telefoningizda GPS (Joylashuv) yoqilganligini tekshiring:

📱 Android:
  Sozlamalar → Joylashuv → Yoqilgan ✅

📱 iPhone:
  Sozlamalar → Maxfiylik → Joylashuv xizmatlari → Yoqilgan ✅
  Sozlamalar → Telegram → Joylashuv → "Foydalanish paytida"

Tayyor bo'lganingizda "📍 Joylashuvni yuborish" tugmasini bosing.

[ 📍 Joylashuvni yuborish ]
[ ❓ GPS yoqolmayapti ]
[ ⏭️ Keyinroq yuboraman ]
Qatlam 2: Timeout — agar location kelmasa
User tugmani bosgach 60 sekund kutamiz. Agar location kelmasa — qayta savol:
⏱️ 60 sekund o'tdi, lekin joylashuv kelmadi.

Mumkin sabablar:
  • GPS o'chiq
  • Telegram'ga joylashuv ruxsati berilmagan
  • Internet sekin

Nima qilamiz?

[ 🔄 Qayta urinib ko'rish ]
[ ❓ GPS yordam ]
[ ⏭️ Keyinroq yuboraman ]
Qatlam 3: Yordam ekrani (qadamma-qadam)
"❓ GPS yordam" bosilsa — rasmlar bilan yo'l-yo'riq:
📱 GPS qanday yoqiladi?

Android uchun:
1️⃣ Telefoningizning yuqori menyusini tushiring
2️⃣ "📍" (joylashuv) belgisini bosing — yashilga aylansin
3️⃣ Yoki: Sozlamalar → "Joylashuv" yoki "Location"
4️⃣ Yoqing
5️⃣ Botga qayting va "Joylashuvni yuborish"ni bosing

iPhone uchun:
1️⃣ Sozlamalar → Maxfiylik va xavfsizlik
2️⃣ Joylashuv xizmatlari → Yoqing
3️⃣ Telegram bo'limini toping → "Foydalanish paytida"
4️⃣ Botga qayting

[ 🔄 Tushunarli, qayta urinaman ]
[ ⏭️ Keyinroq yuboraman ]
🛠️ Texnik amalga oshirish
Avval DB'ga yangi ustun kerak — qachon location so'ralgani:
Yetarli ustunlar bor, qo'shimcha kerak emas. State bot_states ichida saqlanadi.
📝 BOT KODI O'ZGARISHLARI
📂 FAYL 1: bot/handlers/callback.ts — yoki location so'rash kodi qaysi faylda bo'lsa
1.1. Avval — location so'rash xabarini batafsil qilish
Hozirgi kodda request_location: true bilan tugma chiqaradigan blok bor. Uni quyidagi bilan almashtiring:
// ============================================
// Bron tasdiqlangach — joylashuv so'rash (uyda bemor ko'rish)
// ============================================
async function requestLocation(ctx: any, tgId: string, appointmentId: string) {
  // State'ga saqlaymiz va vaqtni belgilaymiz
  await setState(tgId, 'awaiting_location', {
    appointmentId,
    requestedAt: Date.now(),
    attemptCount: 1,
  });

  await ctx.reply(
    '📍 *Joylashuvingizni yuboring*\n\n' +
    'Doktor sizga yetib borishi uchun joylashuvingiz kerak.\n\n' +
    '⚠️ *MUHIM:* Avval telefoningizda GPS (joylashuv) yoqilganligini tekshiring!\n\n' +
    '📱 *Android:* Sozlamalar → Joylashuv → Yoqing\n' +
    '📱 *iPhone:* Sozlamalar → Maxfiylik → Joylashuv xizmatlari → Yoqing\n\n' +
    'Tayyor bo\'lganingizda quyidagi tugmani bosing:',
    {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [
          [{ 
            text: '📍 Joylashuvni yuborish', 
            request_location: true 
          }],
          [
            { text: '❓ GPS yordam' },
            { text: '⏭️ Keyinroq yuboraman' }
          ]
        ],
        resize_keyboard: true,
        one_time_keyboard: false,
      }
    }
  );
}
1.2. GPS yordam tugmasini ushlash
bot/handlers/message.ts faylda:
// ============================================
// "❓ GPS yordam" — qadamma-qadam yo'l-yo'riq
// ============================================
if (text === '❓ GPS yordam') {
  await ctx.reply(
    '📱 *GPS qanday yoqiladi?*\n\n' +
    '*Android uchun:*\n' +
    '1️⃣ Telefoningizning yuqori menyusini tushiring\n' +
    '2️⃣ "📍" (joylashuv) belgisini bosing — yashilga aylansin\n' +
    '3️⃣ Yoki: Sozlamalar → "Joylashuv" yoki "Location"\n' +
    '4️⃣ Yoqing\n' +
    '5️⃣ Botga qayting va "📍 Joylashuvni yuborish"ni bosing\n\n' +
    '*iPhone uchun:*\n' +
    '1️⃣ Sozlamalar → Maxfiylik va xavfsizlik\n' +
    '2️⃣ Joylashuv xizmatlari → Yoqing\n' +
    '3️⃣ Telegram bo\'limini toping → "Foydalanish paytida"\n' +
    '4️⃣ Botga qayting va qayta urining\n\n' +
    '_Agar muammo davom etsa, klinikaga telefon orqali bog\'laning._',
    {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [
          [{ 
            text: '📍 Joylashuvni yuborish', 
            request_location: true 
          }],
          [
            { text: '🔄 Qayta urinib ko\'rish' },
            { text: '⏭️ Keyinroq yuboraman' }
          ]
        ],
        resize_keyboard: true,
      }
    }
  );
  return;
}

// ============================================
// "🔄 Qayta urinib ko'rish"
// ============================================
if (text === '🔄 Qayta urinib ko\'rish') {
  const state = await getState(tgId);
  if (!state || state.step !== 'awaiting_location') {
    await ctx.reply('Sessiya muddati o\'tdi. /start bosing.');
    return;
  }
  
  // Attempt count yangilanadi
  const newCount = (state.data.attemptCount || 1) + 1;
  await setState(tgId, 'awaiting_location', {
    ...state.data,
    requestedAt: Date.now(),
    attemptCount: newCount,
  });
  
  await ctx.reply(
    📍 *${newCount}-urinish*\n\n +
    'Telefoningizda GPS yoqilganligini tasdiqlab, quyidagi tugmani bosing:',
    {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [
          [{ 
            text: '📍 Joylashuvni yuborish', 
            request_location: true 
          }],
          [{ text: '⏭️ Keyinroq yuboraman' }]
        ],
        resize_keyboard: true,
      }
    }
  );
  return;
}

// ============================================
// "⏭️ Keyinroq yuboraman"
// ============================================
if (text === '⏭️ Keyinroq yuboraman') {
  const state = await getState(tgId);
  if (state?.step !== 'awaiting_location') return;
  
  await ctx.reply(
    '✅ Yaxshi.\n\n' +
    'Bron qilindi, lekin joylashuv yuborilmadi.\n' +
    'Klinika xodimi siz bilan telefon orqali bog\'lanadi.\n\n' +
    '_Keyinroq joylashuvni yuborish uchun klinikaga telefon qiling._',
    {
      parse_mode: 'Markdown',
      reply_markup: {
        keyboard: [
          [
            { text: '👤 Profilim' }, 
            { text: '🏠 Uyda bemor ko\'rish' }
          ]
        ],
        resize_keyboard: true,
        is_persistent: true,
      }
    }
  );
  
  await clearState(tgId);
  return;
}
1.3. Location qabul qilish — barqaror handler
// ============================================
// 📍 Location qabul qilish (Telegramdan keladi)
// ============================================
if (ctx.message && 'location' in ctx.message && ctx.message.location) {
  const location = ctx.message.location;
  const tgId = String(ctx.from.id);
  
  const state = await getState(tgId);
  
  if (!state || state.step !== 'awaiting_location') {
    // Bemor random joylashuv yubordi (rejimdan tashqari)
    await ctx.reply(
      '📍 Joylashuv qabul qilindi, lekin u aktiv bron uchun emas.\n\n' +
      'Agar uyda bemor ko\'rish uchun joylashuv yuborayotgan bo\'lsangiz, ' +
      'avval bron qiling.',
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
  
  const appointmentId = state.data.appointmentId;
  if (!appointmentId) {
    await ctx.reply('❌ Bron topilmadi. /start bosing.');
    await clearState(tgId);
    return;
  }
  
  // DB'ga yozish
  try {
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        locationLat: location.latitude,
        locationLng: location.longitude,
        locationLivePeriod: location.live_period ?? null,
        locationSharedAt: new Date(),
      },
    });
    
    const isLive = !!location.live_period;
    const durationText = isLive 
      ? \n⏱️ Live davomiyligi: ${Math.round(location.live_period / 60)} daqiqa 
      : '';
    
    await ctx.reply(
      '✅ *Joylashuv qabul qilindi!*\n\n' +
      '📍 Doktor sizning manzilingizga yetib boradi.' + durationText + '\n\n' +
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
  } catch (err) {
    console.error('[location] DB write failed:', err);
    await ctx.reply(
      '❌ Joylashuvni saqlashda xatolik. Iltimos qayta urining yoki klinikaga qo\'ng\'iroq qiling.'
    );
  }
  return;
}
📂 FAYL 2: Timeout mantiqi (cold start safe)
⚠️ Muhim: Vercel serverless'da setTimeout ishlamaydi (function 10 sek ichida tugaydi). Shuning uchun timeout'ni stateless qilish kerak.
Yo'l: User keyingi xabar yuborganda biz state.data.requestedAt ni tekshiramiz va kerak bo'lsa avtomatik eslatma beramiz.
message.ts faylda har xabarni qabul qilish boshida:
// Boshqa text handler'lardan oldin — timeout tekshirish
const state = await getState(tgId);

if (state?.step === 'awaiting_location' && state.data.requestedAt) {
  const elapsedMs = Date.now() - state.data.requestedAt;
  const elapsedSec = Math.round(elapsedMs / 1000);
  
  // Agar 60+ sekund o'tgan va user shunchaki text yuborgan bo'lsa
  if (elapsedSec > 60 && text && !ctx.message?.location) {
    await ctx.reply(
      ⏱️ ${elapsedSec} sekund oldin joylashuv so'ragandik, lekin kelmadi.\n\n +
      'GPS yoqilganligini tekshiring va qayta urining:',
      {
        reply_markup: {
          keyboard: [
            [{ 
              text: '📍 Joylashuvni yuborish', 
              request_location: true 
            }],
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
}
🎯 Yakuniy flow (visual)
1. Bron tasdiqlandi (uyda bemor ko'rish)
   ↓
2. Bot: "📍 Joylashuvingizni yuboring (GPS yoqing)"
   [📍 Yuborish] [❓ GPS yordam] [⏭️ Keyinroq]
   ↓
   ┌──────────┬───────────┬──────────────┐
   ↓          ↓           ↓              ↓
GPS bor    GPS yo'q    User "❓"     User "⏭️"
   ↓          ↓           ↓              ↓
Location   Hech         Yordam ekrani  Bekor qilindi
keldi      narsa        + Qayta tugma  (state clear)
   ↓       kelmadi          ↓
DB'ga     User boshqa      Qayta urinish
yozildi   xabar yozdi          ↓
   ✅      ↓              GPS bor → ✅
          "60 sek o'tdi,
           qayta uring"
              ↓
           Yo'l 1 dan boshlanadi
📊 Sizdan kerak
Vazifa
Holat
1. Location so'rash matni — batafsil + 3 ta tugma
⏳ Siz
2. "❓ GPS yordam" handler
⏳ Siz
3. "🔄 Qayta urinib ko'rish" handler
⏳ Siz
4. "⏭️ Keyinroq yuboraman" handler
⏳ Siz
5. Location qabul qilish — try/catch + error xabari
⏳ Siz
6. Stateless timeout (60 sek tekshirish)
⏳ Siz
7. git push → Vercel deploy
⏳ Siz
🧪 Test sxemasi
Test 1: GPS yoqilgan
Uyda bemor ko'rish bron qiling
Tasdiqlash → location so'rovi
📍 Joylashuvni yuborish bosing
✅ DB'da locationLat/Lng to'lishi kerak
Test 2: GPS o'chiq
GPS ni telefonda o'chirib qo'ying
Tugmani bosing → telefon "GPS yoqing" deydi
Yoqmaslik → bot kutib turadi
Boshqa xabar yuboring (masalan "salom")
Bot: "60 sek o'tdi, qayta uring"
Test 3: GPS yordam
"❓ GPS yordam" bosing
Yo'l-yo'riq chiqishi kerak
Test 4: Keyinroq
"⏭️ Keyinroq yuboraman" bosing
Bron yaratilgan, lekin location yo'q (DB'da NULL)
State tozalanadi