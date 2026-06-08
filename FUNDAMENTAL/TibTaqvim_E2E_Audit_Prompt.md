# TibTaqvim — To'liq E2E Audit & Test Prompti (VS Code Claude Code uchun)

> Bu prompt **VS Code'dagi Claude Code companion**ga to'g'ridan-to'g'ri beriladi.
> Maqsad: TibTaqvim loyihasining **har bir sahifasi, har bir rol, har bir funksiya, bot va WebApp**ni 100% sinab ko'rish, xatolarni eng kichigidan eng kattasigacha to'plash.
> **Til:** O'zbek. **Ustuvorlik:** SIFAT, tezlik emas. Shoshilmaslik. Har bir tekshiruvni isbot bilan hujjatlashtirish.

---

## 0. MISSIYA VA QOIDALAR (avval o'qi, keyin boshla)

Sen — TibTaqvim loyihasining **senior QA auditori** rolidasan. Sen oddiy "test yozuvchi" emassan. Sen:

1. **Inson topa olmaydigan xatolarni topasan.** Faqat ochiq xatolar (crash, 500, oq ekran) emas — **xatolikka yaqin "to'g'ri ko'rinadigan" kodni** ham payqaysan. Masalan:
   - RLS bor, lekin policy noto'g'ri scope bilan ("works but leaks")
   - Validatsiya bor, lekin chetlab o'tish mumkin
   - Race condition (ikki bemor bir slotni bir vaqtda band qilsa)
   - Auth tekshiruvi frontendda bor, lekin API'da yo'q (IDOR)
   - Foydalanuvchi xato qilolmasligi kerak joyda xato qila oladi
2. **Hech narsani taxmin qilmaysan.** Har bir da'voni kod yoki test natijasi bilan isbotlaysan.
3. **Buzmaysan.** Bu PRODUCTION-ga yaqin loyiha. DELETE / DROP / production ma'lumotini o'chirish **mutlaqo taqiqlanadi**. Test ma'lumotlari yaratsang — aniq prefiks bilan (`__TEST__`) va oxirida tozalash rejasini yoz (lekin o'zing o'chirma, faqat ro'yxat ber).
4. **Sifat > Tezlik.** Bu uzoq ish. Bo'limma-bo'lim ket. Har bo'limdan keyin oraliq hisobot yoz.

