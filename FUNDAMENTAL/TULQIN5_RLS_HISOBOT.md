# TO'LQIN 5 — RLS & DB Poydevor: To'liq Tahlil Hisoboti

> **Sana:** 2026-06-05  
> **Holat:** Tahlil tugallandi — harakatlar kutilmoqda  
> **Avvalgi to'lqin:** To'lqin 4 (Rate-limit SQL + shadow flag) — yopildi ✅

---

## XULOSA (1 chiziq)

**6 jadval** policy'siz qolgan (avvalgi auditdagi 15 dan to'lqin 1-4 lar 9 tasini tuzatdi); mavjud 23+ `deny_all_anon` policy **PERMISSIVE** tuzilganki, bitta `PERMISSIVE true` policy qo'shilsa bypass qilinadi — hammasi **RESTRICTIVE** ga o'tishi kerak.

---

## 1. HOZIRGI HOLAT: RLS INVENTARIZATSIYA

### 1.1 Supabase'dan olingan haqiqiy ma'lumot

```sql
-- Tekshirish uchun ishlatilgan so'rov
SELECT tablename, COUNT(policyname) AS policy_count,
       ARRAY_AGG(policyname) AS policies
FROM pg_tables t
LEFT JOIN pg_policies p USING (schemaname, tablename)
WHERE t.schemaname = 'public'
GROUP BY tablename, rowsecurity
ORDER BY rowsecurity DESC, tablename;
```

### 1.2 To'liq jadval holati

| Jadval | RLS | Policy soni | Policy nomlari | Holat |
|--------|-----|-------------|----------------|-------|
| `appointments` | ✅ | 1 | `deny_all_anon` | ⚠️ PERMISSIVE |
| `audit_logs` | ✅ | 1 | `deny_all_anon` | ⚠️ PERMISSIVE |
| `bot_states` | ✅ | 1 | `deny_all_anon` | ⚠️ PERMISSIVE |
| `branches` | ✅ | 1 | `deny_all_anon` | ⚠️ PERMISSIVE |
| `clinic_settings` | ✅ | 1 | `deny_all_anon` | ⚠️ PERMISSIVE |
| `clinics` | ✅ | 1 | `deny_all_anon` | ⚠️ PERMISSIVE |
| `clinic_promotions` | ✅ | **0** | — | ❌ POLICY YO'Q |
| `dependents` | ✅ | 2 | `dependents_owner`, `dependents_super_admin` | ✅ To'g'ri |
| `doctor_blocked_dates` | ✅ | **0** | — | ❌ POLICY YO'Q |
| `doctor_directions` | ✅ | **0** | — | ❌ POLICY YO'Q |
| `doctor_experiences` | ✅ | **0** | — | ❌ POLICY YO'Q |
| `doctor_specialties` | ✅ | **0** | — | ❌ POLICY YO'Q |
| `doctor_workplaces` | ✅ | **0** | — | ❌ POLICY YO'Q |
| `doctors` | ✅ | 1 | `deny_all_anon` | ⚠️ PERMISSIVE |
| `feature_flags` | ✅ | 1 | `deny_all_anon` | ⚠️ PERMISSIVE |
| `module_configs` | ✅ | 1 | `deny_all_anon` | ⚠️ PERMISSIVE |
| `payments` | ✅ | 1 | `deny_all_anon` | ⚠️ PERMISSIVE |
| `rate_limits` | ✅ | 1 | `deny_public_access` | ✅ RESTRICTIVE — to'g'ri |
| `refunds` | ✅ | 1 | `deny_all_anon` | ⚠️ PERMISSIVE |
| `service_doctors` | ✅ | 1 | `deny_all_anon` | ⚠️ PERMISSIVE |
| `services` | ✅ | 1 | `deny_all_anon` | ⚠️ PERMISSIVE |
| `slots` | ✅ | 1 | `deny_all_anon` | ⚠️ PERMISSIVE |
| `staff` | ✅ | 1 | `deny_all_anon` | ⚠️ PERMISSIVE |
| `telegram_id_history` | ✅ | 1 | `deny_all_anon` | ⚠️ PERMISSIVE |
| `telegram_relay_log` | ✅ | 3 | `relay_log_*` (3 ta) | ✅ To'g'ri |
| `user_clinics` | ✅ | 1 | `deny_all_anon` | ⚠️ PERMISSIVE |
| `users` | ✅ | 1 | `deny_all_anon` | ⚠️ PERMISSIVE |
| `ad_campaign_channels` | ✅ | 1 | `deny_all_anon` | ⚠️ PERMISSIVE (`public` role) |
| `ad_campaigns` | ✅ | 1 | `deny_all_anon` | ⚠️ PERMISSIVE (`public` role) |
| `ad_channels` | ✅ | 1 | `deny_all_anon` | ⚠️ PERMISSIVE (`public` role) |
| `ad_posts` | ✅ | 1 | `deny_all_anon` | ⚠️ PERMISSIVE (`public` role) |
| `_prisma_migrations` | ✅ | 1 | `deny_all_anon` | ⚠️ PERMISSIVE |

