📋 TIBTAQVIM LOYIHASI — DAVOM ETTIRISH BRIFI
🎯 LOYIHA HAQIDA QISQACHA
Tibtaqvim — klinika boshqaruv tizimi:
Backend: Next.js 14 (App Router) + Prisma + PostgreSQL (Supabase)
Frontend: React + Tailwind CSS
Deploy: Vercel (serverless, GitHub Actions orqali avtomatik)
Bot: Telegram bot (Next.js API route sifatida — /api/webhook/telegram)
Auth: Custom JWT (jsonwebtoken + bcryptjs), middleware orqali jose (Edge runtime)
Repo: oqiljonplay-ctrl/tibtaqvim (GitHub)
Production URL: https://tibtaqvim.vercel.app
Asosiy foydalanuvchi rollari:
super_admin — barcha klinikalar
clinic_admin — bitta klinika
doctor — o'z bemorlari
receptionist — qabulxona
patient — bemor (faqat Telegram bot orqali)
✅ BUGUN BAJARILGAN ISHLAR (TARIXIY TARTIBDA)
Bir kun ichida 8 ta katta funksiya muvaffaqiyatli ishga tushirildi:
1. tibId race condition fix
PostgreSQL tib_id_seq sequence yaratildi
generate_tib_id() funksiya (atomik)
assign_tib_id_on_insert() BEFORE INSERT trigger
users.tibId UNIQUE constraint
Bot kodida MAX+1 mantig'i olib tashlandi (Prisma direct DB)
2. bot_states cold start fix
In-memory Map o'rniga DB jadval (bot_states)
Vercel serverless cold start'ga bardoshli
TTL 30 daqiqa, har UPDATE'da avtomatik uzaytiriladi
cleanup_expired_bot_states() funksiyasi
Bot kodida getState/setState/clearState DB-backed bo'ldi
3. "O'zgartirish" → "Qaramog'imda" rename
Tugma matni o'zgartirildi (callback_data o'zgarmadi)
Foydalanuvchi o'z telefoni bilan boshqa odam uchun bron qila oladi
4. Telefon orqali eski tibId tiklash (relink)
users.phone UNIQUE constraint
telegram_id_history audit jadvali
bot/helpers/phone.ts — normalizePhone, archivePhone
Yangi Telegram'dan kelgan eski telefon → "Eski profilingiz tiklansinmi?" so'roq
relink_yes / relink_no callback handler'lar
"Yo'q" tanlansa eski telefon [archived]_TIMESTAMP_+998... formatga aylanadi
5. Uyda bemor ko'rish + 3 ta xarita tugmasi
Pastki menyuda "🏠 Uyda bemor ko'rish" tugmasi
Bron flow: sana → manzil matn → tasdiq
src/lib/locationLinks.ts — Yandex/2GIS/Google URL generator
src/components/LocationButtons.tsx — 3 ta tugma komponenti
Doctor va Reception panelida home_service uchun ko'rinadi
6. Jonli joylashuv (8 soat) + edited_message
DB ustunlar: liveLat, liveLng, liveStartedAt, liveExpiresAt, liveLastUpdatedAt, liveMessageId (BigInt), liveStatus
Index: appointments_live_active_idx
Bot keyboard'da "📡 Jonli joylashuv" tugmasi qo'shildi (oddiy joylashuv yonida)
Location handler: live_period shartiga ko'ra oddiy va live'ga ajratiladi
edited_message event handler — har 60 sekundlik yangilanish DB'ga yoziladi
7. BigInt JSON serialization fix
liveMessageId BigInt ni JSON'ga aylantirishda muammo edi
src/lib/bigint-fix.ts — global BigInt.prototype.toJSON = String
src/lib/prisma.ts'ga import './bigint-fix' qo'shildi
/api/appointments 500 xatosi yo'qoldi
8. Web panel real-time live xarita modal
src/components/LiveLocationPanel.tsx — yashil pulsatsion indikator
src/components/LiveMapModal.tsx — Yandex iframe modal + har 15 sek auto-refresh
src/app/api/appointments/[id]/live/route.ts — yengil endpoint (faqat live maydonlari)
Doctor va Reception panellariga integratsiya
9. KPI Dashboard — Bosqich 1 (TUGADI)
src/lib/stats/access.ts — rol bo'yicha filter mantiqi
src/lib/stats/queries.ts — 12 ta parallel KPI query
src/app/api/stats/route.ts — API endpoint (requireAuth himoyalangan)
src/components/stats/KpiCards.tsx — 8 ta gradient kartochka
src/app/stats/page.tsx — server component, JWT verifyToken bilan himoyalangan
Tugma admin va doctor panellariga qo'shildi
Middleware'ga /stats yo'li qo'shildi
Test natijalari: super_admin uchun 8 bron bugun, 14 hafta, 33 oy, daromad 100,000 so'm, 18 yangi bemor, 13 aktiv, 33% konversiya, 1 aktiv jonli (Aliyev vali)

