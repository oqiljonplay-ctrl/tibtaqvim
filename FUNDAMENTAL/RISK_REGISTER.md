# TibTaqvim — Risk Register

> **Yangilandi:** 2026-06-05 (To'lqin 1–6 yakunida)  
> Faqat OCHIQ risklar. Yopilganlar pastdagi jadvalda.

---

## OCHIQ RISKLAR

| # | Risk | Jiddiylik | Nega hozir tuzatilmadi | Xavf darajasi | Vaqtinchalik yumshatish | Qachon tuzatish |
|---|------|-----------|------------------------|---------------|------------------------|-----------------|
| R1 | **WebApp initData enforce qilinmagan (log-only)** — initData yubormaydigan clientlar hali ham ishlaydi. Soxta `telegramId` bilan boshqa bemorning bronlarini ko'rish mumkin (SELECT). | 🟠 YUQORI | Backward compat: mavjud webapp frontend `x-telegram-init-data` header yubormasligi mumkin. Avval frontend yangilash kerak (M-4). | Real Telegram WebApp'da `initData` avtomatik mavjud — haqiqiy foydalanuvchi soxta ID yubora olmaydi. Brauzerdan to'g'ridan kirish mumkin. | `console.warn` log yoziladi. Monitoring orqali unverified access ko'rish mumkin. | Frontend header qo'shib → enforce rejim. **M-4** |
| R2 | **Rate limiting enforce qilinmagan** — Login brute-force, book spam himoyasi shadow mode'da (faqat log, bloklash yo'q) | 🟠 YUQORI | Wave 4 da DB-backed counter qo'shildi, lekin `RATE_LIMIT_ENFORCE=false` | 1–2 kun log kuzatib false-positive tekshirish kerak | DB counter to'planmoqda (haqiqiy traffic ko'rinmoqda) | `RATE_LIMIT_ENFORCE=true` Vercel'da. **M-3** |
| R3 | **connection_limit=1 Vercel'da yo'q** — pgBouncer pool exhaustion ≥10 parallel request'da HTTP 500 | 🔴 KRITIK | `.env.local` da bor, lekin Vercel Production env'ga qo'shilmagan (Wave 3 topildi) | Peak load'da (≥10 parallel) bron muvaffaqiyatsiz tugashi mumkin | Hozircha traffic past — yuzaga kelmagan | Vercel env'ga `&connection_limit=1` qo'shish. **M-1** |
| R4 | **Payme/Click real integratsiya hali sinovdan o'tmagan** — sandbox test qilinmagan, webhook callback ishlaydimi? | 🟡 O'RTA | Merchant akkaunt ulanmagan | Real to'lov olinsa callback kod xatosi bo'lishi mumkin | To'lov moduli hali disabled (paymentConfig=null) | Sandbox test. **M-5, M-6** |
| R5 | **PAYMENT_ENCRYPTION_KEY yo'q** — merchant kalitlar plain text DB'da | 🟡 O'RTA | Real merchant hali ulanmagan | Merchant kalitlari DB'ga qo'shilsa plain text saqlanadi | Merchant ulanmagan — xavf yo'q hozir | AES-256-GCM kalit. **M-7** |
| R6 | **ESLint react/no-unescaped-entities (~20 error)** — apostrophe `'` JSX'da escaped emas | 🔵 PAST | `ignoreDuringBuilds: true` — build sinmaydi. Visual bug ba'zi brauzerlarda | Minimal — aksariyat brauzerlarda ko'rinmaydi | Build o'tadi | Wave 6 tuzatish (tasdiqlangach) |
| R7 | **`<img>` vs `<Image />` (5 joy)** — LCP performance: StaffCard, Navbar, BookingFlipCard, DoctorPicker, ServicePicker | 🔵 PAST | Funksional ishlaydi, optimallashtirish kerak | LCP sekinlashuvi | — | Wave 6 tuzatish |
| R8 | **`any` tipi muhim joylarda** — `where: any` (reception/clinics API), `useState<any>` (webapp) | 🔵 PAST | Type safety yo'qolishi mumkin, lekin runtime'da xato bo'lmaydi | Latent type error ehtimoli | TS build o'tadi | Wave 6 refactor |
| ~~R9~~ | ~~`react-hooks/exhaustive-deps` — `clinic-context.tsx:207`~~ — **QABUL QILINGAN DIZAYN** | ✅ | `initClinic` `searchParams`/`router`/`pathname` ni mount vaqtida ushlaydi. LEKIN: (1) faqat bir marta, mount-da chaqiriladi (`// mount-only`); (2) `persistToDb` `initClinic` ichida EMAS — `setClinic()` ichida, stale emas; (3) CLINIC-CURRENT-03 da URL sync intentional olib tashlangan (DB poisoning bo'lgan). `// eslint-disable-line` + `// mount-only` kommentlari intentional. | Haqiqiy risk yo'q — ESLint warning `initClinic` stable bo'lgani uchun zararsiz | — | Tuzatish kerak emas |
| R10 | **Ad campaign IDOR: 403 vs 404** — mavjudlikni oshkor qilishi mumkin | 🔵 PAST | Admin endpoint (valid JWT kerak) → xavf minimal | Juda past | — | Keyingi code-quality round |
| R11 | **`getBranchScope` 500 vs 400** — undefined clinicId `throw` → HTTP 500, 400/401 bo'lishi kerak | 🔵 PAST | Xavfsiz (leakage yo'q), faqat log signali noto'g'ri | Juda past | 500 log bo'ladi | Code quality round |
| R12 | **Vercel Cron: Hobby plan 1 ta limit** — 3 ta cron kerak, faqat 1 ruxsat | 🟡 O'RTA | Hobby plan | Ikkinchi/uchinchi cron ishlamasligi mumkin | Qo'lda tekshirish | Pro plan yoki tashqi cron (cron-job.org) |
| R13 | **Admin/qabulxona/shifokor sahifalari real qurilmada TEKSHIRILMAGAN** — kod strukturasi ko'rildi (`flex-wrap`, `min-w-0`, sidebar hamburger), lekin haqiqiy xs/md/lg/2xl render testi bajarilmagan. `admin/super/clinics/[id]` 7-tab modal tablet (768px) da overflow shubhasi ochiq. | 🟡 O'RTA | Responsive eng past ustuvorlik — audit ko'rgazmali bo'lmagan (DevTools/qurilma yo'q). | Kod strukturasi yaxshi ko'rinadi, lekin "ko'rilgan" ≠ "sinovdan o'tgan". | Admin panel desktop-first dizayn (klinika admin kompyuterda) | Kelajakda real qurilma/Chrome DevTools responsive mode testi |

---

## YOPILGAN RISKLAR

| # | Risk | To'lqin | Sana |
|---|------|---------|------|
| ~~R_OLD_3~~ | RLS policy'lar to'liq emas (15+ jadval) | Wave 5 | 2026-06-05 |
| ~~R_OLD_2~~ | Rate limiting in-memory Map (Vercel'da ishlamaydi) | Wave 4 | 2026-06-05 |
| ~~R_OLD_5~~ | Bot state in-memory Map | Wave 4 | 2026-06-03 |
| ~~R_OLD_IDOR~~ | IDOR: appointmentId cross-clinic | Wave 1 | 2026-06-02 |
| ~~R_OLD_SCOPE~~ | getBranchScope clinicId=undefined → barcha records | Wave 1 | 2026-06-02 |
| ~~R_OLD_TOCTOU~~ | queueNumber TOCTOU, slot capacity TOCTOU, duplicate check | Wave 2 | 2026-06-04 |
| ~~R_OLD_STATE~~ | State machine: expired terminal holat bypass | Wave 2 | 2026-06-04 |
| ~~R_OLD_PERMISSIVE~~ | 23 PERMISSIVE deny → bypass xavfi | Wave 5 | 2026-06-05 |
| ~~R_OLD_PAYMENT_CHECK~~ | `appointments_payment_status_check` `failed` bloklar (Click bug) | Wave 5 | 2026-06-05 |

---

> **Oxirgi yangilanish:** 2026-06-05 (To'lqin 6 auditdan keyin)
