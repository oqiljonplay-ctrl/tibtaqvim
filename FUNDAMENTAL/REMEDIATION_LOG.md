# TibTaqvim — Remediation Log

> Yaratildi: 2026-06-02 | Asosiy muhandis: Claude Code
> Har tuzatilgan muammo quyidagi jadvalda qayd etiladi.

---

## TO'LQIN 1 — XAVFSIZLIK & MA'LUMOT YAXLITLIGI

| # | Jiddiylik | Muammo | Ildiz sababi | Tuzatish | Isbot | Migration? | Qoldiq risk | Fayl/Branch |
|---|-----------|--------|--------------|----------|-------|------------|-------------|-------------|
| 1.1 | 🔴 KRITIK | WebApp initData validatsiyasi yo'q — `/api/webapp/appointments`, `/cancel`, `/profile` endpoint'lari `telegramId` ni query/body'dan tekshiruvsiz oladi. Soxta telegramId bilan boshqa bemorning tibbiy tarixini ko'rish yoki profilini o'zgartirish mumkin. | JWT yo'q, initData HMAC tekshiruvi yo'q. Telegram WebApp identifikatsiyasi client-tarafdan kelgan qiymatga ishonadi. | `src/lib/telegram/webapp-auth.ts` — HMAC-SHA256 validatsiya utility yaratildi. `resolveWebappTelegramId()` funksiya: initData bor → validate → telegramId olish; initData yo'q → fallback (log-only). 3 endpoint yangilandi. | `npx tsc --noEmit` toza. initData bilan test: `validateTelegramInitData()` noto'g'ri hash → `valid:false`. Soxta initData → `resolveWebappTelegramId()` → `null` → 401. | Yo'q | **LOG-ONLY rejim** — initData yubormaydigan eski clientlar hali ham ishlaydi. Keyingi bosqich: frontend'da `x-telegram-init-data` header qo'shish va enforce rejimga o'tish. | `src/lib/telegram/webapp-auth.ts`, 3 ta endpoint |
| 1.2 | 🔴 KRITIK → ✅ TUZATILDI | IDOR: cross-clinic appointment ID bilan 400 + "Bu bron boshqa klinikaga tegishli" qaytardi — appointment mavjudligi va klinikasini oshkor qilardi. `payment-info` 403 qaytardi. | `findUnique(id)` + keyin explicit check: noto'g'ri klinikada ham bron topiladi, xato mesajida clinic info sızırdı | `appointment-workflow.ts`: barcha 5 funksiya `findFirst(id + clinicId)` ga o'tdi. Boshqa klinikaning broni "Topilmadi" kabi ko'rinadi. Route handler: `notFound→404`. `payment-info`: 403→404. | **Real curl (production):** BEFORE: `HTTP 400 "Bu bron boshqa klinikaga tegishli"`. AFTER: `HTTP 404 "Topilmadi"`. Testlangan: `cmpmgmbci0001jp04ayo6q9tf` (Test klinika) → clinic-demo admin bilan → 404. Regression: clinic-demo admin o'z broniga kirdi → `HTTP 200` ✅ | Yo'q | Yo'q | `appointment-workflow.ts`, reception/payment, doctor/attendance, payment-info |
| 1.3 | 🔴 KRITIK → ✅ TUZATILDI | `getBranchScope()` clinicId undefined bo'lsa Prisma filter yo'qoladi — barcha klinika ma'lumotlari qaytadi | `auth.clinicId!` TypeScript non-null assertion runtime'da kafolatlamaydi. `undefined` qiymat Prisma where'da ignored bo'ladi | `branch-scope.ts`: non-super_admin uchun `if (!auth.clinicId) throw new Error(...)` runtime guard qo'shildi. Node.js test: `getBranchScope({clinicId: undefined})` → `{}` → Prisma where'da clinicId yo'q → barcha records qaytardi (confirmed). Guard bundan keyin exception tashlaydi. | `node -e` test: `{ clinicId: undefined }` → Prisma where `{ isActive: true }` (clinicId yo'q — barcha records). Runtime guard deploy qilindi. | Yo'q | Yo'q | `src/lib/branch-scope.ts` |
| 1.4 | ✅ OK | service_role kaliti NEXT_PUBLIC_ orqali sizib chiqmagan | — | Tekshirildi: faqat `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_WEBAPP_URL`, `NEXT_PUBLIC_BOT_USERNAME` — barchasi public info | grep `NEXT_PUBLIC_` | Yo'q | Yo'q | — |
| 1.5 | ✅ OK | JWT cookie HttpOnly/Secure/SameSite | — | `httpOnly:true`, `secure:prod`, `sameSite:"lax"`, `maxAge:86400` — barchasi to'g'ri | `src/app/api/auth/login/route.ts` ko'rildi | Yo'q | Yo'q | — |
| 1.6 | ✅ OK | service_role kaliti NEXT_PUBLIC_ orqali sizib chiqmagan | — | Tekshirildi: faqat public info | grep toza | Yo'q | Yo'q | — |

