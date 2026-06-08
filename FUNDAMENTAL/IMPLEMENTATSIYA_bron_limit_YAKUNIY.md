# BRON LIMIT TIZIMI — YAKUNIY IMPLEMENTATSIYA (bir martada, mukammal)

> **Bu fayl Claude Code (VS Code companion) uchun yakuniy buyruq.** Repoga to'liq kirish bor: `oqiljonplay-ctrl/tibtaqvim`.
> **Maqsad:** Bu mavzuga boshqa qaytmaymiz. Bir martada toza, kamchiliksiz yakunlanadi.
> **Asosiy tamoyil:** SIFAT > TEZLIK. Shoshilma. Har bosqichni o'zing **vizual tekshir** (build, sahifa, ma'lumotlar), keyingisiga o't.
> **Diagnoz tugagan** (`IMPL_BRON_LIMIT.md`). Bu fayl o'sha diagnoz faktlariga tayanadi. **Lekin har faylni qaytadan o'qib** boshla — diagnoz eskirgan bo'lishi mumkin.
> **Test rejimi:** Hozir hamma akkaunt test. Data buzilsa zarar yo'q. Lekin kod mukammal bo'lsin.

---

## ⚠️ AVVAL O'QI: DIAGNOZDAN KELGAN KRITIK FAKTLAR

Bu loyihaga xos, e'tibordan qochmasligi SHART bo'lgan haqiqatlar (IMPL diagnozidan):