**Yakuniy hisob:** 6 ❌ policy yo'q | 23 ⚠️ PERMISSIVE | 3 ✅ to'g'ri

---

## 2. MUAMMO #1 — 6 TA POLICY'SIZ JADVAL

### Nima uchun xavfli?

PostgreSQL RLS yoqilgan lekin policy yo'q bo'lganda "implicit deny" ishlaydi — ya'ni hozir hech kim kira olmaydi. **LEKIN** bu:
- Eksplisit emas — biror migration noto'g'ri `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` qilsa ochiladi
- Audit log'da "0 policy" ko'rinadi — xavfsizlik tekshiruvida qizil bayroq

### 6 ta jadval — scope tahlili

#### 1. `clinic_promotions`

```
Maydonlar: clinicId, postUrl, embedId, type, source, title, 
           subscribeUsername, showSubscribeButton, isActive, 
           sortOrder, publishedAt, createdById
```

| Savol | Javob |
|-------|-------|
| clinicId to'g'ridan bormi? | ✅ Ha |
| Webapp anon ko'radimi? | ❌ Yo'q — Prisma API route orqali |
| Bot ishlatanadimi? | ❌ Yo'q — faqat admin panel |
| Kimga yozish kerak? | Faqat clinic_admin/super_admin |

**Tavsiya:** `RESTRICTIVE deny_all_anon` — scope kengaytirish shart emas, Prisma `service_role` orqali ishlaydi.

---

#### 2. `doctor_blocked_dates`

```
Maydonlar: doctorId, type ('recurring'|'once'), weekday, date, 
           reason, createdBy (userId)
```

| Savol | Javob |
|-------|-------|
| clinicId to'g'ridan bormi? | ❌ Yo'q — `doctorId` orqali bilvosita |
| Webapp anon ko'radimi? | ❌ Yo'q — faqat shifokor grafigi admin panelda |
| Kimga yozish kerak? | clinic_admin / branch_admin |

**Tavsiya:** `RESTRICTIVE deny_all_anon` — clinicId scope join talab qiladi, Prisma yetarli.

---

#### 3. `doctor_directions`

```
Maydonlar: doctorId, name, sortOrder
```

**Tavsiya:** `RESTRICTIVE deny_all_anon` — `doctors` jadvalining child record'i, flip-card webapp uchun Prisma join orqali o'qiydi.

---

#### 4. `doctor_experiences`

```
Maydonlar: doctorId, place, startYear, endYear, sortOrder
```

**Tavsiya:** `RESTRICTIVE deny_all_anon` — same reason.

---

#### 5. `doctor_specialties`

```
Maydonlar: doctorId, name, sortOrder
```

**Tavsiya:** `RESTRICTIVE deny_all_anon` — same reason.

---

#### 6. `doctor_workplaces`

```
Maydonlar: doctorId, place, sortOrder
```

**Tavsiya:** `RESTRICTIVE deny_all_anon` — same reason.

---

### Qo'shilishi kerak bo'lgan SQL (bittama-bitta)

**1-qadam: `clinic_promotions`**
```sql
ALTER TABLE clinic_promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY deny_all_anon ON clinic_promotions
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
```

**Smoke-test (Prisma — service_role, buzilmasligi kerak):**
```sql
-- service_role orqali (Prisma): o'tishi kerak
SELECT COUNT(*) FROM clinic_promotions LIMIT 1;
```

