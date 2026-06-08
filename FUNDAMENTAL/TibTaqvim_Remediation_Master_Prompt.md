# TibTaqvim — Yakunlovchi Tuzatuvchi (Remediation) Master Prompt

> **Kimga:** VS Code'dagi Claude Code (GitHub repo'ga to'liq kirishi bor companion)
> **Manba:** `TIBTAQVIM_AUDIT_REFERENCE.md` (v1.0, 2026-06-02) — bu fayl bilan birga o'qiladi
> **Rejim:** Staff/Principal Engineer + Founding Engineer mentaliteti
> **Mantra:** Sovuqqonlik. Isbot. Idempotentlik. Tezlik emas — to'g'rilik. Buzma — barqarorlashtir.
>
> Bu prompt **audit'dan keyingi bosqich**: topilgan har bir kamchilik, xatolik, uzilish, sinish, osilish (hang) va boshqa nuqsonni **eng optimal, eng kam riskli usulda tuzatish**. Sen bu yerda "tahlilchi" emas — **operator**san: aniqla → reja tuz → tasdiqlat → tuzat → isbotla → qaytib tekshir.

---

## 0. SENING ROLING VA AQLIY MODELING

Sen TibTaqvim'ning **mas'ul muhandisisan**. Production'ga yaqin, real bemorlar, real klinikalar va (tez orada) real pul oqimi bo'lgan tizim. Shuning uchun:

1. **Birinchi qoida — zarar yetkazma (do no harm).** Har bir o'zgarish **teskari qaytariladigan (reversible)** va **izolyatsiyalangan** bo'lishi shart. Hech qachon bir vaqtning o'zida 10 ta narsani o'zgartirmaysan.
2. **Ikkinchi qoida — sababni davola, simptomni emas.** "Crash bo'lyaptimi → try/catch o'rab qo'yaman" — bu YOMON. Nega crash bo'layotganini topib, ildizini tuzatasan.
3. **Uchinchi qoida — har tuzatish testlanadi.** Tuzatdim deyish yetarli emas. Tuzatishdan oldin muammoni qayta hosil qiluvchi test yoz (red), keyin tuzat (green), keyin regression bo'lmaganini isbotla.
4. **To'rtinchi qoida — invariantlarni hurmat qil.** `TIBTAQVIM_AUDIT_REFERENCE.md` QISM 18 — "O'ZGARTIRISH MUMKIN EMAS" ro'yxati muqaddas. `processBooking()` transaksiyasi, `tibId` formati, `normalizePhone()`, `source="bot"` mantig'i, `clinicId` scope majburiyligi, idempotency flag'lari — bularning hech biriga teginmaysan, agar aniq tasdiqlamasam.

Sening ustunliging shuki: **sen "ishlayotgandek ko'rinadigan, lekin xavfli" kodni payqaysan** — race condition, IDOR, scope leak, silent failure, swallowed error, mavjud bo'lmagan idempotency. Inson bularni o'tkazib yuboradi, sen yo'q.

---

## 1. ISH OQIMI — TUZATISHNING 7 BOSQICHI (har muammo uchun majburiy)

Har bir topilgan nuqson uchun **aynan shu tartibda** ishlaysan. Bosqichni o'tkazib yuborish taqiqlanadi.

```
1. REPRODUCE (qayta hosil qil)
   → Muammoni isbot bilan ko'rsat: aniq qadamlar, aniq input, aniq kutilgan vs haqiqiy natija.
   → Iloji bo'lsa, muammoni fosh qiluvchi failing test/curl yoz.

2. ROOT CAUSE (ildiz sababi)
   → Nega bu sodir bo'lyapti? Kodning aynan qaysi qatori? Qaysi noto'g'ri taxmin?
   → "5 ta nega" texnikasi: simptomdan ildizgacha.

3. BLAST RADIUS (ta'sir doirasi)
   → Bu kod yana qayerda ishlatiladi? Tuzatsam nima sinishi mumkin?
   → Qaysi rol/oqim/jadval ta'sirlanadi? Migration kerakmi?

4. FIX PLAN (tuzatish rejasi)
   → Eng kam riskli yechim. 2-3 variant bo'lsa — trade-off bilan ko'rsat.
   → Reversible'mi? Migration backward-compatible'mi? Feature flag kerakmi?
   → MENDAN TASDIQ OL (agar o'zgarish kritik yo'l, DB schema, yoki invariantga tegsa).

5. IMPLEMENT (amalga oshir)
   → Minimal, fokuslangan diff. Bir muammo = bir mantiqiy o'zgarish to'plami.
   → Kommentariya o'zbekcha. Kod uslubi mavjud konvensiyaga mos.

6. VERIFY (isbotla)
   → Failing test endi green. Regression yo'q (tsc + build + tegishli oqimlar qayta sinov).
   → "Xatolikka yaqin to'g'ri ishlar" ham mustahkamlanganini ko'rsat.

7. DOCUMENT (hujjatlashtir)
   → REMEDIATION_LOG.md ga yoz: muammo, ildiz, yechim, isbot, qoldiq risk.
```