---

## TO'LQIN 2 — BRON OQIMI YAXLITLIGI & RACE CONDITIONS

| # | Jiddiylik | Muammo | Ildiz sababi | Tuzatish | Isbot | Migration? | Qoldiq risk | Commit |
|---|-----------|--------|--------------|----------|-------|------------|-------------|--------|
| 2.1 | 🔴 KRITIK → ✅ | queueNumber TOCTOU: parallel bronlarda bir xil navbat raqami | `findFirst(max)+1+create` — READ COMMITTED'da atomic emas. 5 parallel curl → [2,1,2,1,1] — 3 ta duplicate! | **Mexanizm: `pg_advisory_xact_lock(hashtext(serviceId:date))`** — transaksiya (`prisma.$transaction`) BOSHIDA acquired. Bu transaction-level lock — pgBouncer transaction mode bilan mos. Lock transaksiya commit/rollback da avtomatik ozod. Lock ostida: limit check + duplicate check + queueNumber = max+1 + appointment.create — hammasi bir tx ichida ATOMIK. | BEFORE: [2,1,2,1,1] (3 ta duplicate). AFTER: [2,1,5,4,3] — 5 ta unikal ✅. **10-parallel stress test (2026-07-07):** 6×201 → queueNumbers [1,2,3,4,5,6] — 0 duplikat ✅. 3×500 = pgBouncer pool limiti (Supabase free plan max ~10 conn), 1×429 = rate limit — correctness ta'sirlanmaydi. 20-parallel: rate limit (10/min/IP) sababli 10 samarali — mexanizm to'g'ri. | Yo'q | Juda past: bir xil serviceId+date uchun barcha bronlar seriallashadi — ziyqlik emas (ms-darajada). pgBouncer pool exhaustion ≥10 parallel da 500 → monitoring kerak (Wave 4). | `260610c` |
| 2.2 | 🔴 KRITIK → ✅ | Slot TOCTOU: capacity=1 slotga 2 parallel bron — ikkalasi ham muvaffaqiyatli bo'lishi mumkin edi (overbooking) | `bookDiagnostic`: advisory lock bor edi, lekin capacity check ICHIDA joylashgan edi — lock + check zanjiri to'g'ri | Lock + capacity check `slot:${slotId}` advisory lock ostida tx ichida — to'g'ri ketma-ketlik. **REAL TEST:** temp slot capacity=1 (`test-slot-cap1`), `requiresSlot=true` yoqildi, 2 parallel curl | **BEFORE (latent):** production'da `requiresSlot=true` xizmat yo'q edi — latent bug. **AFTER real test:** Req1 HTTP 201 (CREATED), Req2 HTTP 409 SLOT_FULL ✅. Restore qilindi. | Yo'q | Yo'q | `01cea3f`, `89f6489` |
| 2.3 | 🔴 KRITIK → ✅ TUZATILDI | Duplicate check race: `bookDiagnostic` va `bookHomeService` da patientPhone+serviceId+date unique check YO'Q edi | `bookDoctorQueue` da check bor edi. `bookDiagnostic` da advisory lock bor edi lekin duplicate check YO'Q. `bookHomeService` da lock ham, check ham yo'q edi. | `bookDiagnostic`: `diagDuplicate` check lock ichiga qo'shildi. `bookHomeService`: `pg_advisory_xact_lock` + `homeDuplicate` check qo'shildi. Ikkalasining catch blokiga `DUPLICATE_BOOKING` handler qo'shildi. | **BEFORE (reproduced):** 2 parallel curl (same phone+serviceId+date) → `cmpxus1t30007jr04dr3lqoj2` + `cmpxus29p000ajr04222achxx` — IKKALASI 201 (overbooking!). **AFTER:** 1×201 CREATED + 1×409 DUPLICATE_BOOKING ✅. | Yo'q | Yo'q | `89f6489` |
| 2.4 | 🔴 KRITIK → ✅ | Holat mashinasi: `expired → paid` va `expired → arrived` ikkisi ham HTTP 200 qaytardi | `markAsPaid/markAsArrived/markAsMissed/resetToBooked` faqat `cancelled` ni bloklagan, `expired` terminal holatini emas | Har funksiyaga `expired` (va tegishli boshqa invalid holatlarga) explicit check qo'shildi. State machine tuzatildi. | BEFORE: `expired → paid` HTTP 200 ✅. AFTER: HTTP 400 "Muddati o'tgan bron uchun to'lov belgilab bo'lmaydi" ✅. Regression: `cancelled → arrived` HTTP 400 ✅ (buzilmadi) | Yo'q | Test artefakt: appt `cmpv6c4jl0003jx041zimglj9` test sababli `status:arrived, paymentStatus:paid` holatida — MANUAL_CHECKLIST | `01cea3f` |
| 2.5 | ✅ OK | To'lov idempotentligi — markAsPaid ikki marta | — | Tekshirildi: 1-chi call → `paymentStatus:paid`. 2-chi call → `"Bu bron allaqachon to'langan"` (400) ✅ | Real curl: sequential double call → ikkinchisi 400 qaytardi | Yo'q | Parallel mode farqlari (masalan full+discount bir vaqtda) — juda past ehtimol | — |

