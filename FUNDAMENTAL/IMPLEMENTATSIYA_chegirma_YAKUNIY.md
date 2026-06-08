# CHEGIRMA TIZIMI — YAKUNIY IMPLEMENTATSIYA (bir martada, mukammal)

> **Bu fayl Claude Code (VS Code companion) uchun yakuniy buyruq.** Repoga to'liq kirish bor: `oqiljonplay-ctrl/tibtaqvim`.
> **Maqsad:** Bu mavzuga boshqa qaytmaymiz. Bir martada toza, kamchiliksiz yakunlanadi.
> **Asosiy tamoyil:** SIFAT > TEZLIK. Shoshilma. Har bosqichni **vizual tekshir** (build, sahifa, DB), keyingisiga o't.
> **Diagnoz tugagan** (`IMPL_CHEGIRMA.md`) — barcha haqiqiy kod, fayl yo'li, DB holati aniqlangan. Bu fayl o'shanga tayanadi, **lekin har faylni o'zgartirishdan oldin qaytadan o'qib** tasdiqla.
> **Test rejimi:** Hamma akkaunt test. Data buzilsa zarar yo'q. Lekin kod va mantiq mukammal bo'lsin.

---

## ⚠️ DIAGNOZDAN KELGAN KRITIK FAKTLAR (e'tibordan qochmasin)

1. **`service.price` = `Decimal(10,2)`** — kasr bo'lishi mumkin. API'da `Number(price)` → JS float.
2. **`paymentStatus`** = text (`pending/paid/not_required/cancelled`). **Chegirma faqat shunga + yangi ustunlarga tegadi, bron `status` ga EMAS.**
3. **`Payment`/`Refund` jadvallari = Payme/Click ONLINE to'lovlar uchun.** Qabulxona "To'ladi" tugmasi bularga TEGMAYDI. Chegirma `Appointment` ga yangi ustun bo'lib qo'shiladi (`paidAmount`, `appliedDiscountPercent`).
4. **`markAsArrived` `paymentStatus === 'paid' || 'not_required'` talab qiladi** — bu shartni chegirma BUZMAYDI (chegirma `paymentStatus` ni baribir `'paid'` qiladi).
5. **`ClinicSettings`** da bron-limit ustunlari bor (`patientSelfLimit` v.h.). `discountPercent` shunga qo'shiladi.
6. **Settings API/UI** bron-limit ishida yaratilgan (`/api/admin/clinic-settings`, `/admin/(panel)/settings/page.tsx`) — kengaytiriladi.
7. **`ReceptionView.tsx`** (`src/components/pages/`) ikki context: `standalone` (`/reception`) + `admin` (`/admin/reception`). Chegirma ikkalasida ham ishlashi kerak.
8. **Migration:** SQL + Supabase MCP `apply_migration`. Project: `lxqimithjjabhnldcugc`. `prisma migrate dev` ISHLAMAYDI.
9. **Deploy:** `npx vercel --prod --yes`. Project: `prj_U0d0bOMH4rj6Ao2JVeeQtGvgjKgJ`. `git push` ≠ deploy.
10. **Statistika ikki joyda moslashadi:** mavjud "Daromad (oy)" KPI va daily revenue chart hozir `SUM(service.price) WHERE status='arrived'`. Yangisi: `SUM(COALESCE(paidAmount, service.price)) WHERE paymentStatus='paid'`.

---

## ⚠️ MUHIM ANIQLIK: YUMALATISH (foydalanuvchi bilan kelishilgan)

Diagnoz `Math.round()` taklif qildi. Lekin foydalanuvchi **"yumalatmaymiz, aniq son chiqsin"** dedi. Quyidagi qoidani aniq qo'lla:

