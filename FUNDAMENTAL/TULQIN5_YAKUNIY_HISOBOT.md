# TO'LQIN 5 — RLS POYDEVOR & DB YAXLITLIGI: YAKUNIY HISOBOT

> **Sana:** 2026-06-05  
> **Deploy:** `dpl_6SUmJXu1LdE5qmXqouKCaGZ6vo5Y` → https://tibtaqvim.vercel.app ✅  
> **Branch:** `fix/wave1-security`

---

## XULOSA (1 chiziq)

**4 qadam, 3 migration, 1 kritik bug tuzatildi** — barcha 29 jadval RESTRICTIVE deny_all_anon, 8 CHECK constraint, production sog'lom.

---

## 1. BAJARILGAN ISHLAR

### 1.1 ANIQLIK BOSQICHI (oldindan bajarilgan)

Amalga oshirishdan OLDIN 3 aniqlik tekshirildi:

| Aniqlik | Savol | Natija |
|---------|-------|--------|
| **A1** | `authenticated` roleni bloklash xavfsizmi? | ✅ Loyihada Supabase JS client 0 fayl — faqat Prisma service_role |
| **A2** | `paymentStatus` enum to'liqmi? | ❌ → ✅ **Tuzatildi**: `not_required` (34 ta bron) ro'yxatda yo'q edi; `partial/authorized/refunded` ortiqcha edi. To'g'ri ro'yxat: `pending, paid, not_required, cancelled, failed` |
| **A3** | Mavjud buzuq ma'lumot bormi? | ✅ 0 qator — barcha CHECK migration sinmadi |

---

### 1.2 STEP 1 — 6 POLICY'SIZ JADVAL

**Migration:** `wave5_step1a_clinic_promotions_deny_anon`, `wave5_step1b_doctor_subtables_deny_anon`

| Jadval | Oldin | Keyin |
|--------|-------|-------|
| `clinic_promotions` | ❌ 0 policy | ✅ RESTRICTIVE deny_all_anon |
| `doctor_blocked_dates` | ❌ 0 policy | ✅ RESTRICTIVE deny_all_anon |
| `doctor_directions` | ❌ 0 policy | ✅ RESTRICTIVE deny_all_anon |
| `doctor_experiences` | ❌ 0 policy | ✅ RESTRICTIVE deny_all_anon |
| `doctor_specialties` | ❌ 0 policy | ✅ RESTRICTIVE deny_all_anon |
| `doctor_workplaces` | ❌ 0 policy | ✅ RESTRICTIVE deny_all_anon |

**ISBOT (real anon kalit INSERT):**
```
clinic_promotions   → 42501 new row violates row-level security ✅
doctor_blocked_dates→ 42501 ✅
doctor_directions   → 42501 ✅
doctor_experiences  → 42501 ✅
doctor_specialties  → 42501 ✅
doctor_workplaces   → 42501 ✅
```

**Prisma (service_role) smoke-test:**
```
blocked_dates=6, directions=3, experiences=3, specialties=3, workplaces=5 ✅
```

---

### 1.3 STEP 2 — 23 PERMISSIVE → RESTRICTIVE

**Migration:** `wave5_step2_permissive_to_restrictive`

**Texnik sabab:** PERMISSIVE policy'da kelajakda `PERMISSIVE USING(true)` qo'shilsa → `OR(false, true) = TRUE` → bypass. RESTRICTIVE bilan → `AND` → kafolatlangan bloklash.

**O'zgartirilgan 23 jadval:**
```
appointments, audit_logs, bot_states, branches, clinic_settings, clinics,
doctors, feature_flags, module_configs, payments, refunds, service_doctors,
services, slots, staff, telegram_id_history, user_clinics, users,
ad_campaign_channels, ad_campaigns, ad_channels, ad_posts, _prisma_migrations
```

**Tekshiruv:**
```sql
SELECT COUNT(*) FROM pg_policies
WHERE policyname = 'deny_all_anon' AND permissive = 'RESTRICTIVE';
-- → 29 (6 yangi + 23 o'zgartirilgan) ✅
```

**To'liq oqim smoke-test (RESTRICTIVE ta'sirini tekshirish):**

| Qadam | Natija |
|-------|--------|
| Login `/api/auth/login` | ✅ `success: true` |
| Xizmatlar `/api/services?clinicId=clinic-demo` | ✅ Ma'lumot qaytdi |
| Bron yaratish `/api/book` | ✅ `id: cmq0gpdwc0002kz04u4t5us5p` |
| To'lov `/api/reception/appointments/[id]/payment` | ✅ `success: true` |

RLS RESTRICTIVE o'zgarishi hech bir oqimni bloklamadi.

---