**Anon kalit blok testi:**
```bash
curl -X GET "https://lxqimithjjabhnldcugc.supabase.co/rest/v1/clinic_promotions" \
  -H "apikey: ANON_KEY" \
  -H "Authorization: Bearer ANON_KEY"
# Kutilgan: {"code":"42501","details":null,"hint":null,"message":"...permission denied..."}
```

---

**2-qadam: `doctor_blocked_dates`**
```sql
CREATE POLICY deny_all_anon ON doctor_blocked_dates
  AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);
```

**3-qadam: `doctor_directions`**
```sql
CREATE POLICY deny_all_anon ON doctor_directions
  AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);
```

**4-qadam: `doctor_experiences`**
```sql
CREATE POLICY deny_all_anon ON doctor_experiences
  AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);
```

**5-qadam: `doctor_specialties`**
```sql
CREATE POLICY deny_all_anon ON doctor_specialties
  AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);
```

**6-qadam: `doctor_workplaces`**
```sql
CREATE POLICY deny_all_anon ON doctor_workplaces
  AS RESTRICTIVE FOR ALL TO anon, authenticated
  USING (false) WITH CHECK (false);
```

---

## 3. MUAMMO #2 — PERMISSIVE vs RESTRICTIVE

### Texnik farq

```
Scenario: jadvalda 2 ta policy bor
  Policy A: PERMISSIVE, qual = false  (deny)
  Policy B: PERMISSIVE, qual = true   (allow — tasodifan qo'shilgan)

PostgreSQL qaror: A=false, B=true → OR(false, true) = TRUE → RUXSAT ✅ (XAVFLI!)
```

```
Scenario: jadvalda 2 ta policy bor
  Policy A: RESTRICTIVE, qual = false (deny)  
  Policy B: PERMISSIVE, qual = true   (allow)

PostgreSQL qaror: RESTRICTIVE majburiy → AND(false, ...) = FALSE → BLOKLANDI ✅ (TO'G'RI!)
```

### Hozirgi xavf darajasi

`rate_limits` to'g'ri RESTRICTIVE ishlatadi.  
Qolgan 22+ jadval PERMISSIVE — agar biror migration yoki developer noto'g'ri policy qo'shsa, bypass ochiladi.

### Tuzatish SQL

```sql
-- Misol: appointments jadvalini to'g'irlash
BEGIN;

DROP POLICY IF EXISTS deny_all_anon ON appointments;

CREATE POLICY deny_all_anon ON appointments
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

COMMIT;
```

**Barcha PERMISSIVE jadvallarga bir to'plam SQL:**
```sql
DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'appointments','audit_logs','bot_states','branches',
    'clinic_settings','clinics','doctors','feature_flags',
    'module_configs','payments','refunds','service_doctors',
    'services','slots','staff','telegram_id_history',
    'user_clinics','users','ad_campaign_channels',
    'ad_campaigns','ad_channels','ad_posts','_prisma_migrations'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('DROP POLICY IF EXISTS deny_all_anon ON %I', tbl);
    EXECUTE format(
      'CREATE POLICY deny_all_anon ON %I
       AS RESTRICTIVE FOR ALL TO anon, authenticated
       USING (false) WITH CHECK (false)',
      tbl
    );
    RAISE NOTICE 'Fixed: %', tbl;
  END LOOP;
END $$;
```

> **DIQQAT:** Bu SQL'ni `apply_migration` orqali ishlatish kerak, `execute_sql` emas — DDL o'zgartirish.

---

## 4. MUAMMO #3 — FK & CASCADE TEKSHIRUVI

### Schema tahlili (Prisma schema.prisma asosida)

| Relation | onDelete | Holat | Xavf |
|----------|----------|-------|------|
| `Payment → Appointment` | `Restrict` | ✅ To'g'ri | To'lovi bor bronni o'chirib bo'lmaydi |
| `Refund → Payment` | `Restrict` | ✅ To'g'ri | Qaytarilgan to'lovni o'chirib bo'lmaydi |
| `Appointment → Clinic` | `Cascade` | ✅ To'g'ri | Klinika o'chsa bronlar ham |
| `Appointment → Branch` | SetNull (implicit, optional) | ✅ OK | Branch o'chsa branchId NULL bo'ladi |
| `Appointment → Service` | **ko'rsatilmagan** | ⚠️ `NoAction` default | Service o'chsa → FK violation xatosi |
| `Appointment → Doctor` | **ko'rsatilmagan** | ⚠️ `NoAction` default | Shifokor o'chsa → FK violation xatosi |
| `Appointment → Slot` | **ko'rsatilmagan** | ⚠️ `NoAction` default | Slot o'chsa → FK violation xatosi |
| `Doctor → Clinic` | `Cascade` | ✅ To'g'ri | |
| `DoctorBlockedDate → Doctor` | `Cascade` | ✅ To'g'ri | |
| `Service → Branch` | `SetNull` | ✅ To'g'ri | Branch o'chsa service orphan emas |
| `Dependent → User` | `Cascade` | ✅ To'g'ri | |
| `Appointment → Dependent` | `SetNull` | ✅ To'g'ri | |