- **Narx odatda butun so'm** (klinika narxlari 70000, 100000 kabi). Bunday holda `price × (100−d)/100` ko'p hollarda butun chiqadi (70000×0.4=28000).
- **Agar kasr chiqsa** (masalan 75001×0.67=50250.67): `paidAmount` integer ustun, kasr saqlanmaydi. Lekin "yumalatmaslik" talabi → eng kam buzilish uchun **`Math.round`** ishlatamiz (eng yaqin butun so'm), CHUNKI:
  - So'mda tiyin yo'q (eng kichik birlik = 1 so'm).
  - `Math.floor` bemorга foyda, `Math.ceil` klinikaga foyda — `Math.round` eng adolatli (eng yaqin).
- **Foydalanuvchiga tushuntir (hisobotda):** "Narxlaringiz butun so'm bo'lgani uchun chegirma deyarli har doim aniq butun son chiqadi. Faqat narx kasr bo'lsa, eng yaqin so'mga yaxlitlanadi (tiyin yo'q). Agar buni xohlamasangiz, ayting — boshqacha qilamiz."
- **MUHIM:** tugma matni, `paidAmount` (DB), va statistika **bir xil formula** ishlatishi SHART (frontend va server bir xil natija bersin). Server hisobi = haqiqat manbai.

---

## QISM 1 — BIZNES QOIDALAR (yakuniy, o'zgarmas)

| # | Qoida |
|---|---|
| BQ1 | `ClinicSettings.discountPercent` 0–100 (butun). Har klinika mustaqil. `0` = chegirma o'chiq (ko'k tugma yo'q). |
| BQ2 | Chegirma>0 da qabulxona tugmalari, **mobilda ustma-ust (Variant B):** (1) "💰 To'ladi" yashil — yuqorida; (2) "{qoldiq} so'm to'ladi" KO'K — o'rtada; (3) "Bekor" qizil — pastda. |
| BQ3 | Qoldiq = `price × (100−discountPercent)/100`, eng yaqin so'mga (`Math.round`). Tugma matni = "{qoldiq} so'm to'ladi". |
| BQ4 | "To'ladi" → `paidAmount=to'liq narx`, `appliedDiscountPercent=0`, `paymentStatus='paid'`. Chegirma e'tiborsiz. |
| BQ5 | "X so'm to'ladi" → `paidAmount=qoldiq`, `appliedDiscountPercent=joriy foiz`, `paymentStatus='paid'`. Server o'zi hisoblaydi (frontend faqat `mode` yuboradi). |
| BQ6 | Tugma bosilgach ikkala to'lov tugmasi yo'qoladi, status odatdagidek shifokorga yo'naltiriladi. |
| BQ7 | "To'ladi" har doim bor (chegirma 100% bo'lsa ham). Ya'ni chegirma>0 da: To'ladi + ko'k + Bekor. |
| BQ8 | To'lovni qaytarish: `appliedDiscountPercent===100` (paidAmount=0) → tugma YO'Q. Boshqa holatda BOR. |
| BQ9 | Qaytarilganda: `paymentStatus='pending'`, `paidAmount=null`, `appliedDiscountPercent=0`, tugmalar qayta chiqadi. Statistikadan `paidAmount` ayriladi (price emas). |
| BQ10 | Freeze: to'lov bosilganda foiz muzlatiladi. Admin keyin o'zgartirsa, to'langanlar tegilmaydi; to'lanmaganlar joriy foizni ko'rsatadi. |
| BQ11 | Bemor har doim TO'LIQ narx ko'radi (webapp/Telegram/bron). Chegirma butunlay klinika-ichki. |
| BQ12 | Statistika X/Y/Z (alohida blok + diagramma): X=`SUM(paidAmount)` paid bronlar (jami tushum); Z=`SUM(paidAmount)` chegirmali (appliedDiscount>0); Y=`SUM(price−paidAmount)` chegirmali. Bekor/qaytarilgan (paid emas) avtomatik chiqib ketadi. |
| BQ13 | Mavjud "Daromad (oy)" KPI + daily revenue chart `paidAmount`'ga o'tadi. X bilan bir xil raqam ko'rsatadi (lekin alohida joyda). |
| BQ14 | Kim bosadi: qabulxona (`/reception`) + admin (`/admin/reception`). Ikkalasi. |
| BQ15 | 0 narx / 0% — summalar o'zgarmaydi, xato (NaN/bo'linish) yo'q. |
| BQ16 | Settings'da `discountPercent` yonida batafsil izoh. |

---

## QISM 2 — ISH USULI: BOSQICHMA-BOSQICH + VIZUAL TEKSHIRUV

> Foydalanuvchi har bosqichni vizual ko'rib test qilishni so'radi. QAT'IY saqla.

**Har bosqich tsikli:**
1. **O'qi** — tegishli mavjud fayllarni qaytadan o'qi (diagnozga ko'r-ko'rona ishonma).
2. **Yoz** — o'zgarish.
3. **Build tekshir:** `npx tsc --noEmit` → 0 xato. Kerakda `npm run build`.
4. **Vizual/data tekshir:**
   - DB → Supabase MCP `execute_sql`/`list_tables` bilan ustun haqiqatan borligini KO'R.
   - API → namuna so'rov yuborib javobni KO'R, yoki kod yo'lini isbotla.
   - UI → **`npm run dev`, brauzerда sahifani OCH, screenshot ol yoki batafsil tasvirla** (nima ko'rinadi, tugmalar, mobil).
5. **Hisobot** — qisqa: nima qildim, build natijasi, vizual holat.
6. **Commit** — atomik (har bosqich = 1 commit).

**Avtonomlik:** Backend bosqichlarida (1–6) muammosiz bo'lsa o'zing davom et, har bosqich oxirida qisqa hisobot. UI bosqichlarida (qabulxona tugmalari, settings, stats) **vizual natijani majburiy ko'rsat**. Yakunda (Bosqich 9) deploydan oldin TO'LIQ hisobot + deploy ruxsatini SO'RA.

---

## QISM 3 — BOSQICHLAR

### BOSQICH 0 — Tayyorgarlik
- `git status` toza, `git checkout -b feat/discount-system`.
- Qaytadan o'qi (diagnoz qator raqamlari to'g'rimi):
  - `prisma/schema.prisma` — Appointment(:432), Service(:188), ClinicSettings(:514), Payment/Refund(:602).
  - `src/app/api/reception/appointments/[id]/payment/route.ts` (PATCH, action)
  - `src/app/api/reception/appointments/route.ts` (serialize)
  - `src/lib/workflow/appointment-workflow.ts` (markAsPaid, markAsUnpaid, cancelAppointment, markAsArrived)
  - `src/components/pages/ReceptionView.tsx` (interface, handlePaymentAction, ReceptionCard, tugmalar)
  - `src/app/api/admin/clinic-settings/route.ts` (GET/PUT)
  - `src/app/admin/(panel)/settings/page.tsx` (FIELDS)
  - `src/lib/stats/queries.ts` (thisMonthRevenue), `src/lib/stats/charts.ts` (getDailyRevenue)
  - `src/app/stats/page.tsx`, `src/components/stats/KpiCards.tsx`, `src/app/stats/components/DailyRevenueChart.tsx`
- **Hisobot:** har fayl holati + diagnozdan farq bo'lsa ayt.

---

### BOSQICH 1 — DB Migration
**Migration:** `add_discount_system`

1. SQL (IMPL Bosqich 1):
   ```sql
   ALTER TABLE clinic_settings
     ADD COLUMN IF NOT EXISTS "discountPercent" INTEGER NOT NULL DEFAULT 0;
   ALTER TABLE clinic_settings
     ADD CONSTRAINT discount_percent_range CHECK ("discountPercent" >= 0 AND "discountPercent" <= 100);
   ALTER TABLE appointments
     ADD COLUMN IF NOT EXISTS "paidAmount" INTEGER,
     ADD COLUMN IF NOT EXISTS "appliedDiscountPercent" INTEGER NOT NULL DEFAULT 0;
   CREATE INDEX IF NOT EXISTS appointments_payment_discount_idx
     ON appointments ("clinicId", "paymentStatus", "appliedDiscountPercent");
   ```
   > **Diqqat:** constraint allaqachon mavjud bo'lsa (qayta ishlatishda) xato bermasin — `IF NOT EXISTS` constraint'ga ishlamaydi, shuning uchun avval `DROP CONSTRAINT IF EXISTS discount_percent_range` qilib, keyin ADD. Yoki `DO $$ ... $$` bilan shartli.
2. Prisma schema'ni qo'lda yangila: ClinicSettings'ga `discountPercent Int @default(0)`; Appointment'ga `paidAmount Int?` + `appliedDiscountPercent Int @default(0)`.
3. Supabase MCP `apply_migration`.
4. `npx prisma generate`.
5. **VIZUAL TEKSHIRUV:** Supabase MCP `execute_sql`:
   - `SELECT column_name FROM information_schema.columns WHERE table_name='clinic_settings' AND column_name='discountPercent';` → bor.
   - `appointments` da `paidAmount`, `appliedDiscountPercent` bor.
6. `tsc --noEmit`.
7. **Hisobot + SQL natija.**

---

### BOSQICH 2 — Settings API (`discountPercent`)
**Fayl:** `src/app/api/admin/clinic-settings/route.ts`

1. GET `select` ga `discountPercent: true` qo'sh; default'ga `discountPercent: 0`.
2. PUT: `discountPercent` ni body'dan ol, validatsiya (`Number.isInteger`, 0–100, aks holda 400), `upsert` update+create+select ga qo'sh.
3. `tsc --noEmit`.
4. **VIZUAL TEKSHIRUV:** lokal dev — `GET` joriy qiymat; `PUT {discountPercent: 60}` → saqlanadi; `PUT {discountPercent: 101}` → 400; Supabase'da 60 yozilganini KO'R.
5. **Hisobot.**

---

### BOSQICH 3 — Settings UI (`discountPercent` + izoh)
**Fayl:** `src/app/admin/(panel)/settings/page.tsx`

1. `LimitSettings` interface'ga `discountPercent: number`; default state'ga `discountPercent: 0`.
2. FIELDS array'ga yangi field (IMPL Bosqich 3): label "Klinika chegirma foizi", min 0, max 100, batafsil hint + misol (BQ16). Bron-limit izohlari uslubida.
3. **Responsive** — mavjud layout primitivlari, buzmaslik.
4. `tsc --noEmit`.
5. **VIZUAL TEKSHIRUV (majburiy):** `npm run dev`, `/admin/settings` OCH. 4 ta field (3 limit + chegirma) ko'rinadimi, chegirma izohi o'qiladimi, saqlash ishlaydimi, mobil (xs) chiroyli. **Screenshot/tasvir ber.**
6. **Hisobot + vizual.**

---

### BOSQICH 4 — Reception serialize (`paidAmount`, `appliedDiscountPercent`)
**Fayl:** `src/app/api/reception/appointments/route.ts`

1. `serialize()` ga `paidAmount: a.paidAmount ?? null` + `appliedDiscountPercent: a.appliedDiscountPercent ?? 0`.
2. `tsc --noEmit`.
3. **VIZUAL/DATA TEKSHIRUV:** `GET /api/reception/appointments?date=...` javobida yangi maydonlar bor.
4. **Hisobot.**

---

### BOSQICH 5 — To'lov API + workflow (mode + reset)
**Fayllar:** `payment/route.ts`, `appointment-workflow.ts`

1. **`payment/route.ts`:** body'ga `mode?: 'full'|'discount'`; `case "paid"` da `markAsPaid(id, clinicId, "reception", mode)`.
2. **`markAsPaid` kengaytirish** (IMPL Bosqich 5): `mode` param. `discount` → settings'dan `discountPercent` ol (server-side, xavfsizlik), `paidAmount = Math.round(price×(100−dp)/100)`, `appliedDiscountPercent = dp`. `full` → `paidAmount = Math.round(price)`, `appliedDiscountPercent = 0`. Ikkalasida `paymentStatus='paid'`.
   > **Diqqat:** mavjud tekshiruvlar saqlansin (bron bor, clinicId mos, status≠cancelled, paymentStatus≠paid).
3. **`markAsUnpaid` kengaytirish:** `appliedDiscountPercent===100` → rad ("100% chegirmali to'lovni qaytarib bo'lmaydi"). Aks holda `paymentStatus='pending'`, `paidAmount=null`, `appliedDiscountPercent=0`.
4. `tsc --noEmit`.
5. **VIZUAL/DATA TEKSHIRUV:** lokal dev — test bron yaratib, `PATCH {action:'paid', mode:'discount'}` → Supabase'da `paidAmount` va `appliedDiscountPercent` to'g'ri yozilganini KO'R. `mode:'full'` → to'liq narx. Qaytarish → null'ga qaytganini KO'R. 100% → qaytarish rad.
6. **Hisobot.**

---

### BOSQICH 6 — Qabulxona UI: 3 tugma + qaytarish
**Fayl:** `src/components/pages/ReceptionView.tsx`

1. **discountPercent fetch** (IMPL 4b): `useState(0)` + `useEffect` `/api/admin/clinic-settings` dan ol.
   > **Diqqat (BQ14):** `/api/admin/clinic-settings` ni receptionist o'qiy oladimi? GET rol ro'yxatida `receptionist` bo'lmasa, qabulxona xodimi `discountPercent` ololmaydi → ko'k tugma chiqmaydi! **Tekshir va tuzat:** GET ga `receptionist` qo'sh, YOKI discountPercent'ni reception appointments API javobiga qo'shib yubor (har bron bilan birga `clinicDiscountPercent`). **Tavsiya:** ikkinchi yo'l toza — `/api/reception/appointments` javobiga `clinicDiscountPercent` qo'sh, alohida fetch shart emas. Buni tanla.
2. **Interface** `ReceptionAppointment` ga `paidAmount: number|null` + `appliedDiscountPercent: number`.
3. **handlePaymentAction** ga `mode?: 'full'|'discount'` (IMPL 4d).
4. **CardProps** ga `discountPercent` + `onDiscount`.
5. **ReceptionCard tugmalari** (IMPL 4f): pending — 3 tugma ustma-ust (To'ladi yashil / ko'k qoldiq / Bekor qizil). Ko'k faqat `discountPercent>0 && price!=null`. paid — qaytarish faqat `paidAmount==null || paidAmount>0` (100%/0 da yo'q).
   > Ko'k tugma matni: `Math.round(price×(100−discountPercent)/100).toLocaleString("uz-UZ") + " so'm to'ladi"`. **Server bilan bir xil formula** (Math.round).
6. **ReceptionCard chaqiruvlari** (IMPL 4g): `onPaid → handlePaymentAction(id,'paid','full')`, `onDiscount → (id,'paid','discount')`, `discountPercent` prop.
7. **Responsive (BQ2):** Variant B ustma-ust, min-h-44px (tap target), xs/md/lg/2xl.
8. `tsc --noEmit`.
9. **VIZUAL TEKSHIRUV (majburiy):** `npm run dev`, **`/reception` VA `/admin/reception` ikkalasini OCH.**
   - discount=0 → faqat To'ladi+Bekor.
   - discount=60, narx 100000 → "40 000 so'm to'ladi" ko'k.
   - discount=100 → "0 so'm to'ladi" + To'ladi.
   - Ko'k bosilgach tugmalar yo'qoladi, paid bo'limga o'tadi.
   - 90% to'lovda qaytarish bor; 100% da yo'q.
   - **Screenshot/tasvir (ikkala sahifa + mobil).**
10. **Hisobot + vizual.**

---

### BOSQICH 7 — Statistika X/Y/Z (API + UI + diagramma)
**Fayllar:** `src/app/api/admin/stats/discount/route.ts` (yangi), `src/components/stats/DiscountStats.tsx` (yangi), `src/app/stats/page.tsx`

1. **API** (IMPL Bosqich 6): X/Y/Z `$queryRaw` (clinicId scope). Rol: clinic_admin/super_admin/branch_admin. `paymentStatus='paid'` filtr; Z/Y `appliedDiscountPercent>0`.
   > **Diqqat:** `BigInt`/`NUMERIC` → `Number` konversiyasi xavfsiz (`::text` keyin `Number`). Katta summalarda overflow yo'qligini tekshir.
2. **UI komponenti** (IMPL Bosqich 7): 3 karta (X yashil / Y qizil / Z ko'k) + tushuntirish matni.
3. **Diagramma (foydalanuvchi "diagramma ham yasa" dedi):** X/Y/Z ni vizual ko'rsatadigan grafik qo'sh. Eng mosi:
   - **Bar chart:** 3 ustun (X, Y, Z), yoki
   - **Stacked/pie:** Z (tushgan chegirmali) + Y (chegirilgan) = potensial, plus to'liq to'laganlar.
   - **Tavsiya:** sodda **bar chart** (X/Y/Z uchta ustun) recharts bilan, mavjud chart uslubida (`src/components/stats/` yoki `stats/components/`). Qo'shimcha: pie — "Tushgan (X) vs Chegirilgan (Y)" nisbati klinika qancha "yo'qotgani"ni ko'rsatadi.
4. **stats/page.tsx** ga `<DiscountStats />` blok (clinic_admin/super_admin uchun), alohida section "Chegirma tahlili".
5. **Responsive** — grid sm:grid-cols-3, mobil 1 ustun.
6. `tsc --noEmit`.
7. **VIZUAL TEKSHIRUV (majburiy):** `/stats` OCH. X/Y/Z kartalar + diagramma ko'rinadimi, raqamlar to'g'rimi (test data bilan: 100000 to'liq + 100000 90% → X=110000, Y=90000, Z=10000). Mobil. **Screenshot/tasvir.**
8. **Hisobot + vizual.**

---

### BOSQICH 8 — Mavjud daromad statistikasini moslash (BQ13)
**Fayllar:** `src/lib/stats/queries.ts`, `src/lib/stats/charts.ts`, `KpiCards.tsx`

1. **queries.ts `thisMonthRevenue`** (IMPL Bosqich 8): `status:'arrived'` + `SUM(service.price)` → `paymentStatus:'paid'` + `SUM(COALESCE(paidAmount, service.price))`.
2. **charts.ts `getDailyRevenue`:** SQL `WHERE status='arrived' SUM(s.price)` → `WHERE paymentStatus='paid' SUM(COALESCE(a."paidAmount", CAST(s.price AS INTEGER)))`.
   > **Diqqat:** `CAST(s.price AS INTEGER)` Decimal'ni yumalatadi — eski bronlar uchun. Yangi bronlar `paidAmount` (allaqachon integer). Mos.
3. **KpiCards** "Daromad (oy)" sub matni: "Faqat 'keldi' status" → "Haqiqiy to'lovlar".
4. `tsc --noEmit`.
5. **VIZUAL TEKSHIRUV:** `/stats` da "Daromad (oy)" KPI = X/Y/Z dagi X bilan **bir xil raqam** ekanini KO'R (BQ13). Daily revenue chart yangi mantiqda. **Screenshot/tasvir.**
6. **Hisobot.**

---

### BOSQICH 9 — To'liq test, build, DEPLOY
1. **QISM 4 (IMPL §10) BARCHA testni** o'tkaz, har birini natija bilan belgila.
2. `npx tsc --noEmit` → 0; `npm run build` → muvaffaqiyatli.
3. **TO'LIQ HISOBOT:** nima qilindi, har bosqich vizual natijasi, test natijalari, qolgan nuance.
4. **Deploy ruxsatini SO'RA.** Men "deploy qil" desam: commit (atomik), `git push`, `npx vercel --prod --yes`, READY tasdiq, production'da smoke test (settings ochiladimi, qabulxona tugmasi ko'rinadimi, stats X/Y/Z).
5. **Yakuniy hisobot + production tasdiq.**

---

## QISM 4 — TO'LIQ TEST REJASI

**DB:** discountPercent (def 0), paidAmount, appliedDiscountPercent ustunlari bor.

**Settings:** 60/0/100 saqlanadi; -1/101 → 400; boshqa klinika mustaqil; izoh ko'rinadi.

**Qabulxona UI:**
- discount=0 → faqat To'ladi+Bekor.
- discount=60 narx 100000 → "40 000 so'm to'ladi"; narx 70000 → "28 000 so'm to'ladi".
- discount=100 → "0 so'm to'ladi" + To'ladi.
- "To'ladi" → paidAmount=to'liq, appliedDiscount=0.
- ko'k → paidAmount=qoldiq, appliedDiscount=foiz.
- tugmalar yo'qoldi (paid).
- `/reception` + `/admin/reception` ikkalasi.
- receptionist (admin emas) ham ko'k tugmani ko'radi (BOSQICH 6.1 hal qilingan).

**Qaytarish:**
- discount=60 paidAmount=40000 → qaytarish BOR; bosildi → pending/null/0, tugmalar qayta.
- discount=100 paidAmount=0 → qaytarish YO'Q (UI + server rad).
- to'liq to'lagan → qaytarish bor.

**Statistika X/Y/Z:**
- 100000 to'liq: X+=100000, Y+=0, Z+=0.
- 100000 90% (10000): X+=10000, Y+=90000, Z+=10000.
- qaytarilgan: X/Y/Z dan chiqib ketadi (paid emas).
- X = "Daromad (oy)" KPI bilan bir xil.
- diagramma to'g'ri.

**Chegga:**
- narx 0, har qanday discount → 0, xato yo'q.
- frontend soxta summa → server o'z hisobini ishlatadi.
- kasr narx → eng yaqin so'm, frontend va server bir xil.

**Regressiya:**
- bron-limit buzilmagan; sidebar/navbar/profil buzilmagan; chegirmasiz to'lov ilgarigidek; markAsArrived ishlaydi; Payme/Click Payment jadvali tegilmagan.
- `tsc --noEmit` + `npm run build` toza.

---

## QISM 5 — XAVFLAR VA YECHIM

| # | Xavf | Muhimlik | Yechim |
|---|---|---|---|
| X1 | **Receptionist `discountPercent` ololmasligi** (GET rol cheklovi) → ko'k tugma chiqmaydi | Yuqori | BOSQICH 6.1: `clinicDiscountPercent` ni `/api/reception/appointments` javobiga qo'sh (alohida fetch o'rniga). Eng toza |
| X2 | Frontend/server formula farqi (yumalatish) | Yuqori | Ikkalasi `Math.round(price×(100−d)/100)`. Server = haqiqat |
| X3 | Frontend soxta summa yuborishi | Yuqori | Server `mode` ni oladi, summани o'zi hisoblaydi. Summa frontend'dan qabul qilinmaydi |
| X4 | paymentStatus vs status chalkashishi | Yuqori | Chegirma faqat paymentStatus+paidAmount+appliedDiscountPercent. status tegilmaydi |
| X5 | Mavjud statistika buzilishi (eski paidAmount=null) | O'rta | `COALESCE(paidAmount, service.price)`. Test rejim — data baribir nollanadi |
| X6 | Freeze ishlamasligi (admin foiz o'zgartirsa to'langanlar) | O'rta | Statistika `appliedDiscountPercent`+`paidAmount` (muzlatilgan)dan, joriy settings'dan emas |
| X7 | 100% refund noto'g'ri | Past | UI: `appliedDiscountPercent===100||paidAmount===0` → yo'q. Server `markAsUnpaid` rad |
| X8 | Payment/Refund (Payme/Click) bilan ikkilanish | O'rta | Qabulxona to'lovi Payment jadvaliga TEGMAYDI. Faqat Appointment ustunlari |
| X9 | Constraint qayta qo'shilishi (migration idempotent emas) | Past | DROP CONSTRAINT IF EXISTS keyin ADD, yoki DO block (BOSQICH 1) |
| X10 | ReceptionView ikki context farqi | O'rta | Tugma mantiqi context'dan mustaqil. Ikkalasi test (BOSQICH 6.9) |
| X11 | $queryRaw NUMERIC→Number overflow | Past | `::text` keyin Number. Katta summа test |
| X12 | 0 narx/0% NaN | Past | Math.round(0)=0, bo'linish yo'q. Xavfsiz |
| X13 | Responsive 3 tugma mobilда | O'rta | Variant B ustma-ust, min-h-44, xs/md test |
| X14 | Deploy | Past | npx vercel --prod, build tekshir |

---

## QISM 6 — YAKUNIY ESLATMA
- **Sifat > tezlik.** Har bosqich vizual tekshir, keyin o't.
- **Server summani o'zi hisoblaydi** — frontend'ga ishonma (mode yuboradi, summa emas).
- **Frontend va server bir xil formula** (Math.round) — tugma matni = paidAmount.
- **Chegirma faqat paymentStatus+paidAmount+appliedDiscountPercent** — bron status va Payment jadvaliga tegma.
- **Statistika muzlatilgan qiymatdan**, joriy settings'dan emas.
- **Bemor to'liq narx ko'radi** — chegirma klinika-ichki.
- **receptionist ham ko'k tugmani ko'rsin** (X1 hal qilingan).
- **Test rejim** — data buzilsa zarar yo'q, kod mukammal.
- **Deploy faqat ruxsatdan keyin** — npx vercel --prod.
- Tushunarsiz → so'ra, taxmin qilma.

**Boshla: BOSQICH 0 — tayyorgarlik va repo qayta o'qish. Hisobot ber, keyin BOSQICH 1.**