1. **Status nomlari DB'da boshqacha.** Biznes qoidadagi `pending` = DB `booked`. `no_show` = DB `missed`. **Hamma kodda DB nomini ishlat:** `booked / arrived / missed / cancelled` (+ yangi `expired`). "pending"/"no_show" so'zlarini kodga yozma.
2. **`paymentStatus` ≠ `status`.** Ikki alohida ustun. `paymentStatus` = text (`pending/paid/...`). Limit FAQAT `status` ga bog'liq, `paymentStatus` ga umuman tegmaydi.
3. **`Dependent` modeli BOR**, `BookingInput.dependentId` BOR. Faqat `Appointment.dependentId` DB ustuni YO'Q — migration kerak. `Dependent` soft-delete ishlatadi (`deletedAt`).
4. **Vercel Hobby = kuniga 2 cron, allaqachon 2 ta band.** 3-cron muammo bo'lishi mumkin (R3/4.3). Quyida aniq yechim bor.
5. **`prisma migrate dev` ishlamaydi** (shadow DB muammosi). Migration: SQL yozib, **Supabase MCP `apply_migration`** orqali. (Sening connectorlaringda Supabase MCP bor: project_id `lxqimithjjabhnldcugc`.)
6. **`git push` ≠ Vercel deploy.** Deploy: `npx vercel --prod --yes` MAJBURIY (yoki Vercel MCP orqali). Memory: deploy mo'rtligi hal bo'lgan, lekin baribir build tekshir.
7. **Bron mantiq markazi:** `src/lib/services/booking.service.ts` → `processBooking()` → `bookDoctorQueue()` / `bookDiagnostic()`. Transaction patterni saqlanadi.
8. **Saqlanadigan invariantlar (O'ZGARTIRMA):** `normalizePhone()`, `source:"bot"` notification flag, `clinicId` scope har so'rovda, `tibId` format, `withRetry()` pattern.

---

## QISM 1 — BIZNES QOIDALAR (yakuniy, o'zgarmas)

> Bular allaqachon kelishilgan. Aniqlik uchun takror. Har bandni amalga oshir.

| # | Qoida |
|---|---|
| BQ1 | Admin 3 son belgilaydi: `patientSelfLimit` (1–10, def 4), `dependentBookingLimit` (0–5, def 1), `maxDependents` (0–5, def 2). Har klinika mustaqil. |
| BQ2 | Faol bron = `status='booked'`. Limitga faqat shu kiradi. `arrived/missed/cancelled/expired` kirmaydi. |
| BQ3 | Bemor o'zi: bir vaqtda `patientSelfLimit` ta turli shifokorga faol bron. |
| BQ4 | Qaramog'idagi: HAR shaxs ALOHIDA `dependentBookingLimit` ta. (3 farzand + limit 1 = jami 3, har biri mustaqil.) `dependentBookingLimit=0` → qaramog'idagiga bron yo'q. |
| BQ5 | Bir shifokorga bir faol bron (butun kalendar, sanaga qaramay) — har shaxs uchun. |
| BQ6 | Bir kunda bir shifokorga bir bron (har shaxs uchun). |
| BQ7 | O'zi + farzand bir shifokorga bir kunga — ikkalasi OK (ikki shaxs). |
| BQ8 | Bron bo'shatuvchi 4 holat: shifokor "Keldi"(`arrived`) / "Kelmadi"(`missed`) / bemor bekor(`cancelled`) / avtomatik(`expired`). Bo'shagach qayta bron OK. |
| BQ9 | Avtomatik expiry: `status='booked'` AND `date < bugun(Asia/Tashkent)` → `expired`. Toshkent 00:00 da (UTC 19:00). Bugungi bron tegilmaydi. Misol: 31-avgust broni → 1-sentabr 00:00 da expired. |
| BQ10 | `maxDependents` ta qaramog'idagi qo'shish mumkin. Yetganda bloklanadi. |
| BQ11 | Qaramog'idagini o'chirsa → uning `booked` bronlari `cancelled`. |
| BQ12 | Limit kamaytirilsa: mavjud bronlar tegilmaydi, yangi bron faol soni limitdan past tushmaguncha bloklanadi. |
| BQ13 | UI: 5 status vizual farqlanadi. Bemorga "Faol bronlar: N/limit" sanagich (o'zi + har dependent alohida). Limit to'lganda tushunarli xabar. |
| BQ14 | Avtomatik expired → bemorga Telegram xabar. |
| BQ15 | Admin paneldagi HAR sozlama/funksiya yonida batafsil izoh (yangi 3 sozlama + mavjud funksiyalar). |

---

## QISM 2 — ISH USULI: BOSQICHMA-BOSQICH + VIZUAL TEKSHIRUV

> **Bu eng muhim qism.** Foydalanuvchi har bosqichni vizual ko'rib test qilishni so'radi. Quyidagi tartibni QAT'IY saqla.

**Har bosqich uchun majburiy tsikl:**
1. **O'qi** — tegishli mavjud fayllarni qaytadan o'qib chiq (diagnozga ishonma, tasdiqla).
2. **Yoz** — o'zgarishni kirit.
3. **Tekshir (build-level):** `npx tsc --noEmit` → 0 xato. Kerak bo'lsa `npm run build`.
4. **Tekshir (vizual/data-level):** bosqich turiga qarab:
   - DB bosqichi → Supabase MCP bilan `list_tables` / `execute_sql` orqali ustun/enum haqiqatan qo'shilganini KO'R.
   - API bosqichi → namuna so'rov (curl yoki test) bilan javobni KO'R, yoki kodni o'qib mantiqни isbotla.
   - UI bosqichi → **lokal `npm run dev` ishga tushir, brauzerda sahifani OCH, screenshot/HTML holatini tekshir.** Agar brauzer ochib bo'lmasa, kamida render bo'ladigan HTML/komponent strukturasini isbotla va menga "qanday ko'rinishini" tasvirlab ber.
5. **Hisobot ber** — menga qisqa: "Bosqich N tugadi. Nima qildim. Build natijasi. Vizual holat. Keyingi bosqich shu." va davom etishga ruxsat so'ra YOKI davom et (pastdagi avtonomlik qoidasiga qara).
6. **Commit** — atomik commit (har bosqich = 1 commit).

**Avtonomlik qoidasi:** DB va backend bosqichlarida (1–5) muammosiz bo'lsa o'zing davom et, lekin har bosqich oxirida qisqa hisobot qoldir. UI bosqichlarida (6–8) **vizual natijani ko'rsat** (screenshot yoki batafsil tavsif) va mening tasdig'imni kutmasdan davom etaver, ammo har sahifani ko'rsatib o't. Yakunda (Bosqich 10) deploydan oldin TO'LIQ hisobot ber va deploy ruxsatini so'ra.

---

## QISM 3 — BOSQICHLAR (ketma-ket)

### BOSQICH 0 — Tayyorgarlik
- `git status` toza, branch: `git checkout -b feat/booking-limits`.
- Quyidagilarni qaytadan o'qi (diagnoz qator raqamlari hali to'g'rimi tekshir):
  - `prisma/schema.prisma` (Appointment, Dependent, ClinicSettings, AppointmentStatus enum)
  - `src/lib/services/booking.service.ts` (`processBooking`, `bookDoctorQueue`, `bookDiagnostic`)
  - `src/lib/validators/booking.ts` (`BookingInput`)
  - `src/lib/workflow/appointment-workflow.ts`
  - `src/app/api/book/route.ts`
  - `vercel.json`
  - `src/lib/telegram/relay.ts` + `src/lib/services/confirmation.service.ts` (`sendTelegramConfirmation`)
  - `src/lib/api-response.ts`, `src/lib/auth.ts`, `src/lib/prisma.ts`, `src/lib/logger.ts`
  - Mavjud admin settings: `src/app/api/admin/super/clinics/[id]/settings/*`
  - Webapp: `src/app/webapp/page.tsx`, `BookingFlipCard.tsx`
  - Dependent API: `src/app/api/webapp/dependents/**` (DELETE bormi?)
- **Vercel plan aniqla:** Vercel MCP (`list_projects`/`get_project`) yoki dashboard orqali — Hobby yoki Pro? Bu Bosqich 4 (cron) yo'lini belgilaydi.
- **Hisobot:** topilgan har fayl holati + diagnozdan farq bo'lsa ayt.

---

### BOSQICH 1 — DB Migration
**Maqsad:** enum + 4 ustun + indexlar.

1. SQL migration yoz (`IMPL` 3.1–3.4):
   - `ALTER TYPE "AppointmentStatus" ADD VALUE 'expired';`
     > ⚠️ **Postgres cheklovi:** `ALTER TYPE ... ADD VALUE` ni ba'zi PG versiyalarida transaction ichida qo'shib bo'lmaydi (`enumlar commit kerak`). Buni ALOHIDA migration/statement sifatida bajar, keyingi DDL'lardan oldin commit bo'lsin.
   - `appointments.dependentId TEXT` + FK (`ON DELETE SET NULL`) + index.
   - `clinic_settings` 3 ustun (NOT NULL DEFAULT bilan — mavjud qatorlar buzilmaydi).
   - 3 ta index (limit count, dependent count, cron expire partial index).
2. **Prisma schema'ni qo'lda yangila** (enum'ga `expired`, Appointment'ga `dependentId` + relation, Dependent'ga `appointments Appointment[]`, ClinicSettings'ga 3 ustun).
3. **Supabase MCP** orqali `apply_migration` (project_id `lxqimithjjabhnldcugc`).
4. `npx prisma generate`.
5. **VIZUAL TEKSHIRUV (majburiy):** Supabase MCP `list_tables` yoki `execute_sql`:
   - `SELECT unnest(enum_range(NULL::"AppointmentStatus"));` → `expired` borligini KO'R.
   - `appointments` jadvalida `dependentId` ustuni borligini KO'R.
   - `clinic_settings` da 3 ustun borligini KO'R.
6. `tsc --noEmit` → 0 xato.
7. **Hisobot:** enum/ustunlar tasdiqlangan skrinshot yoki SQL natijasi.

> **XAVF B1:** `ADD VALUE 'expired'` qaytarib bo'lmaydi (enum value drop qilish qiyin). To'g'ri yozilganini bir marta tekshirib qo'y.

---

### BOSQICH 2 — Workflow: `expired` + `expireBookings()`
**Fayl:** `src/lib/workflow/appointment-workflow.ts`

1. `AppointmentStatus` type'ga `"expired"` qo'sh.
2. Mavjud status o'tish (transition) mantiqi bo'lsa — `expired` ga o'tish faqat `booked → expired` ruxsat etilsin (arrived/cancelled dan expired'ga o'tmasin).
3. `expireBookings(beforeDateStr)` funksiyasini yoz (`IMPL` 4.2):
   - `WHERE status='booked' AND date < cutoff` → `expired`.
   - `cutoff` = `beforeDateStr` (bugun, Asia/Tashkent) ning 00:00 i.
   - **TZ diqqat:** `date` ustuni `@db.Date`. Solishtirishda kun chegarasi to'g'ri bo'lsin. `cutoff = new Date(beforeDateStr + "T00:00:00.000Z")` — `@db.Date` UTC-neytral saqlanadi, lekin tekshir: bugungi (Toshkent) bron `< cutoff` bo'lib qolmasligi kerak. **Test bilan isbotla** (Bosqich 9).
4. `tsc --noEmit`.
5. **Hisobot:** funksiya mantiqi + TZ chegarasi qanday hisoblangani.

---

### BOSQICH 3 — Bron yaratish: limit tekshiruvi
**Fayl:** `src/lib/services/booking.service.ts`

1. `processBooking()` ichiga, service/block check dan KEYIN, create dan OLDIN limit blokini qo'sh (`IMPL` 4.1):
   - Settings ol (null-safe default: `?? 4`, `?? 1`).
   - `dependentId` bor → qaramog'idagi limiti (`depLimit===0` → `DEPENDENT_BOOKING_DISABLED`; count `>= depLimit` → `DEPENDENT_LIMIT_REACHED`).
   - `dependentId` yo'q → o'zi limiti (`selfCount >= selfLimit` → `PATIENT_LIMIT_REACHED`).
   - Bir shifokorga bir faol bron (`DOCTOR_ALREADY_BOOKED`).
   - **Dependent validatsiya:** `dependentId` berilsa, u shu `userId` ники va `deletedAt: null` ekanini tekshir (`DEPENDENT_NOT_FOUND`). Boshqaning dependent'iga bron qilib bo'lmasin (xavfsizlik).
2. **Atomarlik (R5):** limit count + `appointment.create` ni **bitta `prisma.$transaction`** ichida qil. Mavjud transaction patterniga moslab. Race oldini olish uchun count transaction ichida bo'lsin.
   > **Qo'shimcha himoya (tavsiya, ixtiyoriy):** partial unique index — bir shaxs+shifokorga bitta `booked`. Postgres: `CREATE UNIQUE INDEX ... ON appointments(userId, COALESCE(dependentId,''), clinicId, doctorId) WHERE status='booked';`. Bu app-level race'dan qochib qolganini ham DB darajasida ushlaydi. Agar qo'shsang — Bosqich 1 migration'ga kirit. **Qaror:** qo'shsang yaxshi, lekin avval mavjud data'da konflikt yo'qligini tekshir.
3. `bookDoctorQueue()` va `bookDiagnostic()` create'lariga `dependentId: input.dependentId ?? null` qo'sh.
4. Error kodlarini error-response mexanizmiga qo'sh (`IMPL` §6).
5. `tsc --noEmit`.
6. **VIZUAL/MANTIQ TEKSHIRUV:** kod yo'lini o'qib, har 5 ssenariy (BQ3–BQ7) qaysi shartda qaysi error qaytishini jadval qilib menga ko'rsat. Iloji bo'lsa, lokal dev'da bitta namuna bron so'rovini yuborib javobni ko'r.
7. **Hisobot.**

---

### BOSQICH 4 — Cron: expire-bookings + Telegram
1. **Vercel plan natijasiga qarab** (Bosqich 0):
   - **Pro bo'lsa:** `vercel.json` ga 3-cron `{ "path": "/api/cron/expire-bookings", "schedule": "0 19 * * *" }`.
   - **Hobby bo'lsa (2 cron limit):** ikki yo'l:
     - (a) **Birlashtir:** mavjud `reminders` yoki `ad-broadcast` cron route ichida expire mantiqini ham chaqir (bitta cron ikki ish qiladi). Lekin vaqt mos kelmasligi mumkin (reminders 03:00 UTC, expire 19:00 UTC kerak). Shuning uchun:
     - (b) **Supabase pg_cron (tavsiya):** Supabase MCP orqali `pg_cron` extension yoq, har kuni UTC 19:00 da `UPDATE appointments SET status='expired' WHERE status='booked' AND date < (now() AT TIME ZONE 'Asia/Tashkent')::date;` ishlatadigan job yarat. Telegram xabar uchun pg_cron faqat statusni o'zgartiradi, xabarni keyin bitta yengil cron yoki webhook yuboradi.
     - **Qaror:** Hobby bo'lsa pg_cron eng toza. Lekin pg_cron Telegram yubora olmaydi — shuning uchun: pg_cron statusni o'zgartiradi + bitta mavjud cronга "yangi expired bo'lganlarga xabar yuborish" qo'shiladi (yoki Telegram'siz qoldiriladi, keyin qo'shiladi). **Menga variantni ayt, men tanlayman.**
2. `src/app/api/cron/expire-bookings/route.ts` yarat (`IMPL` 4.3): `CRON_SECRET` auth, Asia/Tashkent bugungi sana, `expireBookings()`, keyin `notifyExpiredBookings()`.
3. Telegram xabar (`IMPL` 4.4): faqat **bu cron run'da yangi expired bo'lganlarga** (kechagi sana bronlari). `sendTelegramConfirmation` ishlat. **Throttle (R8):** ko'p bo'lsa ketma-ket emas, kichik kechikish bilan (rate limit).
   > **Diqqat:** "yangi expired" ni aniqlash — `updateMany` qaytaradigan count yetarli emas, qaysilar ekanini bilish kerak. Yechim: avval `findMany(booked, date<cutoff)` bilan ID'larni ol, keyin `updateMany`, keyin o'sha ID'larga xabar. Bitta transaction'da ID'larni qo'lga ol.
4. `CRON_SECRET` env borligini tekshir (`.env`, Vercel env). Yo'q bo'lsa qo'sh.
5. `tsc --noEmit`.
6. **VIZUAL TEKSHIRUV:** lokal dev'da `GET /api/cron/expire-bookings` ni `CRON_SECRET` bilan chaqir → javob `{expired: N, date: "..."}` ni KO'R. Test data: bitta kechagi `booked` bron yaratib, cron'dan keyin `expired` bo'lganini Supabase'da KO'R. Bugungi bron tegilmaganini ham KO'R.
7. **Hisobot:** cron yo'li (Vercel yoki pg_cron), test natijasi.

---

### BOSQICH 5 — Admin settings API
**Fayl:** `src/app/api/admin/clinic-settings/route.ts` (yangi)

1. `GET` + `PUT` (`IMPL` 4.5): rol tekshiruvi (`clinic_admin/branch_admin/super_admin` GET; `clinic_admin/super_admin` PUT), `auth.clinicId` scope, diapazon validatsiya (1-10, 0-5, 0-5), `upsert`.
   > **Diqqat:** `branch_admin` PUT qila oladimi? Klinika-darajali sozlama bo'lgani uchun faqat `clinic_admin`+`super_admin` o'zgartirsin, `branch_admin` faqat ko'rsin (GET). Tasdiqla yoki shunday qil.
2. `tsc --noEmit`.
3. **VIZUAL TEKSHIRUV:** lokal dev'da `GET` → joriy 3 qiymat; `PUT` noto'g'ri qiymat (masalan selfLimit=0) → 400 xato; to'g'ri qiymat → saqlanadi. Supabase'da o'zgarganini KO'R.
4. **Hisobot.**

---

### BOSQICH 6 — Admin settings UI + izohlar
**Fayl:** `src/app/admin/(panel)/settings/page.tsx` (mavjud bo'lmasa yangi) + sidebar'ga "Sozlamalar" qo'shish.

1. 3 ta number input, diapazon validatsiya (frontend ham), Saqlash tugmasi.
2. **Har input yonida batafsil izoh** (`IMPL` 4.5 matnlari — o'zbekcha, misol bilan). Tooltip yoki input ostida kichik kulrang matn.
3. **Sidebar:** `AdminSidebar.tsx` ga `{ href: "/admin/settings", label: "Sozlamalar", roles: ["clinic_admin","super_admin"] }`. (Eslatma: oldingi tuzatishdan keyin sidebar `/admin/*` scope'da — yangi sahifa ham shu layout ichida.)
4. **Responsive (MAJBURIY):** `components/layout/` primitivlari (Container/Stack). xs/md/lg/2xl.
5. `tsc --noEmit`.
6. **VIZUAL TEKSHIRUV (majburiy):** `npm run dev`, brauzerda `/admin/settings` ni OCH. **Screenshot ol yoki batafsil tasvirla:** 3 input ko'rinadimi, izohlar o'qiladimi, saqlash ishlaydimi, mobil (xs) da chiroyli tartibdami. Menga ko'rsat.
7. **Hisobot + vizual.**

---

### BOSQICH 7 — Bemor webapp UI: ranglar + sanagich + xabarlar
**Fayllar:** `src/app/webapp/page.tsx`, `BookingFlipCard.tsx`

1. **Status ranglari** (`IMPL` §5): 5 status uchun Tailwind klasslar (booked/arrived/missed/cancelled/expired). Badge + fon + (cancelled strikethrough, expired "muddati o'tdi" yorlig'i).
2. **Faol bron sanagich** (BQ13): "Faol bronlaringiz: N/limit" — o'zi (`dependentId=null`, `booked`) uchun. Har qaramog'idagi uchun ham alohida "N/limit". Limitni `/api/webapp/...` orqali yoki settings'dan ol.
3. **Limit to'lganda xabar:** bron qilolmasa, error kod (`PATIENT_LIMIT_REACHED`/`DEPENDENT_LIMIT_REACHED`) ga qarab tushunarli o'zbekcha matn + "Avval bironni bekor qiling yoki shifokor tasdig'ini kuting" + faol bronlar ro'yxatiga ishora.
4. **Dependent qo'shish:** `maxDependents` ga yetganda "qo'shish" tugmasi bloklanadi + izoh ("Limit: 2 ta a'zo. Yangi qo'shish uchun admin limitни oshirishi kerak.").
5. **Responsive** — webapp allaqachon responsive (memory), buzilmasin.
6. `tsc --noEmit`.
7. **VIZUAL TEKSHIRUV (majburiy):** `npm run dev`, webapp'ni OCH. Turli statusли bronlar ranglari farqlanadimi, sanagich to'g'rimi, limit xabari chiqadimi. **Screenshot/tasvir ber.** Mobil ko'rinishni ham.
8. **Hisobot + vizual.**

---

### BOSQICH 8 — Dependent o'chirish → bronlar cancel
**Fayl:** `src/app/api/webapp/dependents/[id]/route.ts` (DELETE)

1. (`IMPL` 4.7) Transaction: dependent soft-delete (`deletedAt`) + uning `booked` bronlarini `cancelled`.
2. Faqat egasi (`userId === auth.userId`) o'chira olsin.
3. `tsc --noEmit`.
4. **VIZUAL/MANTIQ TEKSHIRUV:** test dependent + uning faol broni → o'chir → bron `cancelled` bo'lganini Supabase'da KO'R, dependent `deletedAt` to'lganini KO'R.
5. **Hisobot.**

---

### BOSQICH 9 — Mavjud admin funksiyalariga izoh (BQ15)
1. Bosqich 0 da topilgan mavjud admin funksiyalari (Xizmatlar, Shifokorlar, Xodimlar, Filiallar, Telegram postlar, Broadcast, Qabulxona, Navbat) — har birida sozlama/tugma yoniga qisqa, sodda o'zbekcha izoh.
2. Izoh uslubi: bir-ikki jumla, kerak bo'lsa misol. "Hech narsa tushunmaydigan xodim ham tushunsin."
3. Joylashuv: sarlavha ostida kulrang matn yoki (ℹ️) tooltip. Bir xil uslub butun panelda.
4. `tsc --noEmit`.
5. **VIZUAL TEKSHIRUV:** har admin sahifani OCH, izohlar joyida va o'qiladigan ekanini ko'rsat (screenshot/tasvir).
6. **Hisobot.**

---

### BOSQICH 10 — To'liq test, build, DEPLOY
1. **QISM 4 dagi BARCHA testni** o'tkaz (har birini natija bilan belgila).
2. `npx tsc --noEmit` → 0 xato.
3. `npm run build` → muvaffaqiyatli.
4. **TO'LIQ HISOBOT ber** menga: nima qilindi, har bosqich vizual natijasi, test natijalari, qolgan biror nuance.
5. **Deploy ruxsatini SO'RA.** Men "deploy qil" desam:
   - `git add -A && git commit` (atomik commitlar allaqachon bo'lsa — merge), `git push`.
   - `npx vercel --prod --yes` (yoki Vercel MCP `deploy_to_vercel`).
   - Deploy READY bo'lganini tasdiqla.
   - Production URL'da bitta-ikkita smoke test (admin settings ochiladimi, webapp ishlaydimi).
6. **Yakuniy hisobot + production tasdiq.**

---

## QISM 4 — TO'LIQ TEST REJASI (Bosqich 10 da)

**Bemor o'zi:**
1. `patientSelfLimit=4` → 4 turli shifokorга OK, 5-chiga `PATIENT_LIMIT_REACHED`.
2. 1 ta `cancelled` → count kamaydi → yangi bron OK.
3. `arrived` → bo'shadi → o'sha shifokorga qayta bron OK.
4. `missed` → bo'shadi.
5. Bir kunda bir shifokorga 2-bron → rad (`DOCTOR_DUPLICATE`/mavjud).
6. Bir shifokorga 2-faol bron (boshqa kun) → `DOCTOR_ALREADY_BOOKED`.
7. O'zi + farzand bir shifokorga bir kunga → ikkalasi OK.

**Qaramog'idagi:**
8. `dependentBookingLimit=1` → farzand 1 ta OK, 2-chi `DEPENDENT_LIMIT_REACHED`.
9. Farzand broni bekor → yangi OK.
10. 2 farzand mustaqil: 1-chi to'lsa ham 2-chi bron qiladi.
11. `dependentBookingLimit=0` → `DEPENDENT_BOOKING_DISABLED`.
12. `maxDependents=2` → 3-farzand qo'shish bloklanadi.
13. Farzand o'chirilsa → `booked` bronlari `cancelled`.
14. Boshqa user'ning dependent'iga bron → `DEPENDENT_NOT_FOUND`.

**Cron/expiry:**
15. Kechagi `booked` → cron → `expired`, limitdan bo'shadi.
16. Bugungi `booked` → cron → TEGILMAYDI.
17. Toshkent 00:00 (UTC 19:00) chegarasi to'g'ri.
18. Expired → Telegram xabar yuborildi (yoki pg_cron yo'li bo'lsa, status o'zgardi).

**Admin:**
19. 3 sozlama saqlash + diapazon validatsiya (1-10, 0-5, 0-5).
20. Boshqa klinika admini mustaqil (bir-biriga ta'sir yo'q).
21. Har sozlama yonida izoh ko'rinadi.
22. Mavjud funksiyalarga izoh qo'shildi.

**UI:**
23. 5 status vizual farqlanadi (webapp + admin).
24. "Faol bronlar: N/limit" to'g'ri (o'zi + har dependent).
25. Limit to'lganda tushunarli xabar.

**Regressiya:**
26. Multi-clinic, mehmon bemor, bot orqali bron, RLS — buzilmagan.
27. Oldingi sidebar/navbar/profil tuzatishi buzilmagan.
28. `tsc --noEmit` + `npm run build` toza.

---

## QISM 5 — RISKLAR (oldindan ogohlantirish + yechim)

| # | Risk | Muhimlik | Yechim |
|---|---|---|---|
| R1 | Status termin (booked≠pending) chalkashishi | Yuqori | Kodda faqat DB nomi: booked/arrived/missed/cancelled/expired |
| R2 | `paymentStatus` bilan `status` aralashishi | Yuqori | Limit FAQAT `status`. paymentStatus'ga tegmaydi |
| R3 | Vercel Hobby 2-cron limiti | O'rta | Bosqich 0 da plan aniqla. Hobby → pg_cron (Bosqich 4) |
| R4 | TZ chegarasi (UTC vs Tashkent) — bugungi bron noto'g'ri expired | Yuqori | `toLocaleDateString("sv-SE",{timeZone:"Asia/Tashkent"})`. Bosqich 9 test 16-17 bilan ISBOTLA |
| R5 | Race condition (limitdan oshiq bron) | O'rta | count+create bitta transaction; ixtiyoriy partial unique index |
| R6 | `ADD VALUE 'expired'` transaction ichida ishlamasligi (PG) | O'rta | Alohida statement, commit alohida (Bosqich 1) |
| R7 | "Yangi expired" ni aniqlash (xabar uchun) | O'rta | findMany→ID'lar→updateMany→ID'larga xabar (Bosqich 4) |
| R8 | Telegram rate limit (ko'p expired) | Past | Throttle/kechikish |
| R9 | ClinicSettings yo'q klinika | Past | null-safe default (`?? 4` v.h.) + upsert |
| R10 | Dependent o'chirilganda yetim bron | Past | Transaction: o'chirish + cancel (Bosqich 8) |
| R11 | Boshqaning dependent'iga bron (xavfsizlik) | O'rta | dependentId egasi+deletedAt:null tekshir (Bosqich 3) |
| R12 | Deploy: git push ≠ vercel deploy | O'rta | `npx vercel --prod --yes` (Bosqich 10) |
| R13 | Migration qaytarib bo'lmasligi (enum) | Past (test rejim) | To'g'ri yoz, bir marta tekshir. Test rejim — data zarar yo'q |
| R14 | Responsive buzilishi | O'rta | Har UI bosqichda xs/md/lg/2xl vizual tekshir |

---

## QISM 6 — SAVOLLAR / QAROR TALAB QILADIGANLAR

Quyidagilarni Bosqich 0 hisobotida menga ber (boshlashdan oldin yoki jarayonda):

1. **Vercel plan** — Hobby yoki Pro? (Cron yo'lini belgilaydi.)
2. **Cron yo'li** — Hobby bo'lsa: pg_cron (status) + mavjud cronга xabar qo'shish, yoki Telegram'ni keyinroq? Variantni tavsiya qil, men tasdiqlayman.
3. **`branch_admin`** limitni o'zgartira oladimi yoki faqat ko'radimi? (Tavsiyam: faqat ko'rsin.)
4. **Partial unique index** (race himoyasi) — qo'shaymizmi? Mavjud data'da konflikt bo'lmasa qo'shgan ma'qul.
5. **Admin settings sahifasi** — yangi `/admin/settings` mi yoki Dashboard ichida bo'limmi? (Tavsiyam: yangi sahifa.)

> Agar javob kutib o'tirmasdan davom etsang — har savol uchun **tavsiya qilingan variant** bilan davom et, lekin hisobotda "shu variantni tanladim, o'zgartirmoqchi bo'lsangiz ayting" deb belgila.

---

## QISM 7 — YAKUNIY ESLATMA

- **Sifat > tezlik.** Har bosqichni vizual tekshir, keyin o't.
- **Har faylni qaytadan o'qib** boshla, diagnozga ko'r-ko'rona ishonma.
- **DB nomlarini** ishlat (booked/missed), biznes qoidadagi pending/no_show emas.
- **paymentStatus'ga tegma** — limit faqat `status`.
- **Test rejim** — data buzilsa zarar yo'q, lekin kod mukammal.
- **Deploy faqat ruxsatdan keyin**, `npx vercel --prod`.
- Tushunarsiz joy → taxmin qilma, so'ra.

**Boshla: BOSQICH 0 — tayyorgarlik va repo qayta o'qish. Hisobot ber, keyin BOSQICH 1 ga o't.**