### Muammo: `Appointment → Service` (NoAction)

```
Holat: Service hard-delete qilinadi
       → appointments.serviceId FK violation
       → Postgres xatosi: "update or delete violates foreign key constraint"
       
Savol: Service hard-delete bo'ladimi yoki soft-delete (isActive=false)?
```

Schemada `Service.isActive Boolean @default(true)` bor — soft-delete uchun mo'ljallangan.  
Agar hech qachon hard-delete qilinmasa, NoAction xavfsiz.  
**Tavsiya:** Tasdiqlash kerak — service/doctor hard-delete yoki soft-delete ishlatiladi?

### Real test qilish

```sql
-- 1. To'lovi bor bronni o'chirishga urinish (Restrict ishlashi kerak)
BEGIN;
  -- Test bron va to'lov yaratamiz
  INSERT INTO appointments (id, "clinicId", "serviceId", "patientName", "patientPhone", date, status)
  VALUES ('test-appt-001', 'CLINIC_ID', 'SERVICE_ID', 'Test', '+998900000000', NOW()::date, 'booked');
  
  INSERT INTO payments (id, "appointmentId", "clinicId", provider, amount, state)
  VALUES ('test-pay-001', 'test-appt-001', 'CLINIC_ID', 'payme', 50000, 'paid');
  
  -- Bu RESTRICT tufayli xato berishi kerak:
  DELETE FROM appointments WHERE id = 'test-appt-001';
  -- Kutilgan: ERROR: update or delete violates foreign key constraint
ROLLBACK;
```

---

## 5. MUAMMO #4 — CHECK CONSTRAINT'LAR

### Hozirgi holat: faqat app darajasida tekshiruv

| Jadval | Maydon | Tip | DB constraint | Xavf |
|--------|--------|-----|---------------|------|
| `clinic_settings` | `discountPercent` | `Int` | ❌ yo'q | -999 yoki 500 kiritish mumkin |
| `appointments` | `paymentStatus` | `String` | ❌ yo'q | Har qanday string |
| `appointments` | `appliedDiscountPercent` | `Int` | ❌ yo'q | 0-100 dan tashqari |
| `doctor_blocked_dates` | `type` | `String` | ❌ yo'q | `recurring`/`once` dan boshqa |
| `doctor_blocked_dates` | `weekday` | `Int?` | ❌ yo'q | 0-6 tashqari |
| `doctor_blocked_dates` | type+weekday/date | — | ❌ yo'q | recurring+null weekday kombinatsiyasi |
| `services` | `price` | `Decimal` | ❌ yo'q | Manfiy narx |
| `services` | `prePaymentAmount` | `Decimal?` | ❌ yo'q | Manfiy |

### Qo'shilishi kerak bo'lgan CHECK'lar