### 1.4 STEP 3 — CHECK CONSTRAINTS

**Migration:** `wave5_step3_check_constraints`, `wave5_step3b_fix_payment_status_constraint`

#### Kritik topilma: `appointments_payment_status_check`

Prisma-generated eski constraint:
```
('not_required', 'pending', 'paid', 'cancelled')  ← 'failed' YO'Q!
```

`click/handlers.ts:223` da `paymentStatus = 'failed'` yoziladi — lekin DB bu qiymatni bloklar edi. **Bu yashirin production bug edi.**

Tuzatish:
```sql
ALTER TABLE appointments DROP CONSTRAINT "appointments_payment_status_check";
-- chk_payment_status allaqachon qo'shilgan:
-- ('pending', 'paid', 'not_required', 'cancelled', 'failed') ← to'g'ri ✅
```

#### Barcha 8 constraint:

| # | Jadval | Constraint | Ta'rif |
|---|--------|-----------|--------|
| 1 | `appointments` | `chk_payment_status` | `IN ('pending','paid','not_required','cancelled','failed')` |
| 2 | `appointments` | `chk_applied_discount` | `>= 0 AND <= 100` |
| 3 | `clinic_settings` | `chk_discount_percent` | `>= 0 AND <= 100` |
| 4 | `doctor_blocked_dates` | `chk_blocked_type` | `IN ('recurring','once')` |
| 5 | `doctor_blocked_dates` | `chk_blocked_weekday` | `IS NULL OR (0-6)` |
| 6 | `doctor_blocked_dates` | `chk_blocked_consistency` | `recurring→weekday≠NULL AND date IS NULL` OR `once→date≠NULL AND weekday IS NULL` |
| 7 | `services` | `chk_service_price` | `>= 0` |
| 8 | `services` | `chk_prepayment_amount` | `IS NULL OR >= 0` |

**ISBOT (real violation test):**
```sql
UPDATE appointments SET "paymentStatus" = 'refunded' ...
-- → ERROR 23514: violates check constraint "chk_payment_status" ✅
```

---

### 1.5 STEP 4 — TypeScript Build

```
npx tsc --noEmit → exit 0, 0 xato ✅
```

---

### 1.6 STEP 5 — Deploy

```
npx vercel --prod --yes
→ Deployment ID: dpl_6SUmJXu1LdE5qmXqouKCaGZ6vo5Y
→ https://tibtaqvim.vercel.app ✅
→ Build: ✓ Compiled successfully (73 sahifa, 0 TS xato)
```

**Production health:**
```json
{"status":"ok","db":"connected","environment":"production"}  ✅
```

---

## 2. YAKUNIY RLS HOLATI (production)

| Holat | Jadvallar | Soni |
|-------|----------|------|
| ✅ RESTRICTIVE deny_all_anon | Barcha asosiy jadvallar | **29** |
| ✅ To'g'ri row-level policy | `dependents` (owner+super_admin), `telegram_relay_log` (relay_log_*) | **2** |
| ✅ RESTRICTIVE deny_public_access | `rate_limits` (Wave 4 da qo'shilgan) | **1** |
| ✅ Policy yo'q jadval | Yo'q (0) | **0** |
| ⚠️ PERMISSIVE jadval | Yo'q (0) | **0** |

**Jami: 32 jadval — barchasi himoyalangan.**

---

## 3. MIGRATION RO'YXATI

| Migration nomi | Maqsad |
|----------------|--------|
| `wave5_step1a_clinic_promotions_deny_anon` | clinic_promotions RESTRICTIVE |
| `wave5_step1b_doctor_subtables_deny_anon` | 5 ta doctor_* jadval RESTRICTIVE |
| `wave5_step2_permissive_to_restrictive` | 23 PERMISSIVE → RESTRICTIVE (DO $$ bloki) |
| `wave5_step3_check_constraints` | 8 ta CHECK constraint |
| `wave5_step3b_fix_payment_status_constraint` | Eski Prisma constraint o'chirish (`failed` bug fix) |

---

## 4. QOLDIQ MUHIM ESLATMALAR

1. **Prisma duplicate constraint'lar** — `discount_percent_range`, `check_type`, `check_weekday_range` Prisma-generated; `chk_*` bilan funksional mos. Zarar yo'q, Prisma state uchun qoldirildi.

2. **`rate_limits` RATE_LIMIT_ENFORCE** — hali `false` (shadow mode). Log kuzatib `true` qilinishi kerak (Wave 4 dan qolgan).

3. **`appointments_payment_status_check` tuzatildi** — Click to'lov oqimida `failed` status yozish endi ishlaydi.

---

*Hisobot: To'lqin 5 yakuniy | 2026-06-05 | Claude Code*
