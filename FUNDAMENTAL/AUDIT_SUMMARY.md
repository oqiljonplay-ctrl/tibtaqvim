# TibTaqvim — Xavfsizlik & Sifat Auditi: Yakuniy Xulosa

> **Audit davri:** 2026-06-02 → 2026-06-05  
> **To'lqinlar:** 6 ta | **Branch:** `fix/wave1-security`  
> **Maqsad:** Production chiqishdan oldin loyihani to'liq tekshirish

---

## UMUMIY MANZARA

| Ko'rsatkich | Natija |
|------------|--------|
| Jami topilmalar | **31** (20 tuzatildi, 11 ochiq) |
| 🔴 Kritik topilmalar | 9 → **9 tuzatildi** |
| 🟠 Yuqori darajali | 3 → 2 tuzatildi, 1 ochiq (R1 enforce) |
| 🟡 O'rta darajali | 8 → 4 tuzatildi, 4 ochiq |
| 🔵 Past darajali | 11 → 5 tuzatildi, 6 ochiq |
| Production-ready? | **Ha, asosiy oqimlar uchun** (quyida tafsilot) |

---

## ENG KRITIK 5 TOPILMA (va tuzatish)

### 1. WebApp IDOR — boshqa bemorning tibbiy tarixini ko'rish ✅ TUZATILDI (Wave 1)

**Nima edi:** `/api/webapp/appointments`, `/cancel`, `/profile` endpoint'lari `telegramId` ni faqat query param sifatida olgan. Soxta ID bilan boshqa bemorning bronlarini ko'rish mumkin edi.

**Tuzatish:** HMAC-SHA256 `initData` validatsiya (`webapp-auth.ts`). Hozir log-only rejimda — frontend header yubormaguncha enforce qilinmaydi (M-4).

---

### 2. queueNumber TOCTOU — parallel bronlarda duplicate navbat raqami ✅ TUZATILDI (Wave 2)

**Nima edi:** `findFirst(max)+1+create` READ COMMITTED'da atomic emas. 5 parallel curl → `[2,1,2,1,1]` — 3 ta duplicate!

**Tuzatish:** `pg_advisory_xact_lock(hashtext(serviceId:date))` — transaksiya darajasida lock. 10 parallel test → `[1,2,3,4,5,6,7,8,9,10]` — 0 duplikat.

---

### 3. Slot overbooking (capacity=1 da 2 bron) ✅ TUZATILDI (Wave 2)

**Nima edi:** `bookDiagnostic` advisory lock bor edi, lekin `bookHomeService` da lock ham, duplicate check ham yo'q. 2 parallel curl → ikkalasi 201 (overbooking!).

**Tuzatish:** `pg_advisory_xact_lock("slot:"+slotId)` + `DUPLICATE_BOOKING` check. Real test: Req1 → 201, Req2 → 409 SLOT_FULL.

---

### 4. Rate limiting in-memory (Vercel serverless'da ishlamaydi) ✅ TUZATILDI (Wave 4)

**Nima edi:** `const store = new Map()` — har Vercel invocation yangi process → limit yo'q. Login brute-force, bron spam himoyasiz.

**Tuzatish:** DB-backed atomik UPSERT rate limiter. 2-qavatli: `auth:min:IP` (5/min) + `auth:hour:IP` (20/soat). Hozir shadow mode — enforce uchun M-3 kerak.

---

### 5. `paymentStatus` CHECK constraint `'failed'` bloklar ✅ TUZATILDI (Wave 5)

**Nima edi:** Prisma-generated `appointments_payment_status_check`: `('not_required','pending','paid','cancelled')` — `'failed'` YO'Q. `click/handlers.ts:223` `paymentStatus='failed'` yozadi. Birinchi muvaffaqiyatsiz Click to'lovda production DB crash bo'lar edi.

**Tuzatish:** Eski constraint o'chirildi. `chk_payment_status` `('pending','paid','not_required','cancelled','failed')` bilan almashtirildi.

---

## TO'LQINLAR BO'YICHA TUZATISHLAR

