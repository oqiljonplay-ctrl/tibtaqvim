📋 BOSQICH 1 — Telegram Webhook Secret: To'liq reja
🎯 Maqsad
Sizning bot URL'iga (/api/webhook/telegram) faqat haqiqiy Telegram serverlaridan kelgan so'rovlar qabul qilinsin, soxta so'rovlar bloklansin.
🧠 Texnik tushuncha — qanday ishlaydi
Hozirgi holat (himoyasiz)
Hacker → POST /api/webhook/telegram → Bot qabul qiladi → Soxta foydalanuvchi
Yangi holat (himoyalangan)
Setup (1 marta):
  Siz → Telegram API: "Webhook URL: ..., Secret: ABC123"
  Telegram bu secret'ni eslab qoladi
  
Real ishlash:
  Telegram → POST /api/webhook/telegram
    Header: X-Telegram-Bot-Api-Secret-Token: ABC123
  Bot → Header'ni tekshiradi → ✅ → qabul qilinadi

Hujum:
  Hacker → POST /api/webhook/telegram
    Header yo'q (yoki noto'g'ri)
  Bot → 401 Unauthorized → bloklandi ❌
📊 Reja — 7 qadam
QADAM 1 — Tayyorgarlik (sizdan kerak)
Vaqt: 2 daqiqa
Quyidagilarni qo'l ostida tayyorlang:
✅ Vercel'ga kirish (env qo'shish uchun)
✅ Telegram BOT_TOKEN qiymati (Vercel env'da bor, lekin curl uchun kerak)
✅ Terminal/Command Prompt (secret yaratish va Telegram'ga yuborish uchun)
✅ VS Code (kod tuzatish)
Sizning ish: Hech narsa — faqat tayyor turish.
QADAM 2 — Kuchli secret yarating (sizdan kerak)
Vaqt: 1 daqiqa
Terminal'da:
openssl rand -hex 32
a7f3e9b2c8d1f4e6a9c2b5d8f1e4a7c0b3d6f9e2c5a8b1d4f7e0c3a6b9d2e5f8
Qoidalar:
✅ 64 belgi (256 bit) — Telegram secret uchun maksimum
✅ Faqat 0-9 va a-f (hex) — URL/header safe
✅ Tasodifiy — kriptografik darajada xavfsiz
❌ Hech qachon chat'ga yubormang
Sizning ish: Yangi terminal oching, buyruqni ishlating, natijani 3 joyga saqlang:
Parol menejer (1Password/Bitwarden) — uzoq muddatli saqlash
Notepad (vaqtinchalik, ish tugagach o'chiriladi)
Clipboard — Vercel'ga ko'chirish uchun
⚠️ MUHIM: Secret yo'qotsangiz, Telegram'da qayta sozlash kerak (lekin bot ishlay olmaydi shu vaqt davomida). Saqlang.
QADAM 3 — Vercel'ga env qo'shish (sizdan kerak)
Vaqt: 2 daqiqa
URL: https://vercel.com/oqiljonplay-ctrls-projects/tibtaqvim/settings/environment-variables
Add New bosing:
Maydon
Qiymat
Key
TELEGRAM_WEBHOOK_SECRET
Value
(QADAM 2 dagi secret)
Environments
✅ Production ✅ Preview ✅ Development
Save bosing.
⚠️ Hali deploy bo'lmaydi — Vercel sizdan redeploy so'raydi, lekin kutib turing. Avval kodni o'zgartiramiz, keyin bir martagina deploy bo'ladi.
Sizning ish: Yuqoridagi qadamlar.
Lokal .env ham yangilang (agar npm run dev ishlatsangiz):
TELEGRAM_WEBHOOK_SECRET=<o'sha secret>
QADAM 4 — Bot kodini tuzatish (sizdan kerak)
Vaqt: 5 daqiqa
Fayl: src/app/api/webhook/telegram/route.ts
Joriy boshlanish (sizning kodingiz):
import { NextRequest, NextResponse } from "next/server";
import TelegramBot from "node-telegram-bot-api";
// ... boshqa importlar

let bot: TelegramBot | null = null;

function getBot() {
  if (!bot) {
    bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { webHook: true });
  }
  return bot;
}

export async function POST(req: NextRequest) {
  // ... mavjud webhook kodi
}
O'zgartirish — POST funksiyasining eng birinchi qatorlariga quyidagini qo'shing:
export async function POST(req: NextRequest) {
  // ⚠️ XAVFSIZLIK: Telegram secret token tekshiruvi
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  
  // Env to'g'ri sozlanganmi
  if (!expected) {
    console.error("[webhook] TELEGRAM_WEBHOOK_SECRET env not configured");
    return NextResponse.json(
      { error: "Server misconfigured" }, 
      { status: 500 }
    );
  }
  
  // Secret to'g'ri keldimi
  if (secret !== expected) {
    console.warn("[webhook] Invalid secret token attempt", {
      hasSecret: !!secret,
      ip: req.headers.get("x-forwarded-for") || "unknown",
      ua: req.headers.get("user-agent")?.slice(0, 50),
    });
    return NextResponse.json(
      { error: "Unauthorized" }, 
      { status: 401 }
    );
  }
  
  // ... mavjud webhook kodi davom etadi (req.json va h.k.)
  Diqqat:
// ... mavjud webhook kodi davom etadi — bu joyga sizning mavjud kodingiz keladi (getBot(), req.json(), va h.k.)
Hech narsa o'chirilmaydi, faqat boshiga 20 qator qo'shiladi
import { NextResponse } allaqachon bor bo'lishi kerak — bo'lmasa qo'shing
Sizning ish: Yuqoridagi kodni POST funksiyasi boshiga yopishtiring.
QADAM 5 — Git commit + push (sizdan kerak)
git add src/app/api/webhook/telegram/route.ts
git commit -m "security: telegram webhook secret token validation"
git push
Vercel avtomatik deploy boshlaydi (1-2 daqiqa).
Diqqat — kritik moment:
✅ Yangi kod deploy bo'lgach, bot soxta so'rovlarni bloklaydi
⚠️ Lekin Telegram hali secret yubormaydi (chunki biz hali Telegram'ga aytmadik)
⚠️ Demak 1-2 daqiqa davomida BOT JAVOB BERMAYDI — barcha real Telegram so'rovlari ham 401 oladi
✅ Bu kutilgan holat — keyingi qadamda hal qilamiz
Sizning ish: Push qiling, Vercel deploy READY bo'lguncha kuting.
Mening ish: Deploy holatini va xato bor-yo'qligini kuzataman.
QADAM 6 — Telegram'ga webhook'ni qayta o'rnatish (sizdan kerak)
Vaqt: 2 daqiqa
⚠️ DIQQAT: Bu eng muhim qadam. Bu qilmasangiz, bot butunlay ishlamaydi.
Vaqt:
Faqat Vercel deploy READY bo'lgach qiling, oldin emas. (Men sizga aytaman qachon tayyor)
Buyruq:
Terminal'da quyidagini ishlating (qiymatlarni o'zgartirib):
# Quyidagilarni o'z qiymatlaringiz bilan almashtiring:
BOT_TOKEN="123456789:AAH..."   # <-- Vercel env'dagi TELEGRAM_BOT_TOKEN
SECRET="a7f3e9b2c8..."          # <-- QADAM 2 dagi secret

# Bu buyruqni ishlating:
curl -F "url=https://tibtaqvim.vercel.app/api/webhook/telegram" \
     -F "secret_token=${SECRET}" \
     "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook"
Kutilgan javob:
{
  "ok": true,
  "result": true,
  "description": "Webhook was set"
}
Agar ok: false chiqsa:
Token noto'g'ri yoki
URL noto'g'ri yoki
Boshqa muammo — menga xabar bering, hal qilamiz
BOT_TOKEN'ni qaerdan olish?
⚠️ Tokenni hech qachon chat'ga yubormang!
Sizda 2 ta variant:
(a) Vercel env variable'lardan ko'ring (settings sahifasida TELEGRAM_BOT_TOKEN qiymatini ko'rsatish tugmasi bor)
(b) BotFather (@BotFather Telegram'da) — /mybots → bot tanlash → API Token
Sizning ish: Bu buyruqni ishlating.

QADAM 7 — Test va tasdiqlash (birgalikda)
Vaqt: 5 daqiqa
7.1 — Real Telegram test (siz)
Telegram'da botingizni oching
/start yuboring
Bot javob berishi kerak ✅
Agar javob bersa — muvaffaqiyat, hammasi ishlayapti!
7.2 — Soxta hujum test (men)
Men curl orqali soxta so'rov yuboraman:
curl -X POST https://tibtaqvim.vercel.app/api/webhook/telegram \
  -H "Content-Type: application/json" \
  -d '{"update_id":1,"message":{"text":"/start"}}'
Kutilgan natija: 401 Unauthorized ✅
7.3 — Webhook ma'lumotini tekshirish (siz)
Terminal'da:
curl "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo"
Kutilgan:
{
  "ok": true,
  "result": {
    "url": "https://tibtaqvim.vercel.app/api/webhook/telegram",
    "has_custom_certificate": false,
    "pending_update_count": 0,
    "max_connections": 40,
    "has_secret_token": true   ← BU MUHIM!
  }
}
has_secret_token: true — bu kuchli tasdiqlash secret to'g'ri sozlanganligi haqida.
7.4 — Vercel runtime log'lar (men)
Men 5 daqiqa ichida:
401 hujumlar ko'rinmoqdami?
Real foydalanuvchilar 200 olyaptimi?
Hech qanday xato yo'qmi?
📊  taqsimot
Qadam
Kim qiladi

1. Tayyorgarlik
Siz
2. Secret yaratish
Siz
3. Vercel env qo'shish
Siz
4. Kod tuzatish
Siz
5. Git push + deploy kutish
Siz + Men 
6. Telegram webhook setup
Siz
7. Test va tasdiqlash
Siz + Men

⚠️ Xavf-xatarlar va ehtiyot choralari
Xavf 1 — Bot 1-2 daqiqa ishlamaydi
Qachon: QADAM 5 (deploy) va QADAM 6 (Telegram setup) orasida
Oqibat:
Bot Telegram'dan so'rov oladi → 401 qaytaradi
Telegram qayta urinadi (10 sekund, 1 daqiqa, 5 daqiqa intervallarda)
Real bemor xabarlar yuborilsa, ular yo'qolmaydi — Telegram saqlaydi va qayta yuboradi setup tugagach
Yumshatish:
QADAM 5 dan QADAM 6 ni darhol bajaring (kechiktirmang)
Tunda yoki past trafik vaqtida qiling (hozir ertalab 09:00 — yaxshi vaqt)
Xavf 2 — Secret yo'qotish
Qachon: Tasodifan tabxotirdan o'chirish
Oqibat: Bot butunlay ishlamaydi (Telegram noto'g'ri secret yuboradi)
Yumshatish:
3 joyda saqlash (parol menejer + notepad + Vercel env)
Vercel env dan har doim qayta olish mumkin
Yoki yangi secret yaratib, QADAM 3 va 6 ni qayta bajarish
Xavf 3 — getBot() yoki boshqa kod xato
Qachon: QADAM 4 da kodni noto'g'ri joyga qo'yish
Oqibat: Bot 500 yoki crash
Yumshatish:
Lokal npm run dev da avval test qilish (ixtiyoriy)
Yoki men kodni ko'rib chiqaman push qilishdan oldin (yuboring)
Xavf 4 — Bot polling rejimida ishlaydi
Faqat ehtimol: Sizning kod webHook: true ishlatadi. Lekin agar boshqa joyda polling bo'lsa — secret kerak emas (polling Telegram'dan o'zi tortib oladi).
Tekshirish: Vercel'da ishlayotgan kod webHook: true — bu webhook rejim, secret kerak.
🎯 Muvaffaqiyat mezonlari
Ish tugagach quyidagilarning HAMMAsi to'g'ri bo'lishi kerak:
#
Mezon
Qanday tekshirish
1
Bot real Telegram orqali javob beradi
/start yuborish
2
Soxta curl so'rovi bloklanadi
Men test qilaman
3
getWebhookInfo da has_secret_token: true
curl bilan tekshirish
4
Vercel runtime log'larda 200 (Telegram) va 401 (hacker)
Men kuzataman
5
Vercel deploy READY
Men tekshiraman
6
Audit log trigger ishlashda davom etadi
DB tekshirish
🚨 Rollback plani (agar muammo bo'lsa)
Agar nimadir noto'g'ri ketsa:
Variant A — Secret tekshirish vaqtincha o'chirish
src/app/api/webhook/telegram/route.ts da yangi qo'shilgan blokni comment qiling:
// /* TEMPORARY DISABLED
// const secret = req.headers.get("x-telegram-bot-api-secret-token");
// if (...) return ...;
// */
Push qiling → eski xulq-atvor qaytadi.
Variant B — Telegram webhook'ni eski holatda qoldirish
curl -F "url=https://tibtaqvim.vercel.app/api/webhook/telegram" \
     "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook"
(Secret yuborilmasa, Telegram secret yubormaydi — siz kodda ham comment qilgansiz)
Variant C — Vercel'da oldingi deploy ga rollback
Vercel dashboard → Deployments → oldingi → Promote to Production
📋 Yakuniy checklist (siz uchun)
Boshlamadan oldin tekshiring:
[ ] Vercel kirimi tayyor (env qo'shish uchun)
[ ] Terminal/Command Prompt ochilgan
[ ] VS Code ochilgan
[ ] Git tayyor (commit + push uchun)
[ ] BOT_TOKEN qaerdan olish bilaman
[ ] Hozirgi vaqt bot uchun past trafik (09:00 — ertalab, yaxshi)
[ ] Internet ulanish barqaror
❓ Reja tasdiqlanadimi?
Sizdan 3 ta savol:
1. Reja tushunarlimi?
(a) Ha, hamma narsa aniq, boshlaymiz
(b) Bitta-ikkita joyini qayta tushuntiring
(c) Boshqacha yondashuvni so'rayman
2. Vaqt to'g'rimi?
(a) Ha, hozir 20 daqiqa bor
(b) Keyinroq yaxshiroq bo'lar edi
(c) Bo'laklarga bo'lib qilamiz (masalan, QADAM 1-4 hozir, 5-7 keyin)
3. Avval test kerakmi?
(a) Yo'q, to'g'ridan-to'g'ri production
(b) Avval kodni siz tekshirib bering (men yuboraman, ko'rasiz)
(c) Lokal npm run dev da test, keyin push
Javob bering — keyin boshlaymiz (yoki rejaning biror joyini moslashtiramiz).