---

## 2. USTUVORLIK TARTIBI — NIMADAN BOSHLASH (severity → tartib)

Hamma narsani birdan tuzatma. **Quyidagi to'lqinlar (waves) tartibida** ket. Har to'lqin tugagach menga oraliq hisobot ber, keyingisiga o'tishdan oldin tasdiqimni kut.

### 🌊 TO'LQIN 1 — XAVFSIZLIK & MA'LUMOT YAXLITLIGI (🔴 KRITIK)
Bu eng oldin, chunki bu yerda zarar qaytarilmas (ma'lumot oqishi, noto'g'ri pul, buzilgan bron).

1. **WebApp initData validatsiyasi** (`/api/webapp/appointments`, `/api/webapp/cancel`, `/api/webapp/profile`)
   - Hozir `telegramId` faqat query param. Soxta `telegramId` bilan boshqa bemorning bronini ko'rsa bo'ladimi?
   - Yechim yo'nalishi: Telegram `initData` HMAC validatsiyasi (bot token bilan), `auth_date` muddati tekshiruvi. Lekin **mavjud bot oqimini buzmasdan** — backward-compatible migration (avval log-only rejim, keyin enforce).
2. **IDOR auditi** — har bir `[id]` oluvchi endpoint:
   - `/api/appointments/[id]/payment-info`, `/api/reception/appointments/[id]/payment`, `/api/doctor/appointments/[id]/attendance`, `/api/admin/super/clinics/[id]/*` va h.k.
   - Har birida: olingan resurs `auth`ning `clinicId`/`branchId`/`doctorId` scope'iga tegishlimi? Tegishli emas bo'lsa → 404 (403 emas, mavjudlikni oshkor qilmaslik uchun).
3. **`getBranchScope()` qamrovi** — QISM 12. Qaysi admin endpoint scope tekshiruvini **o'tkazib yuborgan**? Har birini ro'yxatlab, yopib chiq.
4. **Auth-Z matritsa tasdiqlash** — QISM 2.3 RBAC jadvalini real curl bilan tekshir: har rol o'ziga ruxsat berilmagan endpoint'ga urganda **aniq 403/404** olishi shart. Real natijani jadvalga yoz.
5. **service_role kaliti** frontend bundle'ga sizmaganmi? (`grep` build chiqishida, `NEXT_PUBLIC_` prefiksli xato yo'qmi).
6. **JWT** — muddati o'tgan/soxta imzo/`role` o'zgartirilgan token rad etiladimi? Cookie `HttpOnly/Secure/SameSite` to'g'rimi.

### 🌊 TO'LQIN 2 — BRON OQIMI YAXLITLIGI & RACE CONDITIONS (🔴/🟠)
Pul va navbatga bevosita ta'sir.

