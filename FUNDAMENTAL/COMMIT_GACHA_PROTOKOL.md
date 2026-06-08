# TibTaqvim — Commit-gacha Xavfsiz Tayyorgarlik Protokoli

> **Kimga:** VS Code Claude (Pro) — git operatsiyasini boshqaradi
> **Maqsad:** `fix/wave1-security` branch'idagi commit qilinmagan ishni (TO'LQIN 3-6, M-1/2/3) xavfsiz commit qilishdan OLDIN barcha tekshiruvni o'tkazish.
> **Holat:** TO'LQIN 1-6 tugagan, lekin TO'LQIN 3-6 va hujjatlar HALI commit qilinmagan. SAVAT/ papka loyiha tashqarisiga ko'chirilgan.
> **Mantra:** Avval tekshir, keyin commit. Bitta noto'g'ri qadam 6 to'lqin ishini yo'qotadi. Shoshma.

---

## 0. QIZIL CHIZIQLAR (buzilmaydi)

VS Code Claude quyidagilarni **hech qachon** bajarmaydi (commit qilinmagan ishni o'chiradi):
- ❌ `git reset --hard`
- ❌ `git checkout -- .` yoki `git checkout .`
- ❌ `git clean -fd` / `git clean -fdx`
- ❌ `git add .` (ko'r-ko'rona — `.env` yoki keraksiz fayl kirib qoladi)
- ❌ `git push --force`
- ❌ Branch o'chirish / almashtirish (commit qilinmagan ish bor ekan)

Har destructive komandadan oldin **to'xtab, foydalanuvchidan tasdiq oladi.**

---

## 1. AVVAL — ZAXIRA (foydalanuvchi bajaradi, commit'dan oldin)

> ⚠️ Bu birinchi va eng muhim. Git bilan biror narsa noto'g'ri ketsa, bu yagona kafolat.

- [ ] `C:\loyiha\nextBOT` papkasini to'liq nusxalang → `C:\loyiha\nextBOT_BACKUP_2026-06-05`
- [ ] Nusxa to'liq ko'chganini tasdiqlang (papka hajmi taxminan bir xil)

**Holat:** ⬜ Bajarildimi? (Ha / Yo'q) — Yo'q bo'lsa, davom etMANG.

---

## 2. KRITIK TEKSHIRUV — `.env` GIT'DA BORMI? (eng muhim, commit'dan oldin birinchi)

> Bu butun git ishidagi eng xavfli nuqta. Agar `.env` (parollar, secret) git'da bo'lsa va GitHub'ga ketgan bo'lsa — auditda topilgan hamma narsadan jiddiyroq xavf.

### 2.1 Tekshiruv komandasi (xavfsiz, faqat ko'rsatadi):
```powershell
git ls-files | Select-String "\.env"
```

### 2.2 Natijaga qarab — 3 holat:

**HOLAT A — hech narsa chiqmadi (bo'sh natija):**
✅ `.env` git'da kuzatilmagan. Xavfsiz. 3-bo'limga o'ting.

**HOLAT B — `.env` yoki `.env.local`/`.env.production` chiqdi:**
🔴 **STOP. Commit qilmang.** Secret git'da degani. Quyidagi tartib:
1. `.gitignore` da `.env*` borligini tasdiqlang (yo'q bo'lsa qo'shing)
2. Git'dan chiqaring (fayl diskda QOLADI, o'chmaydi):
   ```powershell
   git rm --cached .env
   git rm --cached .env.local
   git rm --cached .env.production
   ```
   (faqat chiqqan fayllar uchun)
3. **Eng muhim savol — foydalanuvchiga:** Bu `.env` fayl avval GitHub'ga **push** qilinganmi?
   - Tekshirish: `git log --all --oneline -- .env | cat` — agar commit tarixi chiqsa, push bo'lgan ehtimoli yuqori.
   - Agar push bo'lgan bo'lsa → **barcha secret rotate qilinishi shart** (3-bo'limdan keyingi 7-bo'limga qarang).

**HOLAT C — `.env.example` yoki `.env.sample` chiqdi:**
✅ Bu xavfsiz — bu shablon fayl (haqiqiy secret emas, faqat o'zgaruvchi nomlari). Qoldiring.

### 2.3 `.gitignore` mazmunini ham tasdiqlang:
```powershell
Get-Content .gitignore
```
Quyidagilar bo'lishi SHART:
- [ ] `.env` (va `.env*` / `.env.local` / `.env*.local`)
- [ ] `node_modules`
- [ ] `.next`
- [ ] `/build`, `/dist` (agar bo'lsa)

**Holat:** ⬜ `.env` git'da bormi? (A / B / C) — Natijani foydalanuvchiga ko'rsating.

---

## 3. HAJM TEKSHIRUVI — `node_modules` GIT'DA BORMI? (1GB muammosi)

> Loyiha 1GB+ — lekin kattasi `node_modules` bo'lishi kerak, u git'ga KIRMASLIGI shart.

### 3.1 Komandalar:
```powershell
git ls-files | Select-String "node_modules" | Measure-Object
```
```powershell
git ls-files | Measure-Object
```

### 3.2 Natijaga qarab:

**`node_modules` natijasi 0 (bo'sh):**
✅ To'g'ri. node_modules git'da yo'q.

**`node_modules` 0 dan katta (minglab fayl):**
🔴 node_modules git'ga aralashgan — bu 1GB ni GitHub'ga olib chiqadi. Tuzatish:
```powershell
git rm -r --cached node_modules
```
(fayllar diskda qoladi, faqat git'dan chiqadi). Keyin `.gitignore` da `node_modules` borligini tasdiqlang.

**`git ls-files` umumiy soni:**
- Normal loyiha: ~200-800 fayl (kod + hujjat)
- Agar 5000+ chiqsa → node_modules yoki boshqa keraksiz narsa aralashgan, yuqoridagi tozalash kerak.

**Holat:** ⬜ node_modules git'da? (Ha/Yo'q) — git kuzatayotgan fayllar soni: _____

---

## 4. JORIY GIT HOLATINI TASDIQLASH (commit'dan oldin to'liq rasm)

### 4.1 Komandalar (pager muammosini oldini olish uchun `| cat` bilan):
```powershell
git status
```
```powershell
git log --oneline -15 | cat
```
```powershell
git branch
```

### 4.2 Tasdiqlanishi kerak:
- [ ] Joriy branch: `fix/wave1-security` (yulduzcha `*` shu yerda)
- [ ] `main` dan oldinda 9 commit bor (TO'LQIN 1-2: IDOR, queueNumber, duplicate, TOCTOU)
- [ ] Commit qilinmagan o'zgarishlar bor (TO'LQIN 3-6): `rate-limit.ts`, `schema.prisma`, `login/route.ts`, `add_rate_limits` migration, hujjatlar
- [ ] SAVAT/ committed fayllar "deleted" ko'rinadi (fizik ko'chirilgan — `git rm` bilan tozalanadi)
- [ ] Root'dagi hujjatlar FUNDAMENTAL/ ga ko'chgan (root'da deleted, FUNDAMENTAL/ da untracked)

**Holat:** ⬜ Yuqoridagilar tasdiqlandimi?

---

## 5. KERAKSIZ / VAQTINCHALIK FAYLLAR — QAROR

> Bularni commit'ga KIRITMAYMIZ. Lekin untracked qoldirilsa, doim `git status` da "iflos" ko'rinadi.

### 5.1 Root'dagi vaqtinchalik fayllar:
- `admin-files.txt`, `admin-layout.txt`, `navbar.txt`, `super-layout.txt` — debug chiqishlari
- `git-show-error.txt` — vaqtinchalik
- `show-rate-limits.js` — Copilot yaratgan keraksiz skript

### 5.2 Qaror (foydalanuvchi tanlaydi):
- **(a)** O'chirish (tavsiya — bular kerak emas): foydalanuvchi qo'lda o'chiradi yoki Claude `del` bilan
- **(b)** `.gitignore` ga qo'shish (agar saqlab qolmoqchi bo'lsa): masalan `*.txt` (root) yoki har birini alohida

**Tavsiya:** o'chirish — bular debug qoldiqlari, qiymati yo'q. `show-rate-limits.js` ayniqsa — rate-limit allaqachon real brauzerda isbotlangan, bu skript ortiqcha.

**Holat:** ⬜ Qaror: (a) o'chirish / (b) ignore

---

## 6. COMMIT REJASI (tasdiqlangan — 5 guruh)

> Faqat 1-5 bo'limlar TOZA tasdiqlangach boshlanadi. Har commit oldidan `git add` qiladigan ANIQ fayllarni ko'rsatish — `git add .` YO'Q.

### Commit 1 — `chore: papka tuzilishi + .gitignore`
- `git rm`: root'dagi MANUAL_CHECKLIST.md, REMEDIATION_LOG.md, RISK_REGISTER.md, MIGRATIONS_APPLIED.md (FUNDAMENTAL/ ga ko'chgan)
- `git rm`: committed SAVAT/*.md, faza-1/2/3-clinic-*.md
- `git add`: `.gitignore`
- `git add`: FUNDAMENTAL/*.md (barcha hujjatlar — foydalanuvchi "hammasi commit" dedi)

### Commit 2 — `fix(security/wave1-3): rate-limit, login, webhook, relay`
- `src/app/api/auth/login/route.ts`, `src/lib/rate-limit.ts`
- `src/app/api/webhook/telegram/route.ts`, `bot/handlers/start.ts`
- `src/lib/telegram/relay.ts`

### Commit 3 — `fix(security/wave4-6): book, broadcast, reminders, webapp`
- `src/app/api/book/route.ts`, `src/app/api/cron/ad-broadcast/route.ts`
- `src/app/api/reminders/route.ts`, `src/app/api/webapp/appointments/route.ts`
- `src/app/webapp/page.tsx`, `src/app/api/admin/staff/route.ts`
- `src/components/shared/TelegramChatButton.tsx`, `src/components/webapp/BookingFlipCard.tsx`
- `src/lib/services/booking.service.ts`

### Commit 4 — `feat(db): rate_limits migration va schema`
- `prisma/schema.prisma`
- `prisma/migrations/20260605000001_add_rate_limits/`

### Commit 5 — `feat(staff): xodim va doktor API + UI`
- `src/app/admin/(panel)/staff/`, `src/app/admin/staff/`
- `src/app/api/admin/staff/[id]/route.ts`, `src/app/api/webapp/doctor/`
- `src/components/StaffCard.tsx`

### Har commitdan keyin:
- [ ] `git status` — nima qolganini ko'rsat
- [ ] Keyingi commit'ga o'tishdan oldin foydalanuvchi tasdig'i

### Barcha commitlardan keyin (TEKSHIRUV):
- [ ] `git status` toza (faqat ataylab qoldirilgan untracked, masalan keraksiz .txt agar o'chirilmagan bo'lsa)
- [ ] `npx tsc --noEmit` — type xato yo'q
- [ ] `npm run build` — build muvaffaqiyatli
- [ ] `git log --oneline -15 | cat` — yangi commitlar ko'rinadi

---

## 7. AGAR `.env` GITHUB'GA KETGAN BO'LSA — SECRET ROTATE (faqat HOLAT B + push bo'lsa)

> Bu faqat 2.2 HOLAT B da, va `.env` GitHub'ga push qilingani aniqlansa kerak.

Rotate qilinishi kerak bo'lgan secret'lar (chunki ular ochiq joyga tushgan):
- [ ] **Supabase DB paroli** — Supabase Dashboard → Project Settings → Database → Reset password. Keyin Vercel `DATABASE_URL` va `DIRECT_URL` ni yangilang.
- [ ] **SUPERADMIN_KEY** — yangi qiymat generatsiya, Vercel env yangilash
- [ ] **TELEGRAM_WEBHOOK_SECRET** — yangi secret, `setWebhook` qayta
- [ ] **PAYMENT_ENCRYPTION_KEY** (agar bor bo'lsa)
- [ ] **JWT secret** — yangilanса, barcha sessiya tugaydi (foydalanuvchilar qayta login)

> Eslatma: GitHub tarixidan secret'ni butunlay o'chirish (`git filter-repo` yoki BFG) murakkab. Eng amaliy yo'l — secret'ni rotate qilish (eski qiymat befoyda bo'lib qoladi), keyin git'dan chiqarish.

---

## 8. ALOHIDA — MAXFIYLIK ESLATMASI (chat orqali ochilgan secret'lar)

> Audit jarayonida quyidagilar chat orqali ochiq ko'rsatilgan — git'dan qat'i nazar, bular endi xavfsiz emas:

- [ ] **Supabase DB paroli** (`Supabase707`) — rotate tavsiya etiladi
- [ ] **Test akkaunt paroli** (`+998999998877` uchun) — rotate tavsiya etiladi
- [ ] **Login sahifasidagi demo parollar** (`admin123`, `doctor123`, `reception123`, `super123`) — bular login sahifasida HAMMAGA ko'rinadi (R yangi risk). Production'da bu blokni olib tashlash kerak. → `src/app/login/` da demo parol ro'yxatini o'chirish.

**Holat:** ⬜ Demo parol bloki login sahifasidan olib tashlandimi?

---

## 9. MERGE REJASI (HALI QILMA — commit tozalangach alohida)

> Commitlar toza bo'lgach, `fix/wave1-security` ni `main` ga qo'shish. Bu ALOHIDA bosqich, tasdiq bilan.

- Tavsiya (AUDIT_SUMMARY'dan): **PR orqali, to'g'ridan merge EMAS.**
- Sabab: 9+ commit ko'rib chiqish uchun, PR description audit xulosa bo'ladi.
- VS Code Claude merge usulini (PR / fast-forward / merge commit) TUSHUNTIRADI, foydalanuvchi tasdiqlaydi, keyingina bajaradi.

---

## ISH TARTIBI — XULOSA

```
1. Zaxira ol (foydalanuvchi)          → 1-bo'lim
2. .env tekshir (KRITIK)              → 2-bo'lim   ← natijani ko'rsat, STOP agar B
3. node_modules tekshir               → 3-bo'lim
4. git holat tasdiqla                 → 4-bo'lim
5. keraksiz fayllar qaror             → 5-bo'lim
6. 5 commit (har biri tasdiq bilan)   → 6-bo'lim
7. (agar kerak) secret rotate         → 7-bo'lim
8. demo parol olib tashlash           → 8-bo'lim
9. merge (alohida, tasdiq bilan)      → 9-bo'lim
```

**Har bo'limdan keyin foydalanuvchiga natija ko'rsatiladi va tasdiq kutiladi. Hech bir bo'lim o'tkazib yuborilmaydi. `.env` tekshiruvi (2-bo'lim) — eng muhim, undan oldin commit boshlanmaydi.**