🛑 ISHIMIZ QAYERDA TO'XTADI
Bosqich 1 — KPI Dashboard tugadi va ishga tushdi.
Hozir Bosqich 2 — 4 ta grafik komponenti boshlanmoqda.
Men yangi fayl src/lib/stats/charts.ts ni yozayotgan edim. Faylning birinchi versiyasi yozildi, lekin DB'da time ustuni mavjudligini tekshirib ko'rdik va time ustuni topilmadi — bu Prisma schema'da bor, lekin DB jadvalida boshqa nom bilan saqlanishi mumkin yoki slot jadvaliga ko'chirilgan. Aniqlashtirish kerak.
🎯 ENDI QILINADIGAN ISH — BOSQICH 2 BATAFSIL
Maqsad
KPI kartochkalari ostiga 4 ta interaktiv grafik qo'shish. Mavjud kodga TEGMASLIK, faqat yangi fayllar yaratish.
Yaratiladigan grafiklar:
📈 Kunlik bron trend — oxirgi 30 kun chiziqli grafik (line chart, 2 ta chiziq: bron'lar va keldi)
🥧 Xizmatlar bo'yicha donut — joriy oyda qaysi xizmat ko'p talabda (pie chart)
📊 Doktor band'ligi — joriy oyda har doktor nechta bron qabul qildi (horizontal bar chart)
⏰ Soatlar bo'yicha — qaysi soatda gavjum (vertical bar chart, 0-23)
Texnik talab
Recharts kutubxonasi — npm install recharts
Tailwind CSS bilan moslashtirilgan dizayn
Mobil responsive
Loading skeleton holatlar
Bo'sh ma'lumot uchun fallback xabar
Yaratiladigan fayllar (8 ta yangi):
Fayl yo'li
Vazifasi
src/lib/stats/charts.ts
4 ta grafik uchun SQL aggregate funksiyasi (fetchChartsData)
src/app/api/stats/charts/route.ts
Yangi API endpoint (mavjud /api/stats ga tegmaymiz)
src/components/stats/charts/DailyTrendChart.tsx
Line chart (recharts)
src/components/stats/charts/ServicesPieChart.tsx
Donut chart
src/components/stats/charts/DoctorsBarChart.tsx
Horizontal bar
src/components/stats/charts/HoursBarChart.tsx
Vertical bar
src/components/stats/StatsCharts.tsx
4 ta grafikni birlashtiruvchi wrapper, data fetch va loading state
(mavjud) src/app/stats/page.tsx
BITTA QATOR qo'shamiz: <StatsCharts /> — bo'sh joyga "📈 Grafiklar — keyingi bosqichda qo'shiladi" matni o'rniga
Tegilmaydigan fayllar:
❌ src/lib/stats/access.ts
❌ src/lib/stats/queries.ts
❌ src/app/api/stats/route.ts
❌ src/components/stats/KpiCards.tsx
❌ Bot kodi
❌ DB sxema (yangi ustun kerak emas)
❌ Boshqa hech narsa
Auth pattern
Sizning loyihada custom JWT auth:
Typescript
const auth = requireAuth(req);
if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
if (!['super_admin', 'clinic_admin', 'doctor'].includes(auth.role)) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
// auth.userId, auth.clinicId, auth.role
requireAuth qaerda eksport qilinadi: @/lib/auth
requireAuth 3 qatorlik funksiya: token oladi → verifyToken qiladi → { userId, clinicId, role } yoki null qaytaradi.
Doctor uchun maxsus filter
auth.role === 'doctor' bo'lsa, prisma.doctor.findFirst({ where: { userId: auth.userId, clinicId: auth.clinicId } }) orqali doctorId topib scope.doctorId'ga qo'yish kerak. Aks holda doctor barcha bemorlarni ko'radi (xato).
Scope mantiqi (mavjud access.ts'dan)
Typescript
super_admin → { clinicId: null, doctorId: null }      // barcha
clinic_admin → { clinicId: 'xxx', doctorId: null }    // o'z klinika
doctor → { clinicId: 'xxx', doctorId: 'yyy' }         // o'z bemorlari
buildAppointmentsWhere(scope) funksiyasi mavjud — undan foydalaning.
⚠️ MUHIM TEKSHIRUV — AVVAL QILINSIN
Davom etishdan oldin appointments jadvalida vaqt qaysi ustunda saqlanishini aniqlashtirish kerak.
Supabase MCP orqali quyidagi SQL ishga tushirilsin:
Sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'appointments'
ORDER BY ordinal_position;
Yoki Prisma schema'sida Appointment model'iga qarash kerak. Vaqt ustuni qaysi nom bilan saqlanyapti?
Mumkin variantlar:
time (string "14:00")
startTime (DateTime)
appointmentTime
Yo'q (vaqt slotda alohida)
Soatlar grafigi shu maydonga bog'liq. Agar topilmasa, hozir bu grafikni slots jadvalidan olish kerak.
📊 DB JORIY HOLAT (TASDIQLANGAN)
Code
appointments: 68 ta yozuv
  ├─ Status: booked / arrived / missed / cancelled
  ├─ Live aktiv: 1 ta (Aliyev vali, 8 soatlik)
  ├─ Eng eski: 2026-04-28
  └─ Eng yangi: 2026-06-01

users: 29 ta
  ├─ patient: 25 ta
  ├─ Xodimlar: 4 ta (clinic_admin, doctor, receptionist, super_admin)
  └─ tibId siz: 0 (hammasi avtomatik bor)

services: 6 ta
doctors: 4 ta (firstName + lastName)
Joriy oy (may 2026):
33 ta bron qilingan
1 ta keldi (arrived)
2 ta kelmadi (missed)
30 ta hali booked holatda
🎨 STATS SAHIFA DIZAYNI
Joriy src/app/stats/page.tsx tuzilmasi:
Code
┌─────────────────────────────────────────┐
│ 📊 Statistika      [← Asosiy sahifa]    │
│ subtitle (rolga qarab)                  │
├─────────────────────────────────────────┤
│ Asosiy ko'rsatkichlar                   │
│ <KpiCards />  ← 8 ta kartochka          │
├─────────────────────────────────────────┤
│ ⬇️ SHU JOYGA QO'SHAMIZ                   │
│ <StatsCharts />                         │
│ ├ DailyTrendChart                       │
│ ├ ServicesPieChart                      │
│ ├ DoctorsBarChart                       │
│ └ HoursBarChart                         │
└─────────────────────────────────────────┘
Hozir bo'sh joy bor:
Tsx
<section className="mb-8">
  <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">
    📈 Grafiklar va tahlillar — keyingi bosqichda qo'shiladi
  </div>
</section>
Bu blok o'rniga <StatsCharts /> komponenti qo'yiladi.
🚀 ENDI NIMA QILINSIN — TARTIB
Avval: Supabase MCP orqali appointments jadvalining barcha ustunlarini tekshirish (vaqt qayerda?)
npm install recharts — bog'liqlik o'rnatish (siz qilasiz)
src/lib/stats/charts.ts — SQL aggregate funksiyasini yozish (Claude beradi)
src/app/api/stats/charts/route.ts — API endpoint (Claude beradi)
src/components/stats/charts/DailyTrendChart.tsx — line chart
src/components/stats/charts/ServicesPieChart.tsx — donut
src/components/stats/charts/DoctorsBarChart.tsx — bar
src/components/stats/charts/HoursBarChart.tsx — bar
src/components/stats/StatsCharts.tsx — wrapper
src/app/stats/page.tsx — bo'sh blokni <StatsCharts /> bilan almashtirish
git add . && git commit -m "feat: stats charts bosqich-2 — 4 ta grafik"
git push → Vercel avtomatik deploy
Yangi Claude akkaunt deploy log'larini Vercel MCP orqali tekshiradi
DB'da hisoblangan qiymatlar to'g'riligini Supabase MCP orqali tasdiqlaydi
Bug bo'lsa — tuzatamiz
🔐 ISHLASH MODELI
Code
Yangi Claude (chat)        Foydalanuvchi (VS Code)        GitHub                Vercel
       │                          │                            │                     │
       ├─ SQL → Supabase MCP      │                            │                     │
       ├─ Kod beradi (matn)  ───► copy-paste                   │                     │
       │                          ├─ git commit                │                     │
       │                          ├─ git push ───────────────► trigger              ►│
       │                                                                              ├─ Build
       │                                                                              ├─ Deploy
       ◄── Vercel MCP orqali deploy/log tekshiradi ─────────────────────────────────┘
Foydalanuvchi: GitHub bilan barcha operatsiyalarni (commit, push) o'zi qiladi. Claude faqat kod yozadi va kuzatadi.
📝 BOSHQA KELAJAK YO'NALISHLAR (KEYINGI BOSQICHLAR)
Bosqich 2 tugagach, foydalanuvchi tanlash uchun:
Bosqich 3 — hudud bo'yicha xarita (uyda bemor ko'rish heatmap)
Bosqich 4 — davr tanlash filter (kun/hafta/oy/yil)
🔔 Doktor Telegram bildirishnoma — yangi chaqiruv keldi
⏰ Bron eslatma — 24 soat oldin avtomatik xabar
📱 SMS bildirishnoma — Telegram'siz bemorlar uchun
🐛 Mayda tuzatishlar (tib000009 da <ID> bug)
🗺 Stats sahifasiga davr selector (hozir hardcode "joriy oy/hafta")
💡 MUHIM PRINSIPLAR (FOYDALANUVCHI TALAB QILGAN)
Mavjud kodga TEGMASLIK — faqat yangi fayllar
Bosqichma-bosqich deploy — kichik o'zgarishlar, har biri test qilinadi
3 qatlamli tasdiqlash — Claude DB'ni tekshiradi, deploy log'larni ko'radi, foydalanuvchi real test qiladi
Aniq fayl yo'li va to'liq tayyor kod — foydalanuvchi shunchaki copy-paste qiladi
Auth pattern saqlanadi — requireAuth + verifyToken (custom JWT)
TypeScript xato yo'q — har deploy oldidan kod toza bo'lishi kerak
🎬 YANGI CLAUDE UCHUN BIRINCHI XABAR
Foydalanuvchi yangi Claude'ga shunday yozishi kerak:
"Salom. Tibtaqvim loyihasida ishlayman. Vercel va Supabase MCP ulangan. Avvalgi Claude bilan KPI dashboard Bosqich 1 tugatdik. Endi Bosqich 2 — 4 ta grafik qo'shamiz. Mana brif fayli (yuqoridagi matn). Iltimos, avval appointments jadvalida vaqt qaysi ustunda saqlanishini Supabase MCP orqali tekshirib boshla."
Yangi Claude ushbu briflni o'qib loyihaga to'liq tushunsa va to'g'ri davom ettira oladi. Bu yetarli ma'lumot.