```sql
-- 1. discountPercent: 0-100
ALTER TABLE clinic_settings
  ADD CONSTRAINT chk_discount_percent 
  CHECK ("discountPercent" >= 0 AND "discountPercent" <= 100);

-- 2. appointments.appliedDiscountPercent: 0-100  
ALTER TABLE appointments
  ADD CONSTRAINT chk_applied_discount
  CHECK ("appliedDiscountPercent" >= 0 AND "appliedDiscountPercent" <= 100);

-- 3. appointments.paymentStatus: enum qiymatlar (DB + kod dan tasdiqlangan)
ALTER TABLE appointments
  ADD CONSTRAINT chk_payment_status
  CHECK ("paymentStatus" IN ('pending', 'paid', 'not_required', 'cancelled', 'failed'));

-- 4. doctor_blocked_dates.type
ALTER TABLE doctor_blocked_dates
  ADD CONSTRAINT chk_blocked_type
  CHECK (type IN ('recurring', 'once'));

-- 5. doctor_blocked_dates.weekday: 0-6 yoki NULL
ALTER TABLE doctor_blocked_dates
  ADD CONSTRAINT chk_blocked_weekday
  CHECK (weekday IS NULL OR (weekday >= 0 AND weekday <= 6));

-- 6. doctor_blocked_dates: recurring→weekday kerak, once→date kerak
ALTER TABLE doctor_blocked_dates
  ADD CONSTRAINT chk_blocked_consistency
  CHECK (
    (type = 'recurring' AND weekday IS NOT NULL AND date IS NULL) OR
    (type = 'once' AND date IS NOT NULL AND weekday IS NULL)
  );

-- 7. services.price: manfiy bo'lmasin
ALTER TABLE services
  ADD CONSTRAINT chk_service_price
  CHECK (price >= 0);

ALTER TABLE services
  ADD CONSTRAINT chk_prepayment_amount
  CHECK ("prePaymentAmount" IS NULL OR "prePaymentAmount" >= 0);
```

---

## 6. HARAKAT REJASI — PRIORITET TARTIBI

### Prioritet 1: 6 ta policy'siz jadval (BUGUN)

Har biri alohida, bittama-bitta:

```
[  ] 1. clinic_promotions    → deny_all_anon RESTRICTIVE qo'sh → anon test
[  ] 2. doctor_blocked_dates → deny_all_anon RESTRICTIVE qo'sh → anon test
[  ] 3. doctor_directions    → deny_all_anon RESTRICTIVE qo'sh → anon test
[  ] 4. doctor_experiences   → deny_all_anon RESTRICTIVE qo'sh → anon test
[  ] 5. doctor_specialties   → deny_all_anon RESTRICTIVE qo'sh → anon test
[  ] 6. doctor_workplaces    → deny_all_anon RESTRICTIVE qo'sh → anon test
```

Har biridan keyin smoke-test:
- Prisma query ishlaydi (service_role bypass)
- Anon kalit `42501 permission denied` qaytaradi

### Prioritet 2: PERMISSIVE → RESTRICTIVE (23 jadval)

Bitta migration SQL bilan — yuqoridagi `DO $$ ... $$` bloki.

### Prioritet 3: FK tekshiruvi

- `Appointment → Service`: hard yoki soft-delete? → tasdiqlash kerak
- Payment → Appointment Restrict real test qilish

### Prioritet 4: CHECK constraint migration

8 ta constraint → bitta migration fayl.

---

## 7. BEFORE/AFTER TAQQOSLASH

### Before (hozir)
```
anon kalit + GET /rest/v1/clinic_promotions
→ HTTP 200 [] (bo'sh, lekin ulanadi — xavfli signal)

anon kalit + GET /rest/v1/doctor_specialties
→ HTTP 200 [] (xuddi shunday)
```

### After (maqsad)
```
anon kalit + GET /rest/v1/clinic_promotions
→ HTTP 400 {"code":"42501","message":"permission denied for table clinic_promotions"}

Prisma (service_role) + findMany(clinic_promotions)
→ ishlaydi ✅ (service_role RLS bypass qiladi)
```

---

## 8. QISQACHA XULOSA

| Topilma | Jadval soni | Kritiklik | Holat |
|---------|-------------|-----------|-------|
| Policy'siz jadvallar | 6 | 🔴 Yuqori | Harakat kerak |
| PERMISSIVE deny (RESTRICTIVE kerak) | 23 | 🟡 O'rta | Harakat kerak |
| FK NoAction muammosi | 3 | 🟡 O'rta | Tasdiqlash kerak |
| CHECK constraint yo'q | 8 maydon | 🟡 O'rta | Harakat kerak |
| To'g'ri ishlaydigan jadvallar | 3 | ✅ | `dependents`, `telegram_relay_log`, `rate_limits` |

**Keyingi qadam:** `clinic_promotions` ga birinchi `RESTRICTIVE deny_all_anon` policy qo'shish va anon kalit bilan test.

---

*Hisobot: To'lqin 5 tahlili | Loyiha: nextBOT | DB: lxqimithjjabhnldcugc*