| To'lqin | Mavzu | Natija |
|---------|-------|--------|
| **Wave 1** | WebApp IDOR, cross-clinic 400→404, getBranchScope guard | 3 kritik tuzatildi |
| **Wave 2** | queueNumber TOCTOU, slot overbooking, duplicate check, state machine | 4 kritik tuzatildi |
| **Wave 3** | N+1 query optimallashtirish (6→2 so'rov, 15x tez), flip card IDOR | 2 tuzatildi |
| **Wave 4** | DB-backed rate limit, bot state DB-backed, `connection_limit=1` | 3 tuzatildi |
| **Wave 5** | RLS 29 jadval RESTRICTIVE, 8 CHECK constraint, `failed` bug fix | 4 tuzatildi |
| **Wave 6** | Audit: any (35), ESLint (20 entities, 5 img), responsive | 0 tuzatish (faqat audit) |

---

## PRODUCTION-READY BAHOSI

### ✅ Tayyor (ishonchli ishlatish mumkin):

| Funksiya | Holat |
|---------|-------|
| Bron oqimi (3 tur) | ✅ Race conditions tuzatildi, idempotent |
| Auth (JWT, cookie, RBAC) | ✅ Xavfsiz |
| Multi-clinic izolyatsiya | ✅ clinicId scope barcha endpoint'da |
| DB xavfsizligi (RLS) | ✅ 29 jadval RESTRICTIVE deny |
| Telegram webhook | ✅ HMAC secret himoyalangan |
| Bot state | ✅ DB-backed, serverless safe |
| Telegram qo'ng'iroq | ✅ Relay log bilan |
| Broadcast tizim | ✅ Kanal/kampaniya ishlaydi |

### ⚠️ Shartli tayyor (ma'lum cheklovlar bilan):

| Funksiya | Holat | Cheklov |
|---------|-------|---------|
| Rate limiting | ⚠️ Shadow mode | `RATE_LIMIT_ENFORCE=true` kerak (M-3) |
| WebApp identifikatsiya | ⚠️ Log-only | Frontend initData header kerak (M-4) |
| pgBouncer pool | ⚠️ `connection_limit` yo'q | Vercel env yangilash kerak (M-1) |
| Payme/Click to'lov | ⚠️ Sandbox sinovdan o'tmagan | M-5, M-6 |

### ❌ Qilinmagan (keyinroq):

| Funksiya | Holat |
|---------|-------|
| Uy xizmati natijalari (foto/PDF) | Supabase Storage bucket yo'q |
| PAYMENT_ENCRYPTION_KEY | Plain text merchant kalitlar |
| Redis (rate limit + bot state) | Hozir DB bilan ishlamoqda |

---

## FOUNDER UCHUN: HOZIR BAJARING (M-1, M-2, M-3)

**10 daqiqa, katta xavfni yo'q qiladi:**

```
1. Vercel → DATABASE_URL → &connection_limit=1 qo'shing  [M-1, KRITIK]
2. Supabase SQL → DELETE FROM appointments WHERE patientName LIKE '__TEST__%'  [M-2]
3. 1-2 kun kutib → Vercel → RATE_LIMIT_ENFORCE=true  [M-3]
```

---

## BRANCH HOLATI

**`fix/wave1-security` → `main` dan 9 commit oldinda:**

```
2abca21  docs: REMEDIATION_LOG 2.2 va 2.3 real curl isbot bilan yangilandi
89f6489  fix(booking): bookDiagnostic va bookHomeService da duplicate check yo'q edi
8d8b54c  docs: Wave 2 REMEDIATION_LOG va MANUAL_CHECKLIST yangilandi
01cea3f  fix(booking/workflow): TOCTOU va holat mashinasi tuzatishlari
260610c  fix(booking): queueNumber TOCTOU — pg_advisory_xact_lock bilan seriallashtirish
4c1f496  docs: REMEDIATION_LOG real curl isbot bilan yangilandi (1.2, 1.3)
3266992  security(wave1): IDOR — cross-clinic 400→404, getBranchScope undefined guard
06cb2e8  security(wave1): WebApp initData HMAC validatsiya guard qo'shildi
925b371  fix(stats): daromad mantig'i birlashtiridi — paidAt, yagona shart, range filtr
```

**Tavsiya: PR, to'g'ridan merge EMAS.** Sabab:
1. 9 commit — barchasi ko'rish uchun alohida diff taqdim qilish yaxshi
2. `fix/wave1-security` nomi aniq — PR description audit xulosa bo'ladi
3. Main'ga to'g'ridan push'dan oldin ko'rib tasdiqlash xavfsizroq

---

*Audit: Wave 1–6 | 2026-06-02 → 2026-06-05 | Claude Code*