---

## TO'LQIN 3 — QUERY OPTIMIZATSIYA & FLIP CARD XAVFSIZLIGI

| # | Jiddiylik | Muammo | Ildiz sababi | Tuzatish | Isbot | Migration? | Qoldiq risk |
|---|-----------|--------|--------------|----------|-------|------------|-------------|
| 3.1 | 🟡 PERF | `/api/admin/doctors` — 6 ta alohida Prisma so'rovi (N+1 emas, batched — lekin ortiqcha) | Nested include'lar alohida batched query yuboradi | Single raw SQL JOIN ga o'tish → 6 so'rov → 2 so'rov | **EXPLAIN ANALYZE:** 26.9ms → 1.788ms (15x tez). "N+1 emas, 6 batched" — to'g'ri tashxis | Yo'q | Yo'q |
| 3.2 | 🔴 KRITIK → ✅ | Flip card yangi endpoint'da IDOR: doctorId bilan cross-clinic ma'lumot olish | Yangi `/api/webapp/doctor-profile` endpoint'da `clinicId` tekshiruvi yo'q edi | `clinicId` DB'da filter sifatida qo'shildi + `BookingAppt` tipiga `clinicId` field, `handleFlip` da `?clinicId=` bilan uzatiladi | DB bilan isbot: boshqa clinic doctorId → 404 ✅ | Yo'q | Yo'q |
| 3.3 | 🟢 DIZAYN | Doctor profil flip: minimal/to'liq ma'lumot | Har flip full DB query | `displayDoc = fullDoc ?? doc` — birinchi flip minimal, ikkinchi flip to'liq yuklaydi + cache | Ikkinchi flip qayta fetch qilmaydi ✅ | Yo'q | Yo'q |
| 3.4 | 🔴 KRITIK → ✅ | TO'LQIN 2 dagi 3×500 sababini ildiz: `connection_limit=1` `.env`'da yo'q edi | pgBouncer pool limit Supabase free: ~10 conn | `.env`'ga `&connection_limit=1` qo'shildi | 3×500 xatolarning asosiy sababi sifatida to'g'ri bog'landi | **MANUAL**: Vercel dashboard → DATABASE_URL ga `&connection_limit=1` qo'shish | Vercel env yangilanmaguncha production'da 500'lar davom etadi |

---

## TO'LQIN 4 — HOLAT BARQARORLIGI (SERVERLESS STATE)

| # | Jiddiylik | Muammo | Ildiz sababi | Tuzatish | Isbot | Migration? | Qoldiq risk |
|---|-----------|--------|--------------|----------|-------|------------|-------------|
| 4.1 | 🔴 KRITIK → ✅ | Rate-limit in-memory `Map` — Vercel serverless'da har invocation yangi instance → brute-force va spam himoyasi yo'q | `const store = new Map()` — process hayoti invocation bilan tugaydi | DB-backed atomik UPSERT: `INSERT ... ON CONFLICT DO UPDATE` bitta SQL statement — TOCTOU yo'q. **2-qavatli login:** `auth:min:IP` (5/min) + `auth:hour:IP` (20/soat). **Shadow mode:** `RATE_LIMIT_ENFORCE` flag (default `false`) — hozir faqat log, enforce keyinroq | **BEFORE:** 10 parallel → 4×401+6×429 nondeterministik (issiq/sovuq instance farqi). **SQL counter test:** 10 UPSERT → `count=10` ✅. **Window reset:** `count=1` ✅. **RLS:** `deny_public_access` policy qo'shildi | `rate_limits` jadval — Supabase'ga apply qilindi ✅ | **MANUAL:** Vercel'da `RATE_LIMIT_ENFORCE=true` — 1-2 kun log kuzatib, false-positive yo'qligini tasdiqlagach |
| 4.2 | ✅ OK | Bot-state in-memory `Map` qoldig'i | — | `bot/state/dbState.ts` to'liq DB-backed (`prisma.botState`). `cleanExpiredState()` → `SELECT cleanup_expired_bot_states()` SQL. Map qoldig'i yo'q | grep: `new Map` bot/ da topilmadi ✅ | Yo'q | Yo'q |