### Foydalanish kerak bo'lgan skill/yondashuvlar:
- **Kod o'qish (static analysis):** har bir route, API handler, server action, middleware'ni qo'lda o'qib chiq. ESLint/TypeScript xatolarini yig'.
- **DB audit:** Supabase'da har bir jadval RLS, policy, FK, index, trigger'ini tekshir. `EXPLAIN ANALYZE` bilan sekin query'larni top.
- **E2E test:** brauzer orqali (Playwright bo'lsa undan, bo'lmasa qo'lda bosib) har bir oqimni real bajar.
- **API test:** har bir endpoint'ni curl/fetch bilan to'g'ridan-to'g'ri ur — auth bilan va authsiz.
- **Security mindset:** har bir rol boshqa rol ma'lumotiga kira oladimi? Token o'g'irlansa nima bo'ladi?

---

## 1. KIRISH MA'LUMOTLARI — BARCHA PAROLLAR (eng birinchi shu)

**Birinchi vazifang:** loyihadagi **barcha rollar uchun login parollarini topib ber**, jumladan **superadmin**. Hech qaysi rolni qoldirma.

Buni quyidagi joylardan qidir va to'plab ber:
- `.env`, `.env.local`, `.env.production` — barcha maxfiy o'zgaruvchilar
- Supabase `auth.users` jadvali va custom user/xodim jadvallari (parol hash bo'lsa, qaysi jadval, qaysi ustun, qaysi algoritm — bcrypt/argon)
- Seed skriptlari (`prisma/seed.ts`, `scripts/`)
- Migration'lardagi default user'lar
- Telegram bot token, WebApp init data secret
- JWT secret, cookie nomi va sozlamalari

**Natija formati (jadval):**

| Rol | Login (telefon/email/username) | Parol (yoki qayerdan olinadi) | Manba (fayl/jadval) | Izoh |
|-----|-------------------------------|-------------------------------|---------------------|-------|
| Superadmin | ... | ... | ... | ... |
| Admin (klinika) | ... | ... | ... | ... |
| Qabulxona (reception) | ... | ... | ... | ... |
| Shifokor (doctor) | ... | ... | ... | ... |
| Xodim (staff) | ... | ... | ... | ... |
| Bemor/User (webapp) | ... | ... | ... | ... |

Agar test useri yo'q bo'lsa — **yarat** (`__TEST__` prefiks bilan) va shu jadvalga qo'sh.

---

## 2. ARXITEKTURA XARITASINI TUZ (test'dan oldin)

Test boshlashdan avval loyihaning **to'liq xaritasini** chiqar, toki bironta burchak qolmasin:

1. **Barcha route/sahifalar ro'yxati** — `app/` papkasini to'liq kez. Har biri qaysi rol uchun, qaysi layout ostida.
2. **Barcha API endpoint'lar** — `app/api/`, server actions. Har biri: method, auth talab qiladimi, qaysi rol.
3. **Barcha DB jadvallari** — 28+ jadval. Har biri: ustunlar, FK, RLS bormi, qaysi policy.
4. **Rol → ruxsat matritsasi (RBAC matrix):** qaysi rol qaysi sahifa/endpoint'ga kira oladi (kutilgan holat).
5. **Telegram bot oqimlari** — barcha komandalar, callback'lar, WebApp ochilish nuqtalari.
6. **Cron / background job'lar** — reklama broadcast, slot generatsiya va h.k.

Buni `MAP.md` deb ichki ishchi faylga yoz, keyin asosiy hisobotga ilova qil.

---

## 3. ROL-BO'YICHA TEST OQIMLARI (har birini real bajar)

Har bir rolga **login qil**, keyin shu rolning **HAR BIR funksiyasini** bos va sina. Quyida minimal ro'yxat — lekin sahifada ko'rgan har qanday tugma/forma/filtrni ham sina.

### 3.1 SUPERADMIN
- [ ] Login (to'g'ri parol / xato parol / bo'sh / SQL-injection urinishi)
- [ ] Barcha klinikalarni ko'rish, qidirish, filtrlash
- [ ] Yangi klinika yaratish / tahrirlash / faolsizlantirish
- [ ] Klinikaga admin/xodim biriktirish
- [ ] Global KPI / grafiklar (6 KPI grafik to'g'ri ma'lumot ko'rsatadimi?)
- [ ] Audit log ko'rish
- [ ] Reklama tizimi: kanal/kampaniya/post yaratish, broadcast cron
- [ ] To'lovlar / refund ko'rinishi

### 3.2 ADMIN (klinika darajasi)
- [ ] Login + faqat **o'z klinikasi** ma'lumotini ko'radimi (boshqa klinikaga sizib o'tmaydimi?)
- [ ] Shifokor yaratish / tahrirlash / o'chirish (soft delete?)
- [ ] Shifokor profili to'ldirish: education, position, department, workSchedule, bio, specialties, directions, experiences, workplaces
- [ ] Xizmat (service) yaratish / tahrirlash / narx / davomiylik
- [ ] Service ↔ Doctor M2M biriktirish, queueMode
- [ ] Slot yaratish / tahrirlash (UI yashirin — ishlaydimi, ko'rinadimi?)
- [ ] Filial-xizmat ajratish (multi-clinic MC-1→MC-6)
- [ ] 6 KPI grafik
- [ ] Bemor ro'yxati, mehmon bemor

### 3.3 QABULXONA (reception)
- [ ] Login
- [ ] Bemor uchun bron qilish (mehmon bemor ham)
- [ ] Bronni tasdiqlash / bekor qilish / ko'chirish
- [ ] Navbat boshqaruvi (queueMode)
- [ ] To'lov qabul qilish oqimi (Payme/Click — hali ulanmagan, holatini tekshir)

### 3.4 SHIFOKOR (doctor)
- [ ] Login (xodim paroli, A→D auth)
- [ ] Faqat **o'z** bronlarini ko'radimi (doctorId filtri to'g'rimi? Boshqa shifokor bronini ko'rmasinmi?)
- [ ] `/stats` grafiklar (3 tasi qolgan — qaysilari yo'q, qaysilari ishlaydi?)
- [ ] O'z profilini tahrirlash (`/doctor/profile`)
- [ ] Bemorni qabul qilish / yakunlash
- [ ] Uy xizmati natijasi yuborish UI (telegram_relay_log — poydevor bor, UI bormi?)

### 3.5 XODIM (staff)
- [ ] Login + ruxsat doirasi
- [ ] O'ziga tegishli funksiyalar
- [ ] Ruxsati yo'q joyga kira oladimi (tekshir)

### 3.6 USER / BEMOR (Telegram WebApp)
- [ ] WebApp ochilishi (initData validatsiya — soxta initData bilan kira oladimi?)
- [ ] Klinika tanlash, shifokor tanlash, xizmat tanlash, slot tanlash → **bron qilish** (to'liq oqim)
- [ ] Bron tasdiq / bekor qilish
- [ ] **Flip card** (3D rotateY) — bugungi / yaqinlashayotgan / tarix bo'limlarida ishlaydimi, amal tugmalari stopPropagation to'g'rimi?
- [ ] Mehmon bemor sifatida bron
- [ ] To'lov oqimi (Payme/Click redirect)
- [ ] Klinikalarim sahifa

### 3.7 TELEGRAM BOT (WebApp'dan tashqari)
- [ ] `/start` va barcha komandalar
- [ ] Eslatma/bildirishnoma yuborish
- [ ] Reklama broadcast (cron) — to'g'ri kanal/auditoriyaga ketadimi?
- [ ] telegram_relay_log yozuvlari

---

## 4. ROLLAR ARO BOG'LIQLIK (integration / consistency testlari)

Bu eng muhim qism — **xatolikka yaqin to'g'ri ishlar** shu yerda chiqadi:

- [ ] **Bron oqimi uchdan-uchgacha:** Bemor WebApp'da bron qiladi → Qabulxona ko'radimi? → Shifokor o'z ro'yxatida ko'radimi? → Admin statistikada hisoblanadimi? → Telegram bildirishnoma ketadimi? **Bir bron — barcha rollar — bir xil holat.**
- [ ] **Slot konsistensiyasi:** bir slotni ikki kishi bir vaqtda band qila olmasin (race condition / unique constraint / transaction test).
- [ ] **Multi-clinic izolyatsiya:** A klinika admini B klinika ma'lumotini hech bir yo'l bilan ko'ra/o'zgartira olmasin (UI'da ham, API'da to'g'ridan-to'g'ri ham).
- [ ] **Bekor qilish kaskadi:** bron bekor qilinsa, slot bo'shaydimi? Bildirishnoma ketadimi? Statistika yangilanadimi?
- [ ] **Shifokor-xizmat-filial uchburchagi:** noto'g'ri kombinatsiya (shifokor u xizmatni qilmaydigan filialda) bron qilib bo'ladimi? (bo'lmasligi kerak)
- [ ] **Vaqt zonasi:** slot vaqtlari WebApp, bot, admin panelda bir xil ko'rinadimi (UTC/Asia/Tashkent)?
- [ ] **To'lov holati:** to'lov muvaffaqiyatsiz bo'lsa bron holati nima bo'ladi? (Payme/Click hali ulanmagan — kutilgan xatti-harakatni hujjatlashtir)

---

## 5. XAVFSIZLIK AUDITI (har bir endpoint uchun)

- [ ] **AuthZ:** har bir himoyalangan endpoint'ni **boshqa rol tokeni** bilan va **tokensiz** ur. Sizib o'tsa — KRITIK.
- [ ] **IDOR:** URL/ID o'zgartirib boshqaning ma'lumotini olib bo'ladimi (`/api/appointments/123` → `124`)?
- [ ] **RLS bypass:** Supabase service_role kaliti frontendga sizmaganmi? Anon kalit bilan qancha ko'rinadi?
- [ ] **Input validatsiya:** XSS, SQL-injection, ortiqcha/buzuq payload, juda katta qiymatlar.
- [ ] **JWT:** muddati o'tgan token, soxta imzo, cookie HttpOnly/Secure/SameSite to'g'rimi (24h cookie)?
- [ ] **Telegram initData:** soxta yoki muddati o'tgan initData rad etiladimi?
- [ ] **Maxfiy ma'lumot oqishi:** xato xabarlarida stack trace / DB struktura / secret chiqib qoladimi?

---

## 6. PERFORMANS (sekin ochilish muammosi)

Esda: sahifalar sekin ochilyapti deyilgan. Shuni **isbot bilan** tekshir:
- [ ] `/api/webapp/appointments` har bronning to'liq profilini (specialties/directions/experiences/workplaces) bir so'rovda yuklaydimi? N+1 query bormi?
- [ ] Prisma cold start ta'siri (Vercel serverless)
- [ ] Sekin query'larni `EXPLAIN ANALYZE` bilan top, yetishmayotgan index'larni ko'rsat
- [ ] Eng og'ir 5 sahifaning yuklash vaqtini o'lcha (Network tab / lighthouse)
- [ ] Optimizatsiya **takliflari** ber (lekin o'zing katta refactoring qilma — avval tasdiqlat)

---

## 7. ESLINT / TYPE / BUILD SIFATI

- [ ] `eslint` to'liq ishga tushir (ignoreDuringBuilds yoqilgan — lekin haqiqiy ogohlantirishlar bormi?)
- [ ] `tsc --noEmit` — type xatolar
- [ ] Ishlatilmagan kod, `any`, `@ts-ignore`, `console.log` qoldiqlari
- [ ] **Responsive qoida tekshiruvi (MAJBURIY):** har bir sahifa Container/Stack/ResponsiveGrid/ResponsiveTable primitivlaridan qurilganmi? xs/md/lg/2xl da chiroyli ko'rinadimi? Buzilgan sahifalarni ro'yxatla.

---

## 8. ISH TARTIBI (intizom)

Quyidagi tartibda ket, **har bosqichdan keyin oraliq commit qilma** — faqat hisobotga yoz:

1. Parollarni to'pla (1-bo'lim)
2. Arxitektura xaritasi (2-bo'lim)
3. Rol-bo'yicha E2E (3-bo'lim) — har rol alohida sessiya
4. Rollar aro integratsiya (4-bo'lim)
5. Xavfsizlik (5-bo'lim)
6. Performans (6-bo'lim)
7. Kod sifati (7-bo'lim)
8. Yakuniy hisobot

Har bo'lim oxirida: **"Bu bo'limda nechta muammo topildi, qanchasi kritik"** deb qisqa xulosa yoz.

---

## 9. YAKUNIY HISOBOT FORMATI (MAJBURIY — `AUDIT_REPORT.md`)

Hisobotni shu strukturada yoz:

### 9.1 Boshqaruv xulosasi
- Umumiy topilgan muammolar soni, jiddiylik bo'yicha taqsimot
- Loyiha "ishga tayyormi" degan ochiq baho

### 9.2 Topilgan muammolar jadvali
Har bir muammo uchun:

| # | Jiddiylik | Bo'lim/Sahifa | Rol | Muammo tavsifi | Qayta hosil qilish qadamlari | Kutilgan vs Haqiqiy | Isbot (kod/log/screenshot) | Tavsiya |
|---|-----------|---------------|-----|----------------|------------------------------|---------------------|----------------------------|---------|

**Jiddiylik darajalari:** 🔴 KRITIK (xavfsizlik/ma'lumot oqishi/bron buziladi) · 🟠 YUQORI · 🟡 O'RTA · 🔵 PAST · ⚪️ "to'g'ri ko'rinadi lekin xavfli" (near-miss)

### 9.3 Sen kira olmaydigan / menga kerak bo'lgan ma'lumotlar (ZARUR — MD ko'rinishida)
Bu eng muhim qism. Menga (foydalanuvchiga) **markdown** ko'rinishida quyidagilarni to'plab ber, chunki sen ularga to'liq kira olmaysan yoki men ko'rishim kerak:

- **Barcha parollar jadvali** (1-bo'limdan, superadmin shu yerda ham)
- **Barcha .env o'zgaruvchilari** ro'yxati (qiymatlarni maskalab: `SUPABASE_SERVICE_KEY=eyJ...xxxx`, lekin qaysi fayl, qaysi nom)
- **Topib bo'lmagan / yetishmayotgan secret'lar** ro'yxati
- **Tashqi xizmat sozlamalari** (Payme/Click merchant id, callback URL'lar, Telegram token holati) — qaysilari o'rnatilmagan
- **Qo'lda tekshirish kerak bo'lgan narsalar** ro'yxati (sen avtomatik tekshira olmagan: masalan real Payme to'lovi, real Telegram push)
- **Mendan kerak bo'lgan kirishlar** (Vercel/Supabase dashboard sozlamasi, DNS, domen va h.k.)
- **Fayl/papka inventari:** sen muhim deb topgan, lekin to'liq ko'rib bo'lmagan fayllar ro'yxati

### 9.4 Tuzatish ustuvorligi
Muammolarni tuzatish tartibi (avval nima, keyin nima), har biriga taxminiy ta'sir.

### 9.5 Test'da yaratilgan `__TEST__` ma'lumotlari
Tozalash uchun ro'yxat (o'zing o'chirma).

---

## 10. ESLATMA (qizil chiziqlar)

- **HECH NARSANI o'chirma/buzma.** Production ma'lumoti muqaddas.
- **Katta refactoring qilma** — faqat aniqla va tavsiya ber, men tasdiqlaganimdan keyin tuzatamiz.
- **Har bir da'voni isbotla.** "Ishlayapti" yetarli emas — qanday tekshirganingni ko'rsat.
- **O'zbek tilida yoz.**
- **Shoshilma.** Sifat — birinchi.

Boshla. Avval 1-bo'limdan (parollar), keyin 2-bo'limdan (xarita). Har bo'limdan keyin menga oraliq xulosa ko'rsat.