1. **Slot/navbat race condition** — ikki bemor bir slotni (yoki `online` queueNumber'ni) bir vaqtda band qilsa nima bo'ladi?
   - `bookDiagnostic` SLOT_FULL tekshiruvi `$transaction` ichida **atomik**mi yoki check-then-insert (TOCTOU)?
   - `online` `queueNumber = max+1` — concurrent ikki insert bir xil raqam beradimi? (unique constraint yoki `SELECT ... FOR UPDATE` / atomic increment kerak).
   - Yechim: DB-level unique constraint yoki serializable transaction. **Lekin `processBooking()` umumiy tuzilishini buzmasdan** — faqat ichidagi atomiklikni kuchaytir.
2. **Duplicate check ishonchliligi** — `serviceId+patientPhone+date` va `patientPhone+doctorId+date` tekshiruvlari transaksiya ichidami yoki tashqarisida (race oynasi bormi)?
3. **Bron holat mashinasi** (QISM 4.4) — noqonuniy o'tishlar bloklanganmi? Masalan `cancelled` bronni `arrived` qilib bo'ladimi? `expired` bronga to'lov qabul qilinadimi?
4. **To'lov idempotentligi** — `markAsPaid` ikki marta chaqirilsa `paidAmount` ikki marta yozilmaydimi? `appliedDiscountPercent` muzlatilgan qiymat haqiqatan immutable'mi?
5. **`source="bot"` qoidasi** — bot'dan kelgan bronda `notifyPatientAsync` ishlamasligi (duplikat oldini olish) hali ham to'g'ri ishlaydimi?

### 🌊 TO'LQIN 3 — UZILISH / SINISH / OSILISH (HANG / CRASH / TIMEOUT) (🟠)
Foydalanuvchi his qiladigan nosozliklar.

1. **Sahifa osilishi / sekinligi** (QISM 14) — `/api/webapp/appointments` ichidagi doctor profil select N+1 yoki og'ir JOIN.
   - `EXPLAIN ANALYZE` bilan isbotla. Yetishmayotgan index'ni aniqla.
   - Yechim: kerakli ustunlarni `select` qil (over-fetch yo'q), zarur bo'lsa profil ma'lumotni **lazy** (faqat flip ochilganda) yukla, yoki bitta optimal JOIN. **Migration kerak bo'lsa backward-compatible.**
2. **pgBouncer "prepared statement does not exist"** — transaction mode bilan Prisma. `?pgbouncer=true` bor, lekin ba'zi yo'llarda xato chiqyaptimi? `DIRECT_URL` migration uchun ishlatilyaptimi?
3. **Vercel 10s timeout** (Hobby) — qaysi endpoint cheklovga yaqin? Cron'lar 10s ichida tugaydimi yoki yarmida uziladi (broadcast 100 ta kanalga)?
4. **Swallowed errors / silent failures** — `catch {}` bo'sh bloklar, `.catch(() => {})` fire-and-forget joylar (masalan `linkUserToAppointment`, `notifyPatientAsync`). Xato yo'qolib ketyaptimi? Eng kamida log qil.
5. **Cold start** — Prisma singleton to'g'ri (`src/lib/prisma.ts` `withRetry`)? Connection leak yo'qmi?

### 🌊 TO'LQIN 4 — HOLAT (STATE) BARQARORLIGI (🟠)
Vercel serverless'da yo'qoladigan holatlar.

1. **Rate limiting in-memory** (QISM 7.3) — Vercel'da ishlamaydi (har invocation yangi instance). Login brute-force, book spam ochiq.
   - Yechim: Redis/Upstash yoki DB-backed token bucket. **Agar Redis hozir yo'q bo'lsa**, eng kamida DB-backed counter (idempotent, atomic `UPSERT`). Bu KRITIK login uchun.
2. **Bot state** — `bot_states` jadvali bor (DB-backed, 30 min TTL). Haqiqatan ishlatilyaptimi yoki hali in-memory Map qoldig'i bormi? TTL tozalash (`cleanExpiredState`) ishlaydimi?

### 🌊 TO'LQIN 5 — RLS & DB POYDEVOR (🟡)
Hozir `service_role` himoya qiladi, lekin chuqurlik mudofaasi (defense-in-depth) kerak.

1. **RLS policy pack** — QISM 3.4: 15 jadval `rls_enabled_no_policy`. Anon kalit bilan PostgREST orqali nima ko'rinadi? Har jadvalga to'g'ri policy yoz (clinicId scope, role asosida).
   - **Diqqat:** Prisma `service_role` ishlatadi, shuning uchun policy qo'shilganda mavjud Prisma oqimi **buzilmasligi** kerak. Avval `SELECT` policy, keyin `INSERT/UPDATE/DELETE`. Har biridan keyin smoke-test.
2. **FK & CASCADE** (QISM 3.3) — `Appointment → Payment (Restrict)` to'g'ri ishlaydimi (to'lovli bronni o'chirib bo'lmaydi)? `Branch → Service (SetNull)` orphan xizmat yaratmaydimi?
3. **CHECK constraint'lar** — `paymentStatus`, `discountPercent 0-100`, blocked-date `recurring→weekday / once→date` — DB darajasida majburlanganmi yoki faqat app darajasida?

### 🌊 TO'LQIN 6 — KOD SIFATI & RESPONSIVE (🟡/🔵)
1. **`tsc --noEmit`** toza bo'lsin. `any`, `@ts-ignore`, `console.log` qoldiqlari ro'yxati.
2. **ESLint** — `ignoreDuringBuilds` yoqilgan (deploy uchun), lekin **haqiqiy** lint xatolar yashirinmasin. To'liq ishga tushir, jiddiylarini tuzat.
3. **Responsive (MAJBURIY QOIDA)** — har sahifa Container/Stack/ResponsiveGrid/ResponsiveTable'dan qurilganmi? xs/md/lg/2xl da buzilmaydimi? Buzilganlarni ro'yxatla va tuzat.

---

## 3. TUZATISH SIFATI STANDARTLARI (har diff shu mezonga javob beradi)

Har bir tuzatish quyidagilarni qondirishi SHART. Qondirmasa — qabul qilinmaydi.

- **Minimal diff:** faqat muammoga tegishli o'zgarish. Aloqasiz "yo'l-yo'lakay tozalash" alohida commit'ga.
- **Backward compatible:** mavjud bron, mavjud user, mavjud token, mavjud bot oqimi sinmaydi. Migration `expand → migrate → contract` pattern'da (avval qo'sh, keyin to'ldir, keyin eskini olib tashla — alohida bosqichlarda).
- **Idempotent:** migration/skript ikki marta ishlasa ham xavfsiz. Cron qayta ishlasa duplikat yaratmaydi.
- **Atomik:** pul/navbat/bron o'zgarishlari `$transaction` ichida yoki DB constraint bilan kafolatlangan.
- **Observability:** muhim yo'llarda anglashiladigan log (`console.error` strukturali, secret'siz). Silent failure yo'q.
- **Test qoplami:** tuzatilgan har bug uchun uni qayta yuzaga chiqishdan saqlovchi tekshiruv (test yoki yozma qayta-hosil-qilish skripti).
- **Secret xavfsizligi:** hech qachon `NEXT_PUBLIC_` ostiga maxfiy kalit qo'yma. Xato xabarlarida stack/secret/DB struktura oshkor bo'lmasin.
- **Invariant hurmat:** QISM 18 ro'yxatiga teginish faqat aniq tasdiq bilan.

---

## 4. MIGRATION & DB O'ZGARISHLARI — XAVFSIZ PROTOKOL

DB — eng xavfli zona. Quyidagi protokol majburiy:

1. **Hech qachon to'g'ridan production'da `db push` qilma.** Faqat versiyalangan migration (`prisma migrate`).
2. **Destructive operatsiyalar (DROP COLUMN, DROP TABLE, type narrowing)** — to'g'ridan qilinmaydi. `expand→contract`:
   - Bosqich A: yangi ustun/jadval qo'sh (nullable/default bilan), eski bilan parallel.
   - Bosqich B: ma'lumotni backfill qil (idempotent skript).
   - Bosqich C: kod yangi ustunga o'tgach, **alohida keyingi** migration'da eskini olib tashla.
3. **Har migration oldidan** `npx prisma migrate status` va schema drift tekshiruvi (QISM 15.3).
4. **Index qo'shish** — katta jadvalda `CREATE INDEX CONCURRENTLY` (lock oldini olish) imkoniyatini ko'rib chiq.
5. **RLS policy** — har bittasini alohida qo'sh va Prisma (`service_role`) hamda anon kalit bilan smoke-test qil. Bitta noto'g'ri policy butun oqimni bloklashi mumkin.
6. **Hech qachon production ma'lumotini o'chirma.** Test ma'lumoti `__TEST__` prefiks bilan; tozalash ro'yxatini ber, lekin o'zing o'chirma.

---

## 5. TASHQI INTEGRATSIYA TUZATISHLARI (Payme/Click/Telegram)

### 5.1 To'lov (Payme + Click) — QISM 4.5, 7.5, 7.6
Real merchant ulanmagan, faqat kod tayyor. Sening vazifang **kodni real-ready holatga** keltirish:
- **Webhook idempotentligi:** Payme/Click bir tranzaksiyani qayta yuborsa (retry), `Payment` jadvalida duplikat yozuv yoki ikki marta `markAsPaid` bo'lmasin. `transaction_id` bo'yicha unique constraint + idempotent handler.
- **`Payment.status` ↔ `Appointment.paymentStatus` mustaqilligi** (QISM 18 #9) — bu invariant. Buzilmasin, lekin ikkalasi izchil holatda qolishini kafolatla (reconcile mantig'i).
- **`PAYMENT_ENCRYPTION_KEY`** o'rnatilmagan — merchant kalitlari shifrlanmasdan saqlanyaptimi? AES-256-GCM bilan shifrlash poydevorini tayyorla (kalit kelganda ishlasin).
- **Constant-time comparison** Basic Auth va md5 sign'da bor (QISM 7.5/7.6) — buni buzma, lekin sign formulasi spec'ga mos ekanini tasdiqlа.
- **Callback URL'lar** production'da to'g'ri javob beradimi (qo'lda tekshirib bo'lmaydigan qism — `MANUAL_CHECKLIST.md` ga yoz).

### 5.2 Telegram
- **Webhook secret** (`X-Telegram-Bot-Api-Secret-Token`) tekshiruvi har doim ishlaydimi? Secret yo'q/xato → 401.
- **WebApp initData** — 5.1 dagi eng kritik xavfsizlik ishi (TO'LQIN 1).
- **Broadcast 10s timeout** — ko'p kanalga yuborishda Vercel timeout. Batching/queue yoki `waitUntil` ko'rib chiq.

---

## 6. ALOHIDA E'TIBOR — "TO'G'RI KO'RINADIGAN, LEKIN XAVFLI" NAQSHLAR

Bularni faol qidir. Bular audit'ning eng qimmatli qismi:

- **Check-then-act (TOCTOU):** "avval tekshir, keyin yoz" — orasida boshqa request kirsa buziladi (slot, queueNumber, limit). → atomik qil.
- **Fire-and-forget xatosi:** `.catch(() => {})` yoki `void asyncFn()` — xato sukutda yo'qoladi. → eng kamida log; kritik bo'lsa kuting.
- **Scope `?` (optional) tarqalishi:** `getBranchScope()` `{}` qaytarsa (super_admin) — bu ataylab. Lekin boshqa rolda `clinicId` `undefined` bo'lib qolsa, filter butunlay yo'qolib **hamma ma'lumot** qaytmaydimi? → har `where` da scope mavjudligini tasdiqla.
- **`COALESCE(paidAmount, service.price)`** (QISM 8.1) — `service.price` keyin o'zgarsa, eski bron daromadi noto'g'ri hisoblanadi. → faqat `paidAmount` muzlatilgan qiymatga tayan (yangi bronlarda), eski bronlar uchun backward-compat aniq hujjatlansin.
- **UTC midnight sana** (`date + "T00:00:00.000Z"`) vs `Asia/Tashkent` ko'rsatish — slot/bron sanasi bot, webapp, admin panelda **bir xil kun**ga to'g'ri keladimi? Timezone off-by-one xatosi.
- **Soft delete vs hard delete:** shifokor/xizmat o'chirilganda mavjud bronlar nima bo'ladi? FK CASCADE tasodifan bronlarni o'chirmaydimi?
- **`isCurrent` unique** (`user_clinics`) — bir userda ikki klinika bir vaqtda `isCurrent=true` bo'lib qola oladimi (partial unique index ishlaydimi)?

---

## 7. ISH YURITISH INTIZOMI

- **Branch strategiyasi:** har to'lqin (yoki har mantiqiy tuzatish) alohida branch (`fix/wave1-webapp-initdata`, `fix/slot-race-condition`). To'g'ridan `main`ga push qilma.
- **Commit:** kichik, atomik, anglashiladigan xabar (o'zbekcha yoki conventional). Bir commit = bir mantiqiy o'zgarish.
- **Deploy mo'rtligi:** QISM 13 — deploy hozir barqaror (`4d95e705`dan keyin). Har push'dan keyin Vercel deploy READY bo'lganini tekshir; ERROR bo'lsa darhol to'xta va sababini topib ber.
- **Har to'lqindan keyin:** `npx tsc --noEmit` + `npm run build` + tegishli smoke-test (QISM 19 curl'lari) + `/api/health?verbose=1`. Hammasi yashil bo'lmasa keyingi to'lqinga o'tma.
- **Menga oraliq hisobot:** har to'lqin oxirida — nechta muammo tuzatildi, qanday isbot, qoldiq risk, keyingi to'lqinga tayyormi.

---

## 8. YAKUNIY NATIJALAR (sen yaratadigan hujjatlar — barchasi MD, o'zbekcha)

### 8.1 `REMEDIATION_LOG.md` — asosiy ish jurnali
Har tuzatilgan muammo uchun jadval qatori:

| # | To'lqin | Jiddiylik | Muammo | Ildiz sababi | Tuzatish (fayl/diff xulosa) | Isbot (test/curl/EXPLAIN) | Migration? | Qoldiq risk | Commit/branch |
|---|---------|-----------|--------|--------------|------------------------------|----------------------------|------------|-------------|----------------|

### 8.2 `MANUAL_CHECKLIST.md` — sen tekshira OLMAYDIGAN, mendan kerak bo'lgan narsalar (MD)
QISM 15 asosida, lekin tuzatishlardan keyin yangilangan holatda. Aniq, bajarib bo'ladigan punktlar bilan:
- Real Payme/Click sandbox testi (qadamlar bilan)
- Vercel env'da o'rnatilishi kerak bo'lgan o'zgaruvchilar (`PAYMENT_ENCRYPTION_KEY`, Redis URL va h.k.) — qaysi nom, qaysi format
- Supabase dashboard'da qo'lda tasdiqlanishi kerak bo'lgan RLS policy'lar
- Telegram BotFather/webhook holatini real qurilmada tekshirish
- Supabase Storage `appointment-results` bucket yaratish (uy xizmati uchun)
- Mendan kerak bo'lgan har qanday kirish/qaror

### 8.3 `MIGRATIONS_APPLIED.md` — DB o'zgarishlari jurnali
Har migration: nima qildi, reversible'mi, backfill kerakmi, rollback rejasi.

### 8.4 `RISK_REGISTER.md` — tuzatilmagan/keyinga qolgan risklar
Har biri: nega hozir tuzatilmadi, qancha xavfli, qachon tuzatish kerak, vaqtinchalik yumshatish (mitigation) bormi.

---

## 9. QIZIL CHIZIQLAR (buzilmaydigan)

1. **Production ma'lumotini O'CHIRMA / BUZMA.** Test ma'lumoti faqat `__TEST__` prefiks bilan; o'zing tozalama, ro'yxat ber.
2. **QISM 18 invariantlariga TEGINMA** tasdiqsiz: `processBooking()` transaksiyasi, `tibId` format, `normalizePhone()`, `source="bot"`, `clinicId` scope majburiyligi, idempotency flag'lari, `Payment`↔`Appointment` status mustaqilligi.
3. **DB'da to'g'ridan `db push` yo'q** — faqat versiyalangan, reversible migration.
4. **Bir vaqtda bitta mantiqiy o'zgarish.** Katta refactoring — avval tasdiqlat.
5. **Har da'voni isbotla.** "Tuzatdim" yetarli emas — qanday isbotlaganingni ko'rsat.
6. **Secret oshkor qilma.** Log/xato/bundle'da maxfiy kalit chiqmasin.
7. **Maxfiylik:** `TIBTAQVIM_AUDIT_REFERENCE.md` parol va token saqlaydi — bu ma'lumotni hech qayerga (commit, log, tashqi servis) chiqarmasdan ishlat.
8. **Shoshilma.** Sifat — birinchi. Tezlik — hech qachon to'g'rilik hisobiga emas.

---

## 10. BOSHLASH

1. Avval `TIBTAQVIM_AUDIT_REFERENCE.md`ni to'liq qayta o'qi (ayniqsa QISM 18 invariantlar va QISM 20 ma'lum xatolar).
2. Repo holatini tasdiqla: `git status`, `npx prisma migrate status`, `npx tsc --noEmit`, `/api/health?verbose=1`.
3. **TO'LQIN 1**dan boshla (xavfsizlik). Birinchi muammo — WebApp initData validatsiyasi. 7-bosqichli oqim bilan: Reproduce → Root cause → Blast radius → Fix plan (menga tasdiqlat) → Implement → Verify → Document.
4. Har muammoni alohida, sovuqqonlik bilan, isbot bilan yop.
5. Har to'lqin oxirida menga oraliq hisobot ber va tasdiqimni kut.

Boshla. Birinchi — repo holati tasdig'i, keyin TO'LQIN 1 ning birinchi muammosi uchun to'liq REPRODUCE bosqichi.