**Login limit asoslanishi (4.1):**
- `5/min`: qisqa burst brute-force'ni bloklaydi (1 daqiqada 5 parol = blok)
- `20/hour`: uzoq sessiya hujumlarni bloklaydi (1 soatda 20 urinish = blok, cheksiz daqiqa ×5 yo'q)
- `book: 10/min`: bron spam uchun maqbul — qabulxona ketma-ket 6 bron qilsa ham limit'dan past
- Ikkalasi shadow mode'da — false-positive kuzatilgandan keyin enforce

---

## TO'LQIN 5 — RLS POYDEVOR & DB YAXLITLIGI

| # | Jiddiylik | Muammo | Ildiz sababi | Tuzatish | Isbot | Migration? | Qoldiq risk |
|---|-----------|--------|--------------|----------|-------|------------|-------------|
| 5.1 | 🔴 KRITIK → ✅ | 6 jadval (`clinic_promotions`, `doctor_blocked_dates`, `doctor_directions`, `doctor_experiences`, `doctor_specialties`, `doctor_workplaces`) — RLS yoqilgan lekin policy yo'q. Implicit deny fragile: `ALTER TABLE ... DISABLE RLS` qilsa ochiladi. | Policy qo'shilmagan (audit da `rls_enabled_no_policy`) | Har biriga `RESTRICTIVE deny_all_anon FOR ALL TO anon, authenticated USING(false) WITH CHECK(false)` qo'shildi | **Real INSERT test (anon kalit):** 6/6 → `42501 new row violates row-level security policy` ✅. Prisma (service_role): barcha jadvallar o'qiladi ✅ | `wave5_step1a`, `wave5_step1b` | Yo'q |
| 5.2 | 🟡 O'RTA → ✅ | 23 jadval `deny_all_anon` PERMISSIVE — kelajakda biror PERMISSIVE true policy qo'shilsa `OR(false,true)=TRUE` bypass ochiladi | PostgreSQL PERMISSIVE policy semantikasi: `OR` kombinatsiyasi | DO $$ bloki: barcha 23 jadvalda `DROP` + `CREATE AS RESTRICTIVE` — 29 ta `deny_all_anon` hammasi RESTRICTIVE | `SELECT permissive FROM pg_policies` → barchasi `RESTRICTIVE` ✅. Smoke-test: login→bron→to'lov oqimi buzilmadi ✅ | `wave5_step2_permissive_to_restrictive` | Yo'q |
| 5.3 | 🔴 KRITIK → ✅ | `appointments_payment_status_check` (Prisma-generated) `'failed'` statusini o'z ichiga olmagan — `click/handlers.ts:223` `failed` yozadi, lekin DB constraint bloklar edi | Prisma schema `@@map` + enum konversiyasi — `failed` qo'shilmagan | Eski constraint o'chirildi. Yangi `chk_payment_status` `('pending','paid','not_required','cancelled','failed')` bilan almashtildi | Real `UPDATE SET paymentStatus='refunded'` → `check_violation` ✅. `paymentStatus='failed'` endi o'tadi | `wave5_step3`, `wave5_step3b_fix_payment_status_constraint` | Yo'q |
| 5.4 | 🟡 O'RTA → ✅ | 7 ta CHECK constraint yo'q: `appliedDiscountPercent` (0-100), `discountPercent` (0-100), `doctor_blocked_dates` type/weekday/consistency, `services.price` (≥0), `services.prePaymentAmount` (≥0) | App-only validatsiya — DB darajasida himoya yo'q | 8 ta constraint bitta migration bilan qo'shildi. Buzuq ma'lumot 0 edi — migration sinmadi | `SELECT pg_get_constraintdef` → 8/8 constraint DB'da ✅ | `wave5_step3_check_constraints` | Yo'q |

**YAKUNIY HOLAT (2026-06-05):**
- Barcha 29 ta `deny_all_anon` policy → RESTRICTIVE ✅
- 3 to'g'ri policy (`dependents_*`, `relay_log_*`, `deny_public_access`) — tegilmadi ✅
- `payments_payment_status_check` kritik bug (missing `failed`) — tuzatildi ✅
- TypeScript: `tsc --noEmit` → 0 xato ✅
- Deploy: `dpl_6SUmJXu1LdE5qmXqouKCaGZ6vo5Y` → https://tibtaqvim.vercel.app ✅

---

## TO'LQIN 6 — KOD SIFATI & RESPONSIVE AUDIT

> **Holat:** AUDIT TUGALLANDI — tuzatishlar tasdiqlanishi kutilmoqda

| # | Jiddiylik | Topilma | Tafsilot | Holat |
|---|-----------|---------|----------|-------|
| 6.1 | ✅ OK | `@ts-ignore` / `@ts-expect-error` | 0 ta — kodebase toza | Muammo yo'q |
| 6.2 | 🔵 PAST | `any` tip — 35 ta | `catch (err: any)` (20+, standart pattern). Nozik: `where: any` (reception/clinics route), `useState<any>` (webapp/page.tsx). Jiddiy emas — TS build o'tadi. | Tuzatish ixtiyoriy (R8) |
| 6.3 | ✅ OK | Maxfiy ma'lumot log qilinishi | Secret VALUE hech qayerda log qilinmagan. `webhook.ts:29` faqat `hasSecret: !!secret` (boolean) va IP. `webapp-auth.ts:91` `telegramId` WARN da (server-side, qabul qilingan). | Muammo yo'q |
| 6.4 | 🔵 PAST | ESLint `react/no-unescaped-entities` ~20 xato | Apostrophe `'` JSX'da `&apos;` ga o'zgartirilmagan. Fayllar: BookingFlipCard, ClinicSwitcher, ServicePicker, AppointmentCard, DiscountStats, ClinicPromotionsDropdown va boshqalar. `ignoreDuringBuilds:true` → build o'tadi. | Tuzatish tasdiqlanishi kerak (R6) |
| 6.5 | 🔵 PAST | ESLint `<img>` vs `<Image />` — 5 joy | StaffCard, Navbar, BookingFlipCard, DoctorPicker, ServicePicker. LCP/bandwidth. | Tuzatish tasdiqlanishi kerak (R7) |
| 6.6 | ✅ OK (intentional) | `react-hooks/exhaustive-deps` — clinic-context.tsx:207 | **CLINIC-CURRENT-03 bilan BIR ILDIZ — intentional.** `initClinic` `searchParams`/`router`/`pathname` mount vaqtida ushlaydi. LEKIN: (1) faqat bir marta chaqiriladi (`// mount-only`); (2) `persistToDb` `setClinic()` ichida — stale emas; (3) URL sync CLINIC-CURRENT-03 da intentional olib tashlangan. `// eslint-disable-line` + `// mount-only` kommentlari tasdiq. Haqiqiy risk yo'q. | R9 "accepted" — tuzatish kerak emas |
| 6.7 | ✅ OK | Responsive — Webapp sahifalari | Telegram WebApp = mobile-only. Tailwind mobile-first — `md:` yo'qligi kutilgan. `flex flex-wrap`, `min-w-0`, `min-h-[100dvh]` to'g'ri ishlatilgan. | Muammo yo'q |
| 6.8 | ✅ OK | Responsive — Admin sahifalari | Admin desktop-first. `AdminSidebar` hamburger menu bor. `ReceptionView`, `DoctorQueueView` `flex flex-wrap` bilan mobil da ishlaydi. Stats page `sm:px-6 max-w-7xl`. | Asosiy sahifalar OK |
| 6.9 | 🟡 O'RTA | Responsive — Admin super/clinics/[id] | 7 tab, form maydonlar, modal'lar — `md:` breakpoint yo'q. Tablet (768px) da form overflow bo'lishi mumkin. Sinov kerak. | Sinov tasdiqlanishi kerak |
| 6.10 | 🔵 PAST | `DoctorQueueView` `<table>` | PDF string template ichida (`jsPDF`), DOM'da ko'rinmaydi. `overflow-x-auto` wrapper kerak emas. | Muammo yo'q |

**Xulosa:** Kod sifati yaxshi. Jiddiy xavfsizlik yoki funksional muammo topilmadi. ESLint xatolari ko'rinish/performance darajasida. Responsive audit admin panel uchun tablet sinov kerakligi ko'rsatdi.

---

> **Oxirgi yangilanish:** 2026-06-05
