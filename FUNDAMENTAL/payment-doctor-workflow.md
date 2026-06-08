# 🏥 VAZIFA: Qabulxona/Shifokor Workflow Ajratish — To'lov va Muolaja Nazorati

> **Loyiha:** TibTaqvim — https://tibtaqvim.vercel.app  
> **Repo:** oqiljonplay-ctrl/tibtaqvim  
> **Stack:** Next.js 14 (App Router) + Prisma 6 + Supabase PG17 + Vercel + Telegram Bot/WebApp  
> **Supabase project_id:** `lxqimithjjabhnldcugc`  
> **Vercel project_id:** `prj_U0d0bOMH4rj6Ao2JVeeQtGvgjKgJ`

---

## 🎯 MUAMMO (foydalanuvchi aniqlagan)

Hozir **qabulxona UI** va **shifokor UI** — har ikkalasida har bemorda bir xil **"keldi/kelmadi"** tugmalari bor. Bu **takror** va **mantiqsiz**: bir xil amal ikki marta.

### Yangi to'g'ri workflow

```
QABULXONA:  💰 To'ladi / To'lamadi   ← to'lov (kassa) nazorati
                  │
                  │ "To'ladi" bosilsa
                  ▼
SHIFOKOR:   ✅ Keldi / Kelmadi       ← muolaja nazorati
```

Har xodimning **o'z mas'uliyati**:
- **Qabulxona** — pul to'lovini tasdiqlaydi (`paymentStatus`)
- **Shifokor** — bemor muolajaga keldi/kelmadi (`status`)

### Oqim mantiqi

1. Bemor bron qiladi → `paymentStatus: pending`, `status: booked`
2. Qabulxona **"To'ladi"** bosadi → `paymentStatus: paid`
3. **Faqat shundan keyin** bemor shifokor UI'da ko'rinadi va navbat oladi
4. Shifokor bemorni ko'rib **"Keldi"** yoki **"Kelmadi"** bosadi → `status: arrived/missed`
5. Har shifokor xizmati — **alohida "orolcha"** (card), mutaxassislik nomi bilan
6. Har orolcha — alohida **chop etish** va **yuklab olish** (PDF)

---

## ✅ TASDIQLANGAN QARORLAR (4 ta)

Foydalanuvchi quyidagi qarorlarni tasdiqladi (⭐ tavsiya etilgan variantlar):

### 1. `not_required` holati → **QOLADI** (B variant)
- Bepul ko'rik / qayta ko'rik uchun maxsus holat sifatida saqlanadi
- **Lekin yangi bron default — `pending`** (to'lov kutilmoqda)
- Eski mantiq buzilmaydi

### 2. To'lov qaysi rejimlarda → **HAMMA REJIM** (A variant)
- `live` va `online` — ikkalasi ham to'lov talab qiladi
- `live` (jonli kelgan) — qabulxonada darrov to'laydi
- `online` (oldindan band) — kelganda to'laydi

### 3. "To'lamadi" tugmasi → **FAQAT `pending` da qoldiradi** (B variant)
- Bronni bekor qilmaydi
- Bemor keyinroq to'lashi mumkin
- Alohida "Bekor qilish" tugmasi bor (status: cancelled)

### 4. Eski 6 ta nomuvofiq bron (`arrived` + `not_required`) → **TEGILMAYDI** (A variant)
- Legacy ma'lumot — eski qoida bilan qoldiriladi
- Yangi qoida faqat yangi bronlardan boshlanadi

---

## 🛡 MUTLAQ QOIDALAR — Buzilmasligi shart

### Tegilmaydi (mavjud va ishlaydigan)

| Komponent | Holat |
|---|---|
| Multi-clinic foundation (clinics, branches, payment_config, subscription) | ✅ Ishlamoqda |
| Branch isolation S1-S5 (branch-scope.ts, services.branchId) | ✅ Ishlamoqda |
| Role-aware navbar (clinic + branch + role badge) | ✅ Ishlamoqda |
| Telegram relay button (universal chat + fayl) | ✅ Ishlamoqda |
| Smart patient identity (PatientSelector, dependents) | ✅ Ishlamoqda |
| Service-Doctor M2M + queueMode (live/online/slot-disabled) | ✅ Ishlamoqda |
| Doctor date picker, Specialty dropdown | ✅ Ishlamoqda |
| Admin 6 ta KPI grafik (Recharts) | ✅ Ishlamoqda |
| RLS 21/21 jadval, 8 audit trigger | ✅ Tegilmaydi |
| Cookie + JWT 24h auth, Telegram webhook secret | ✅ Tegilmaydi |
| `appointments_unique_patient_doctor_date` index | ✅ Tegilmaydi |
| Eski 43 ta appointment (history) | ✅ Tegilmaydi |
| `requiresSlot` UI yashirin (Bosqich 2 ga qadar) | ✅ Tegilmaydi |

### O'zgartiriladi

- Qabulxona UI — "keldi/kelmadi" → **"to'ladi/to'lamadi"** + "Bekor"
- Shifokor UI — faqat `paymentStatus='paid'` bronlar ko'rinadi
- Shifokor UI — xizmat bo'yicha guruhlangan orolchalar
- Yangi bron yaratish — default `paymentStatus: pending` (hamma rejimda)

### Yangi qo'shiladi

- Markaziy `markAsPaid()` / `markAsUnpaid()` / `markAsArrived()` / `markAsMissed()` funksiyalar
- `paymentStatus` uchun DB CHECK constraint
- Qabulxona: 2 bo'lim (To'lov kutilmoqda / To'langan)
- Shifokor: xizmat bo'yicha orolchalar + chop etish/yuklab olish (PDF)
- `markAsPaid` — kelajak Payme/Click webhook uchun **zamin**

---

## 📊 MAVJUD SCHEMA HOLATI (DB tasdiqlangan — 22-may 2026)

### appointments — workflow uchun kalit ustunlar

```
status         AppointmentStatus enum   NOT NULL  default 'booked'
               qiymatlar: booked / arrived / missed / cancelled

paymentStatus  text                     NOT NULL  default 'not_required'
               qiymatlar: not_required / pending / paid / cancelled

queueMode      QueueMode enum           NOT NULL  default 'online'
               qiymatlar: live / online / slot-disabled

queueNumber    integer                  NULL
doctorId       text                     NULL   (diagnostika xizmatlari uchun NULL)
serviceId      text                     NOT NULL
clinicId       text                     NOT NULL
branchId       text                     NULL
date           date                     NOT NULL
```

### Mavjud indexlar
```
appointments_pkey
appointments_clinicId_idx
appointments_clinicId_date_idx
appointments_doctorId_date_idx
appointments_serviceId_date_idx
appointments_live_active_idx
appointments_unique_patient_doctor_date
```

### Joriy ma'lumot holati
- **43 ta** appointment (eski/legacy)
- **6 ta** nomuvofiq: `status=arrived` + `paymentStatus=not_required` → **tegilmaydi (legacy)**
- **4 ta** `paymentStatus=pending`
- **1 ta** `paymentStatus=paid`
- Aksariyat `not_required` — eski bronlar

### Xizmatlar (11 ta, BUYUK TABIB)
- doctor_queue (shifokorli): Kardiolog, Nevropatolog, Ortoped, Psixolog, Terapevt
- diagnostic (diagnostika): EKG, MRT, Mskt, Qon tahlili
- home_service: Uyda bemor ko'rish

⚠️ **Diagnostika xizmatlari** — `doctorId` NULL bo'lishi mumkin (shifokorga biriktirilmagan). Workflow shuni hisobga olishi kerak.

---

# 📋 ISH BOSQICHLARI

> **MUHIM:** Har bosqich yakunida VS Code Claude **test qiladi** (build + lokal tekshiruv). Oxirgi bosqichda **vizual test** va **deploy**. Har bosqichdan keyin foydalanuvchidan tasdiq olinadi.

---

## BOSQICH 1 — DIAGNOSTIKA

### 1.1 — Mavjud fayllarni topish

```bash
# Qabulxona UI
find src/app -path "*reception*" -name "*.tsx" 2>/dev/null
grep -rn "keldi\|kelmadi\|arrived\|missed" src/app/reception 2>/dev/null | head -20

# Shifokor UI
find src/app -path "*doctor*" -name "*.tsx" 2>/dev/null
grep -rn "keldi\|kelmadi\|arrived\|missed" src/app/doctor 2>/dev/null | head -20

# Status o'zgartirish API
grep -rn "status.*arrived\|status.*missed\|AppointmentStatus" src/app/api 2>/dev/null | head -20
find src/app/api -name "route.ts" | xargs grep -l "paymentStatus\|status" 2>/dev/null | head -10

# Bron yaratish — paymentStatus qaerda belgilanadi
grep -rn "paymentStatus" src/lib src/app/api 2>/dev/null | head -20

# branch-scope helper (qayta ishlatish uchun)
cat src/lib/branch-scope.ts 2>/dev/null | head -40

# Response helper
find src/lib -name "api-response.ts" -o -name "response.ts" 2>/dev/null

# Auth helper
grep -rn "requireAuth\|getAuthUser" src/lib 2>/dev/null | head -5
```

### 1.2 — Tushunish kerak

1. Qabulxona UI qaysi sahifada? (`/reception` yoki `/admin/...`)
2. Hozir qabulxonada "keldi/kelmadi" qanday API chaqiradi?
3. Shifokor UI qaysi sahifada va qanday bron ro'yxati oladi?
4. Bron yaratishda `paymentStatus` qiymati qaerda beriladi? (hozir `not_required` default)
5. `requireAuth(req)` qaytaradigan obyekt: `{ userId, role, clinicId, branchId? }`
6. `branch-scope.ts` — `getBranchScope` / `resolveBranchIdForCreate` qanday ishlaydi
7. Response wrapper: `ok()` / `error()` formati
8. Shifokor UI bron ro'yxati qaysi endpoint orqali keladi
9. PDF/chop etish uchun kutubxona bormi? (`jspdf`, `react-to-print`, yoki yo'q)

### 1.3 — Foydalanuvchiga hisobot

```
DIAGNOSTIKA HISOBOTI:

📁 QABULXONA UI:
  ✓ Sahifa: src/app/reception/page.tsx (yoki aniq joy)
  ✓ Hozirgi tugmalar: "keldi/kelmadi" → o'zgartiriladi
  ✓ Status API chaqiruvi: PATCH /api/... 

📁 SHIFOKOR UI:
  ✓ Sahifa: src/app/doctor/page.tsx (yoki aniq joy)
  ✓ Hozirgi tugmalar: "keldi/kelmadi" → saqlanadi
  ✓ Bron ro'yxati endpoint: GET /api/...

📁 BRON YARATISH:
  ✓ paymentStatus belgilanadi: src/lib/booking/... (qator NN)
  ✓ Hozirgi default: 'not_required'
  ✓ O'zgartiriladi: 'pending'

📁 HELPERS:
  ✓ branch-scope.ts: getBranchScope, resolveBranchIdForCreate
  ✓ api-response.ts: ok(), error()
  ✓ requireAuth: { userId, role, clinicId, branchId }

📁 PDF/CHOP ETISH:
  ✓ Kutubxona: [jspdf / react-to-print / YO'Q — qo'shish kerak]

ANIQLANGAN NOZIK JOYLAR:
  - [Mavjud nozik joylar]

BOSQICH 2 GA O'TISHGA TAYYORMAN. Davom etamizmi?
```

Foydalanuvchi tasdiqlasa → Bosqich 2.

---

## BOSQICH 2 — DATABASE: paymentStatus qoidalashtirish

### 2.1 — Maqsad

`paymentStatus` hozir **erkin text** (`not_required`). Uni **qat'iy qiymatlar** bilan cheklash + yangi bron default `pending`.

⚠️ **Enum'ga aylantirmaymiz** — chunki:
- Mavjud 43 ta bron bilan migration murakkab
- `not_required` legacy qiymat saqlanishi kerak
- Text + CHECK constraint — yetarlicha xavfsiz va moslashuvchan

### 2.2 — Migration SQL

**Fayl:** `prisma/migrations/YYYYMMDD_payment_workflow/migration.sql` (yangi)

```sql
-- ============================================================
-- PAYMENT WORKFLOW — paymentStatus qoidalashtirish
-- ============================================================

-- 1. CHECK constraint — faqat ruxsat etilgan qiymatlar
-- Mavjud qiymatlar: not_required, pending, paid, cancelled
-- Yangi qiymat qo'shilmaydi — shu 4 tasi yetarli
ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_payment_status_check;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_payment_status_check
  CHECK ("paymentStatus" IN ('not_required', 'pending', 'paid', 'cancelled'));

-- 2. Default qiymatni o'zgartirish: not_required -> pending
-- Yangi bronlar to'lov talab qiladi
ALTER TABLE appointments
  ALTER COLUMN "paymentStatus" SET DEFAULT 'pending';

-- 3. Performance index — qabulxona va shifokor UI uchun
-- Qabulxona: paymentStatus bo'yicha filter (pending/paid)
-- Shifokor: paymentStatus='paid' + serviceId bo'yicha
CREATE INDEX IF NOT EXISTS appointments_payment_date_idx
  ON appointments ("clinicId", date, "paymentStatus");

CREATE INDEX IF NOT EXISTS appointments_doctor_workflow_idx
  ON appointments ("doctorId", date, "paymentStatus", status)
  WHERE "doctorId" IS NOT NULL;

-- ============================================================
-- LEGACY MA'LUMOT — TEGILMAYDI
-- ============================================================
-- Eski 6 ta bron (arrived + not_required) — qoldiriladi.
-- Eski 43 ta appointment umuman o'zgartirilmaydi.
-- Yangi qoida faqat yangi yaratilgan bronlarga tegishli.
-- ============================================================
```

### 2.3 — Prisma schema yangilash

**Fayl:** `prisma/schema.prisma`

`Appointment` modelida `paymentStatus` maydonini topib, default'ni yangilash:

```prisma
model Appointment {
  // ... mavjud maydonlar tegilmaydi

  /// To'lov holati.
  /// Qiymatlar (DB CHECK constraint bilan cheklangan):
  ///   - 'pending'      — to'lov kutilmoqda (YANGI BRON DEFAULT)
  ///   - 'paid'         — to'langan (qabulxona yoki Payme/Click webhook)
  ///   - 'not_required' — to'lov talab qilinmaydi (bepul/qayta ko'rik — legacy)
  ///   - 'cancelled'    — bron bekor qilingan
  paymentStatus String @default("pending")

  // ... qolgan maydonlar tegilmaydi
}
```

⚠️ **Diqqat:** Faqat `@default` o'zgaradi. Maydon turi `String` qoladi (enum emas).

### 2.4 — Migration qo'llash

```bash
# Schema o'zgartirgandan keyin
npx prisma migrate dev --name payment_workflow --create-only

# Yaratilgan SQL faylga 2.2 dagi qo'shimcha SQL'ni qo'shing
# (CHECK constraint, default, indexlar)

npx prisma migrate deploy
npx prisma generate
```

### 2.5 — Verifikatsiya SQL

```sql
-- CHECK constraint qo'shilganmi
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid='public.appointments'::regclass
  AND conname='appointments_payment_status_check';
-- Natija: 1 qator

-- Default o'zgarganmi
SELECT column_default
FROM information_schema.columns
WHERE table_name='appointments' AND column_name='paymentStatus';
-- Natija: 'pending'::text

-- Indexlar
SELECT indexname FROM pg_indexes
WHERE schemaname='public' AND tablename='appointments'
  AND indexname IN ('appointments_payment_date_idx', 'appointments_doctor_workflow_idx');
-- Natija: 2 qator

-- Legacy ma'lumot tegilmaganmi
SELECT COUNT(*) FROM appointments WHERE status='arrived' AND "paymentStatus"='not_required';
-- Natija: 6 (o'zgarmagan)
```

### 2.6 — Test va Commit

```bash
npm run build
# TypeScript xato nol bo'lishi shart

git add prisma/
git commit -m "feat(payment-workflow): paymentStatus CHECK constraint + default pending + indexes"
```

**TEST:** Build muvaffaqiyatli + verifikatsiya SQL natijalari to'g'ri → foydalanuvchidan tasdiq → Bosqich 3.

---

## BOSQICH 3 — MARKAZIY WORKFLOW FUNKSIYALAR

### 3.1 — Maqsad

Status o'zgarishlarini **bitta markaziy joyda** boshqarish. Bu:
- Kelajakda Payme/Click webhook **xuddi shu funksiyani** chaqiradi
- Audit, validatsiya, xato boshqarish — bir joyda
- Hard code yo'q — har klinika/filial uchun ishlaydi

### 3.2 — Workflow service fayli

**Fayl:** `src/lib/workflow/appointment-workflow.ts` (yangi)

```typescript
import { prisma } from "@/lib/prisma";
import type { Appointment } from "@prisma/client";

/**
 * Appointment workflow — status va to'lov holatini boshqarish.
 *
 * IKKI BOSQICHLI OQIM:
 *   1. Qabulxona: paymentStatus (pending -> paid)
 *   2. Shifokor:  status (booked -> arrived/missed)
 *
 * Bu funksiyalar markaziy — qabulxona UI, shifokor UI VA
 * kelajakdagi Payme/Click webhook ham SHU funksiyalarni chaqiradi.
 */

// ============================================================
// TYPES
// ============================================================

export type PaymentStatus = 'pending' | 'paid' | 'not_required' | 'cancelled';
export type AppointmentStatus = 'booked' | 'arrived' | 'missed' | 'cancelled';

export interface WorkflowResult {
  success: boolean;
  appointment?: Appointment;
  error?: string;
}

/** To'lov manbai — audit uchun */
export type PaymentSource = 'reception' | 'payme' | 'click' | 'cash' | 'admin';

// ============================================================
// TO'LOV NAZORATI (Qabulxona)
// ============================================================

/**
 * Bemorni "to'lagan" deb belgilash.
 *
 * Kim chaqiradi:
 *   - Qabulxona "To'ladi" tugmasi (source: 'reception')
 *   - KELAJAK: Payme webhook (source: 'payme')
 *   - KELAJAK: Click webhook (source: 'click')
 *
 * @param appointmentId - bron ID
 * @param actorClinicId - amalni bajaruvchi xodim klinikasi (xavfsizlik)
 * @param source - to'lov manbai (audit uchun)
 */
export async function markAsPaid(
  appointmentId: string,
  actorClinicId: string | null,
  source: PaymentSource = 'reception'
): Promise<WorkflowResult> {
  try {
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true,
        clinicId: true,
        paymentStatus: true,
        status: true,
      },
    });

    if (!appt) {
      return { success: false, error: 'Bron topilmadi' };
    }

    // Xavfsizlik: actor o'z klinikasidagi bronni boshqaradi
    // (super_admin uchun actorClinicId = null — hamma klinika)
    if (actorClinicId && appt.clinicId !== actorClinicId) {
      return { success: false, error: 'Bu bron boshqa klinikaga tegishli' };
    }

    // Bekor qilingan bronni to'langan deb belgilab bo'lmaydi
    if (appt.status === 'cancelled') {
      return { success: false, error: 'Bekor qilingan bron uchun to\'lov belgilab bo\'lmaydi' };
    }

    // Allaqachon to'langan
    if (appt.paymentStatus === 'paid') {
      return { success: false, error: 'Bu bron allaqachon to\'langan' };
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        paymentStatus: 'paid',
        // Audit izohi — notes ga qo'shimcha (mavjud notes saqlanadi)
        // Kelajakda alohida payment_transactions jadval bo'lishi mumkin
      },
    });

    // Audit log (mavjud audit trigger avtomatik yozadi,
    // lekin manba ('source') ni ham saqlash uchun qo'shimcha log)
    console.log(`[workflow] markAsPaid: ${appointmentId} by ${source}`);

    return { success: true, appointment: updated };
  } catch (err: any) {
    console.error('[workflow/markAsPaid] error:', err);
    return { success: false, error: err?.message || 'Server xatosi' };
  }
}

/**
 * "To'lamadi" — to'lovni pending holatiga qaytarish.
 *
 * QAROR (tasdiqlangan): bronni BEKOR QILMAYDI, faqat pending qoldiradi.
 * Bemor keyinroq to'lashi mumkin.
 *
 * Kim chaqiradi: Qabulxona "To'lamadi" tugmasi
 */
export async function markAsUnpaid(
  appointmentId: string,
  actorClinicId: string | null
): Promise<WorkflowResult> {
  try {
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { id: true, clinicId: true, paymentStatus: true, status: true },
    });

    if (!appt) {
      return { success: false, error: 'Bron topilmadi' };
    }

    if (actorClinicId && appt.clinicId !== actorClinicId) {
      return { success: false, error: 'Bu bron boshqa klinikaga tegishli' };
    }

    if (appt.status === 'cancelled') {
      return { success: false, error: 'Bekor qilingan bron' };
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { paymentStatus: 'pending' },
    });

    return { success: true, appointment: updated };
  } catch (err: any) {
    console.error('[workflow/markAsUnpaid] error:', err);
    return { success: false, error: err?.message || 'Server xatosi' };
  }
}

/**
 * Bronni butunlay bekor qilish.
 *
 * Kim chaqiradi: Qabulxona "Bekor" tugmasi
 * status -> cancelled, paymentStatus -> cancelled
 */
export async function cancelAppointment(
  appointmentId: string,
  actorClinicId: string | null
): Promise<WorkflowResult> {
  try {
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { id: true, clinicId: true, status: true },
    });

    if (!appt) {
      return { success: false, error: 'Bron topilmadi' };
    }

    if (actorClinicId && appt.clinicId !== actorClinicId) {
      return { success: false, error: 'Bu bron boshqa klinikaga tegishli' };
    }

    if (appt.status === 'cancelled') {
      return { success: false, error: 'Bron allaqachon bekor qilingan' };
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: 'cancelled',
        paymentStatus: 'cancelled',
      },
    });

    return { success: true, appointment: updated };
  } catch (err: any) {
    console.error('[workflow/cancelAppointment] error:', err);
    return { success: false, error: err?.message || 'Server xatosi' };
  }
}

// ============================================================
// MUOLAJA NAZORATI (Shifokor)
// ============================================================

/**
 * Bemorni "keldi" deb belgilash (muolaja oldi).
 *
 * QOIDA: faqat to'langan (paid) yoki not_required bron uchun.
 * To'lanmagan bemor shifokor UI'da umuman ko'rinmaydi.
 *
 * Kim chaqiradi: Shifokor "Keldi" tugmasi
 */
export async function markAsArrived(
  appointmentId: string,
  actorClinicId: string | null
): Promise<WorkflowResult> {
  try {
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true, clinicId: true, status: true, paymentStatus: true,
      },
    });

    if (!appt) {
      return { success: false, error: 'Bron topilmadi' };
    }

    if (actorClinicId && appt.clinicId !== actorClinicId) {
      return { success: false, error: 'Bu bron boshqa klinikaga tegishli' };
    }

    if (appt.status === 'cancelled') {
      return { success: false, error: 'Bekor qilingan bron' };
    }

    // MUHIM QOIDA: to'lanmagan bemorni "keldi" deb belgilab bo'lmaydi
    // (not_required — legacy bepul ko'rik uchun ruxsat)
    if (appt.paymentStatus !== 'paid' && appt.paymentStatus !== 'not_required') {
      return {
        success: false,
        error: 'To\'lov tasdiqlanmagan — avval qabulxona to\'lovni qabul qilishi kerak',
      };
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: 'arrived' },
    });

    return { success: true, appointment: updated };
  } catch (err: any) {
    console.error('[workflow/markAsArrived] error:', err);
    return { success: false, error: err?.message || 'Server xatosi' };
  }
}

/**
 * Bemorni "kelmadi" deb belgilash.
 *
 * Kim chaqiradi: Shifokor "Kelmadi" tugmasi
 */
export async function markAsMissed(
  appointmentId: string,
  actorClinicId: string | null
): Promise<WorkflowResult> {
  try {
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true, clinicId: true, status: true, paymentStatus: true,
      },
    });

    if (!appt) {
      return { success: false, error: 'Bron topilmadi' };
    }

    if (actorClinicId && appt.clinicId !== actorClinicId) {
      return { success: false, error: 'Bu bron boshqa klinikaga tegishli' };
    }

    if (appt.status === 'cancelled') {
      return { success: false, error: 'Bekor qilingan bron' };
    }

    if (appt.paymentStatus !== 'paid' && appt.paymentStatus !== 'not_required') {
      return {
        success: false,
        error: 'To\'lov tasdiqlanmagan bron',
      };
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: 'missed' },
    });

    return { success: true, appointment: updated };
  } catch (err: any) {
    console.error('[workflow/markAsMissed] error:', err);
    return { success: false, error: err?.message || 'Server xatosi' };
  }
}

/**
 * Status'ni qaytarish (xato bosilgan bo'lsa).
 * arrived/missed -> booked
 *
 * Kim chaqiradi: Shifokor "Bekor qilish" (status reset)
 */
export async function resetToBooked(
  appointmentId: string,
  actorClinicId: string | null
): Promise<WorkflowResult> {
  try {
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { id: true, clinicId: true, status: true },
    });

    if (!appt) {
      return { success: false, error: 'Bron topilmadi' };
    }

    if (actorClinicId && appt.clinicId !== actorClinicId) {
      return { success: false, error: 'Bu bron boshqa klinikaga tegishli' };
    }

    if (appt.status === 'cancelled') {
      return { success: false, error: 'Bekor qilingan bronni qaytarib bo\'lmaydi' };
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: 'booked' },
    });

    return { success: true, appointment: updated };
  } catch (err: any) {
    console.error('[workflow/resetToBooked] error:', err);
    return { success: false, error: err?.message || 'Server xatosi' };
  }
}
```

### 3.3 — Test va Commit

```bash
npm run build

git add src/lib/workflow/
git commit -m "feat(payment-workflow): central workflow functions — markAsPaid/Unpaid/Arrived/Missed/Cancel"
```

**TEST:** Build muvaffaqiyatli → foydalanuvchidan tasdiq → Bosqich 4.

---

## BOSQICH 4 — BACKEND API ENDPOINTLAR

### 4.1 — Qabulxona to'lov endpoint

**Fayl:** `src/app/api/reception/appointments/[id]/payment/route.ts` (yangi)

```typescript
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, error } from "@/lib/api-response";
import { markAsPaid, markAsUnpaid, cancelAppointment } from "@/lib/workflow/appointment-workflow";

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/reception/appointments/[id]/payment
 *
 * Qabulxona to'lov amallari.
 * Body: { action: 'paid' | 'unpaid' | 'cancel' }
 *
 * Ruxsat: receptionist, clinic_admin, branch_admin, super_admin
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req);
  if (!auth) return error('Unauthorized', 401);

  const allowedRoles = ['receptionist', 'clinic_admin', 'branch_admin', 'super_admin'];
  if (!allowedRoles.includes(auth.role)) {
    return error('Bu amal uchun ruxsat yo\'q', 403);
  }

  try {
    const body = await req.json();
    const action = body.action as string;

    // super_admin uchun clinicId = null (hamma klinika)
    const actorClinicId = auth.role === 'super_admin' ? null : auth.clinicId;

    let result;
    switch (action) {
      case 'paid':
        result = await markAsPaid(params.id, actorClinicId, 'reception');
        break;
      case 'unpaid':
        result = await markAsUnpaid(params.id, actorClinicId);
        break;
      case 'cancel':
        result = await cancelAppointment(params.id, actorClinicId);
        break;
      default:
        return error('Noto\'g\'ri amal (paid/unpaid/cancel)', 400);
    }

    if (!result.success) {
      return error(result.error || 'Amal bajarilmadi', 400);
    }

    return ok({ appointment: result.appointment });
  } catch (err) {
    console.error('[PATCH /api/reception/appointments/[id]/payment] error:', err);
    return error('Server xatosi', 500);
  }
}
```

### 4.2 — Shifokor muolaja endpoint

**Fayl:** `src/app/api/doctor/appointments/[id]/attendance/route.ts` (yangi)

```typescript
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, error } from "@/lib/api-response";
import { markAsArrived, markAsMissed, resetToBooked } from "@/lib/workflow/appointment-workflow";

export const dynamic = 'force-dynamic';

/**
 * PATCH /api/doctor/appointments/[id]/attendance
 *
 * Shifokor muolaja amallari.
 * Body: { action: 'arrived' | 'missed' | 'reset' }
 *
 * Ruxsat: doctor, clinic_admin, branch_admin, super_admin
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth(req);
  if (!auth) return error('Unauthorized', 401);

  const allowedRoles = ['doctor', 'clinic_admin', 'branch_admin', 'super_admin'];
  if (!allowedRoles.includes(auth.role)) {
    return error('Bu amal uchun ruxsat yo\'q', 403);
  }

  try {
    const body = await req.json();
    const action = body.action as string;

    const actorClinicId = auth.role === 'super_admin' ? null : auth.clinicId;

    let result;
    switch (action) {
      case 'arrived':
        result = await markAsArrived(params.id, actorClinicId);
        break;
      case 'missed':
        result = await markAsMissed(params.id, actorClinicId);
        break;
      case 'reset':
        result = await resetToBooked(params.id, actorClinicId);
        break;
      default:
        return error('Noto\'g\'ri amal (arrived/missed/reset)', 400);
    }

    if (!result.success) {
      return error(result.error || 'Amal bajarilmadi', 400);
    }

    return ok({ appointment: result.appointment });
  } catch (err) {
    console.error('[PATCH /api/doctor/appointments/[id]/attendance] error:', err);
    return error('Server xatosi', 500);
  }
}
```

### 4.3 — Qabulxona bron ro'yxati endpoint

**Fayl:** `src/app/api/reception/appointments/route.ts` (yangi yoki mavjudni kengaytirish)

```typescript
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, error } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
// Branch scope helper — mavjud
import { getBranchScope } from "@/lib/branch-scope";

export const dynamic = 'force-dynamic';

/**
 * GET /api/reception/appointments?date=2026-05-22
 *
 * Qabulxona uchun bronlar — 2 bo'lim:
 *   - pending: to'lov kutilayotgan
 *   - paid:    to'langan (shifokorga uzatilgan)
 *
 * Klinika va filial scope bo'yicha filtrlangan (hard code yo'q).
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return error('Unauthorized', 401);

  const allowedRoles = ['receptionist', 'clinic_admin', 'branch_admin', 'super_admin'];
  if (!allowedRoles.includes(auth.role)) {
    return error('Ruxsat yo\'q', 403);
  }

  try {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get('date');
    // Default — bugun
    const date = dateParam ? new Date(dateParam) : new Date();
    date.setHours(0, 0, 0, 0);

    // Branch scope — mavjud helper (hard code yo'q)
    // super_admin: hamma; clinic_admin: o'z klinika; branch_admin: o'z filial
    const scope = await getBranchScope(auth);

    const where: any = {
      date: date,
      status: { not: 'cancelled' },  // bekor qilinganlar ko'rinmaydi
    };

    // Klinika scope
    if (scope.clinicId) where.clinicId = scope.clinicId;
    // Filial scope (branch_admin uchun)
    if (scope.branchId) where.branchId = scope.branchId;

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        service: { select: { id: true, name: true, type: true, price: true } },
        doctor: { select: { id: true, firstName: true, lastName: true, specialty: true } },
        user: { select: { id: true, telegramId: true } },
      },
      orderBy: [
        { queueNumber: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    // 2 bo'limga ajratish
    const pending = appointments.filter(a => a.paymentStatus === 'pending');
    const paid = appointments.filter(a => 
      a.paymentStatus === 'paid' || a.paymentStatus === 'not_required'
    );

    return ok({
      date: date.toISOString().slice(0, 10),
      pending: pending.map(serializeAppointment),
      paid: paid.map(serializeAppointment),
      counts: {
        pending: pending.length,
        paid: paid.length,
        total: appointments.length,
      },
    });
  } catch (err) {
    console.error('[GET /api/reception/appointments] error:', err);
    return error('Server xatosi', 500);
  }
}

// Decimal/BigInt'ni JSON-safe qilish
function serializeAppointment(a: any) {
  return {
    id: a.id,
    patientName: a.patientName,
    patientPhone: a.patientPhone,
    queueNumber: a.queueNumber,
    status: a.status,
    paymentStatus: a.paymentStatus,
    queueMode: a.queueMode,
    date: a.date,
    address: a.address,
    notes: a.notes,
    service: a.service ? {
      id: a.service.id,
      name: a.service.name,
      type: a.service.type,
      price: a.service.price ? Number(a.service.price) : 0,
    } : null,
    doctor: a.doctor ? {
      id: a.doctor.id,
      name: [a.doctor.lastName, a.doctor.firstName].filter(Boolean).join(' '),
      specialty: a.doctor.specialty,
    } : null,
    patientTelegramId: a.user?.telegramId || null,
  };
}
```

### 4.4 — Shifokor bron ro'yxati endpoint (xizmat bo'yicha guruhlangan)

**Fayl:** `src/app/api/doctor/appointments/route.ts` (yangi yoki mavjudni kengaytirish)

```typescript
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, error } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { getBranchScope } from "@/lib/branch-scope";

export const dynamic = 'force-dynamic';

/**
 * GET /api/doctor/appointments?date=2026-05-22
 *
 * Shifokor uchun bronlar — FAQAT to'langan (paid/not_required).
 * Xizmat (service) bo'yicha guruhlangan — har xizmat alohida "orolcha".
 *
 * MUHIM: to'lanmagan (pending) bemorlar BU YERDA KO'RINMAYDI.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return error('Unauthorized', 401);

  const allowedRoles = ['doctor', 'clinic_admin', 'branch_admin', 'super_admin'];
  if (!allowedRoles.includes(auth.role)) {
    return error('Ruxsat yo\'q', 403);
  }

  try {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get('date');
    const date = dateParam ? new Date(dateParam) : new Date();
    date.setHours(0, 0, 0, 0);

    const scope = await getBranchScope(auth);

    const where: any = {
      date: date,
      // MUHIM QOIDA: faqat to'langan bemorlar shifokorda ko'rinadi
      paymentStatus: { in: ['paid', 'not_required'] },
      status: { not: 'cancelled' },
    };

    if (scope.clinicId) where.clinicId = scope.clinicId;
    if (scope.branchId) where.branchId = scope.branchId;

    // Agar foydalanuvchi DOCTOR bo'lsa — faqat o'ziga biriktirilgan xizmatlar
    // doctor.userId orqali doctorId topiladi
    if (auth.role === 'doctor') {
      const doctorRecord = await prisma.doctor.findFirst({
        where: { userId: auth.userId },
        select: { id: true },
      });
      if (doctorRecord) {
        where.doctorId = doctorRecord.id;
      } else {
        // Bu user doctor jadvalida yo'q — bo'sh natija
        return ok({ date: date.toISOString().slice(0, 10), services: [], counts: { total: 0 } });
      }
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        service: { select: { id: true, name: true, type: true } },
        doctor: { select: { id: true, firstName: true, lastName: true, specialty: true } },
      },
      orderBy: [
        { queueNumber: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    // XIZMAT BO'YICHA GURUHLASH — har xizmat alohida "orolcha"
    const serviceMap = new Map<string, any>();

    for (const a of appointments) {
      const serviceId = a.service?.id || 'unknown';
      
      if (!serviceMap.has(serviceId)) {
        serviceMap.set(serviceId, {
          serviceId: serviceId,
          serviceName: a.service?.name || 'Noma\'lum xizmat',
          serviceType: a.service?.type || null,
          // Shifokor mutaxassisligi (orolcha sarlavhasida ko'rsatiladi)
          doctorName: a.doctor 
            ? [a.doctor.lastName, a.doctor.firstName].filter(Boolean).join(' ')
            : null,
          specialty: a.doctor?.specialty || null,
          patients: [],
        });
      }

      serviceMap.get(serviceId).patients.push({
        id: a.id,
        patientName: a.patientName,
        patientPhone: a.patientPhone,
        queueNumber: a.queueNumber,
        status: a.status,
        paymentStatus: a.paymentStatus,
        notes: a.notes,
      });
    }

    // Map -> array, xizmat nomi bo'yicha saralangan
    const services = Array.from(serviceMap.values()).sort((x, y) =>
      x.serviceName.localeCompare(y.serviceName)
    );

    return ok({
      date: date.toISOString().slice(0, 10),
      services,  // har element — bitta "orolcha"
      counts: {
        total: appointments.length,
        services: services.length,
        arrived: appointments.filter(a => a.status === 'arrived').length,
        waiting: appointments.filter(a => a.status === 'booked').length,
        missed: appointments.filter(a => a.status === 'missed').length,
      },
    });
  } catch (err) {
    console.error('[GET /api/doctor/appointments] error:', err);
    return error('Server xatosi', 500);
  }
}
```

### 4.5 — Bron yaratishda paymentStatus = pending

Mavjud bron yaratish kodida (`src/lib/booking/...` yoki `/api/book`) `paymentStatus` qiymatini tekshirish:

```typescript
// Bron yaratish — appointment.create() ichida:
const appointment = await prisma.appointment.create({
  data: {
    // ... mavjud maydonlar
    
    // paymentStatus — DB default 'pending' (Bosqich 2 da o'rnatildi)
    // Agar kod explicit 'not_required' bersa — OLIB TASHLASH
    // Default ishlatilsin (pending)
    
    // ⚠️ Agar mavjud kodda paymentStatus: 'not_required' YOZILGAN bo'lsa,
    // uni OLIB TASHLANG yoki 'pending' qiling.
    // DB default avtomatik 'pending' beradi.
  },
});
```

⚠️ **MUHIM:** Diagnostika davomida tekshiring — bron yaratish kodi `paymentStatus`'ni qo'lda beradimi. Agar `'not_required'` qattiq yozilgan bo'lsa — olib tashlang yoki `'pending'` qiling.

### 4.6 — Test va Commit

```bash
npm run build

git add src/app/api/
git commit -m "feat(payment-workflow): reception + doctor API endpoints — payment, attendance, grouped lists"
```

**TEST:** Build + endpoint'lar qo'lda test (Postman yoki curl) → tasdiq → Bosqich 5.

---

## BOSQICH 5 — QABULXONA UI

### 5.1 — Maqsad

Qabulxona UI'ni qayta qurish:
- ❌ Eski "keldi/kelmadi" tugmalari — **olib tashlanadi**
- ✅ "To'ladi / To'lamadi / Bekor" tugmalari
- ✅ 2 bo'lim: 🟡 To'lov kutilmoqda · 🟢 To'langan

### 5.2 — Qabulxona sahifa

**Fayl:** Qabulxona sahifa (diagnostika davomida aniqlangan — `src/app/reception/page.tsx`)

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";

interface ReceptionAppointment {
  id: string;
  patientName: string;
  patientPhone: string;
  queueNumber: number | null;
  status: string;
  paymentStatus: string;
  queueMode: string;
  address: string | null;
  service: { id: string; name: string; type: string; price: number } | null;
  doctor: { id: string; name: string; specialty: string | null } | null;
  patientTelegramId: string | null;
}

interface ReceptionData {
  date: string;
  pending: ReceptionAppointment[];
  paid: ReceptionAppointment[];
  counts: { pending: number; paid: number; total: number };
}

export default function ReceptionPage() {
  const [data, setData] = useState<ReceptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reception/appointments?date=${date}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      }
    } catch (err) {
      console.error('Qabulxona ma\'lumot xato:', err);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // To'lov amali
  const handlePaymentAction = async (
    appointmentId: string,
    action: 'paid' | 'unpaid' | 'cancel'
  ) => {
    if (action === 'cancel') {
      if (!confirm('Bronni butunlay bekor qilishni tasdiqlaysizmi?')) return;
    }

    setActionLoading(appointmentId);
    try {
      const res = await fetch(
        `/api/reception/appointments/${appointmentId}/payment`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        }
      );
      const json = await res.json();
      if (json.success) {
        await fetchData();  // ro'yxatni yangilash
      } else {
        alert('Xato: ' + (json.error?.message || json.message));
      }
    } catch (err) {
      alert('Tarmoq xatosi');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return <div className="p-4 text-gray-400">⏳ Yuklanmoqda...</div>;
  }

  if (!data) {
    return <div className="p-4 text-gray-400">Ma'lumot topilmadi</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm px-4 py-3 sticky top-0 z-10">
        <h1 className="text-xl font-bold text-gray-900">📋 Qabulxona</h1>
        <div className="flex items-center gap-2 mt-2">
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
          />
          <span className="text-xs text-gray-500">
            Jami: {data.counts.total} ta
          </span>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* 🟡 TO'LOV KUTILMOQDA */}
        <section>
          <h2 className="text-sm font-semibold text-amber-700 mb-2 flex items-center gap-2">
            🟡 To'lov kutilmoqda
            <span className="px-2 py-0.5 bg-amber-100 rounded-full text-xs">
              {data.counts.pending}
            </span>
          </h2>

          {data.pending.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center bg-white rounded-xl">
              To'lov kutilayotgan bemor yo'q
            </p>
          ) : (
            <div className="space-y-2">
              {data.pending.map(appt => (
                <ReceptionCard
                  key={appt.id}
                  appt={appt}
                  loading={actionLoading === appt.id}
                  onPaid={() => handlePaymentAction(appt.id, 'paid')}
                  onCancel={() => handlePaymentAction(appt.id, 'cancel')}
                  section="pending"
                />
              ))}
            </div>
          )}
        </section>

        {/* 🟢 TO'LANGAN */}
        <section>
          <h2 className="text-sm font-semibold text-emerald-700 mb-2 flex items-center gap-2">
            🟢 To'langan (shifokorga uzatildi)
            <span className="px-2 py-0.5 bg-emerald-100 rounded-full text-xs">
              {data.counts.paid}
            </span>
          </h2>

          {data.paid.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center bg-white rounded-xl">
              To'langan bemor yo'q
            </p>
          ) : (
            <div className="space-y-2">
              {data.paid.map(appt => (
                <ReceptionCard
                  key={appt.id}
                  appt={appt}
                  loading={actionLoading === appt.id}
                  onUnpaid={() => handlePaymentAction(appt.id, 'unpaid')}
                  section="paid"
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ============================================================
// QABULXONA KARTOCHKASI
// ============================================================

interface CardProps {
  appt: ReceptionAppointment;
  loading: boolean;
  section: 'pending' | 'paid';
  onPaid?: () => void;
  onUnpaid?: () => void;
  onCancel?: () => void;
}

function ReceptionCard({ appt, loading, section, onPaid, onUnpaid, onCancel }: CardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {appt.queueNumber && (
              <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-semibold">
                #{appt.queueNumber}
              </span>
            )}
            <h3 className="font-medium text-gray-900 truncate">{appt.patientName}</h3>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">📞 {appt.patientPhone}</p>
          <p className="text-xs text-gray-600 mt-1">
            🏷 {appt.service?.name || '—'}
            {appt.service?.price ? ` · ${appt.service.price.toLocaleString()} so'm` : ''}
          </p>
          {appt.doctor && (
            <p className="text-xs text-gray-500">
              👨‍⚕️ {appt.doctor.name}
              {appt.doctor.specialty ? ` (${appt.doctor.specialty})` : ''}
            </p>
          )}
        </div>
      </div>

      {/* Tugmalar */}
      <div className="flex gap-2 mt-3">
        {section === 'pending' && (
          <>
            <button
              onClick={onPaid}
              disabled={loading}
              className="flex-1 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
            >
              {loading ? '...' : '💰 To\'ladi'}
            </button>
            <button
              onClick={onCancel}
              disabled={loading}
              className="px-3 py-2 bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-600 rounded-lg text-sm"
            >
              Bekor
            </button>
          </>
        )}

        {section === 'paid' && (
          <>
            <span className="flex-1 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm text-center">
              ✅ To'langan
            </span>
            <button
              onClick={onUnpaid}
              disabled={loading}
              className="px-3 py-2 bg-amber-50 hover:bg-amber-100 disabled:opacity-50 text-amber-700 rounded-lg text-sm"
            >
              {loading ? '...' : 'To\'lovni qaytarish'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
```

### 5.3 — Test va Commit

```bash
npm run build

git add src/app/reception/
git commit -m "feat(payment-workflow): reception UI — payment control (paid/unpaid/cancel), 2 sections"
```

**TEST:** Build + lokal vizual tekshirish (qabulxona sifatida login → 2 bo'lim ko'rinishi) → tasdiq → Bosqich 6.

---

## BOSQICH 6 — SHIFOKOR UI (xizmat orolchalari + chop etish)

### 6.1 — Maqsad

Shifokor UI'ni qayta qurish:
- ✅ Faqat **to'langan** bemorlar ko'rinadi (`paymentStatus = paid/not_required`)
- ✅ Xizmat bo'yicha guruhlangan **orolchalar** (har xizmat alohida card)
- ✅ Har orolcha sarlavhasida — xizmat nomi + mutaxassislik
- ✅ Har orolcha — alohida **chop etish** va **yuklab olish** (PDF)
- ✅ "Keldi / Kelmadi" tugmalari (har bemor)

### 6.2 — PDF kutubxona

Agar diagnostika davomida PDF kutubxona topilmasa, qo'shish:

```bash
npm install jspdf jspdf-autotable
```

`jspdf` — yengil, client-side PDF. `jspdf-autotable` — jadval uchun.

### 6.3 — Shifokor sahifa

**Fayl:** Shifokor sahifa (diagnostika davomida aniqlangan — `src/app/doctor/page.tsx`)

```tsx
"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface DoctorPatient {
  id: string;
  patientName: string;
  patientPhone: string;
  queueNumber: number | null;
  status: string;
  paymentStatus: string;
  notes: string | null;
}

interface ServiceIsland {
  serviceId: string;
  serviceName: string;
  serviceType: string | null;
  doctorName: string | null;
  specialty: string | null;
  patients: DoctorPatient[];
}

interface DoctorData {
  date: string;
  services: ServiceIsland[];
  counts: {
    total: number;
    services: number;
    arrived: number;
    waiting: number;
    missed: number;
  };
}

export default function DoctorPage() {
  const [data, setData] = useState<DoctorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/doctor/appointments?date=${date}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error('Shifokor ma\'lumot xato:', err);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Muolaja amali
  const handleAttendance = async (
    appointmentId: string,
    action: 'arrived' | 'missed' | 'reset'
  ) => {
    setActionLoading(appointmentId);
    try {
      const res = await fetch(
        `/api/doctor/appointments/${appointmentId}/attendance`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        }
      );
      const json = await res.json();
      if (json.success) {
        await fetchData();
      } else {
        alert('Xato: ' + (json.error?.message || json.message));
      }
    } catch (err) {
      alert('Tarmoq xatosi');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return <div className="p-4 text-gray-400">⏳ Yuklanmoqda...</div>;
  }

  if (!data) {
    return <div className="p-4 text-gray-400">Ma'lumot topilmadi</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm px-4 py-3 sticky top-0 z-10">
        <h1 className="text-xl font-bold text-gray-900">👨‍⚕️ Shifokor — Navbat</h1>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
          />
          <span className="text-xs text-gray-500">
            Jami: {data.counts.total} · Keldi: {data.counts.arrived} · 
            Kutmoqda: {data.counts.waiting} · Kelmadi: {data.counts.missed}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {data.services.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center bg-white rounded-xl">
            Bu sanada to'langan bemorlar yo'q.<br/>
            <span className="text-xs">
              (Bemorlar qabulxona to'lovni tasdiqlagandan keyin ko'rinadi)
            </span>
          </p>
        ) : (
          data.services.map(island => (
            <ServiceIslandCard
              key={island.serviceId}
              island={island}
              date={data.date}
              actionLoading={actionLoading}
              onAttendance={handleAttendance}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ============================================================
// XIZMAT OROLCHASI (har xizmat alohida card)
// ============================================================

interface IslandProps {
  island: ServiceIsland;
  date: string;
  actionLoading: string | null;
  onAttendance: (id: string, action: 'arrived' | 'missed' | 'reset') => void;
}

function ServiceIslandCard({ island, date, actionLoading, onAttendance }: IslandProps) {
  const printRef = useRef<HTMLDivElement>(null);

  // Chop etish — faqat shu orolcha
  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>${island.serviceName} — ${date}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { font-size: 18px; margin-bottom: 4px; }
            .meta { color: #666; font-size: 13px; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 13px; }
            th { background: #f5f5f5; }
          </style>
        </head>
        <body>
          <h1>${island.serviceName}</h1>
          <div class="meta">
            ${island.specialty ? island.specialty + ' · ' : ''}
            ${island.doctorName || ''} · Sana: ${date} · 
            Jami: ${island.patients.length} bemor
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th><th>Bemor</th><th>Telefon</th><th>Holat</th>
              </tr>
            </thead>
            <tbody>
              ${island.patients.map((p, i) => `
                <tr>
                  <td>${p.queueNumber || i + 1}</td>
                  <td>${p.patientName}</td>
                  <td>${p.patientPhone}</td>
                  <td>${
                    p.status === 'arrived' ? 'Keldi' :
                    p.status === 'missed' ? 'Kelmadi' : 'Kutmoqda'
                  }</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  };

  // PDF yuklab olish — jspdf
  const handleDownloadPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;

    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.text(island.serviceName, 14, 18);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    const metaLine = [
      island.specialty,
      island.doctorName,
      `Sana: ${date}`,
      `Jami: ${island.patients.length} bemor`,
    ].filter(Boolean).join(' · ');
    doc.text(metaLine, 14, 25);

    autoTable(doc, {
      startY: 30,
      head: [['#', 'Bemor', 'Telefon', 'Holat']],
      body: island.patients.map((p, i) => [
        String(p.queueNumber || i + 1),
        p.patientName,
        p.patientPhone,
        p.status === 'arrived' ? 'Keldi' :
        p.status === 'missed' ? 'Kelmadi' : 'Kutmoqda',
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [79, 70, 229] },
    });

    doc.save(`${island.serviceName}-${date}.pdf`);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Orolcha sarlavhasi */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 px-4 py-3 border-b border-gray-100">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900">{island.serviceName}</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {island.specialty && <span>{island.specialty}</span>}
              {island.doctorName && <span> · {island.doctorName}</span>}
              <span> · {island.patients.length} bemor</span>
            </p>
          </div>
          <div className="flex gap-1.5 flex-shrink-0">
            <button
              onClick={handlePrint}
              className="px-2 py-1 bg-white border border-gray-200 hover:bg-gray-50 rounded text-xs"
              title="Chop etish"
            >
              🖨 Chop
            </button>
            <button
              onClick={handleDownloadPDF}
              className="px-2 py-1 bg-white border border-gray-200 hover:bg-gray-50 rounded text-xs"
              title="PDF yuklab olish"
            >
              ⬇ PDF
            </button>
          </div>
        </div>
      </div>

      {/* Bemorlar ro'yxati */}
      <div ref={printRef} className="divide-y divide-gray-50">
        {island.patients.map((p, idx) => (
          <div key={p.id} className="px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-semibold flex-shrink-0">
                  #{p.queueNumber || idx + 1}
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{p.patientName}</p>
                  <p className="text-xs text-gray-500">📞 {p.patientPhone}</p>
                </div>
              </div>

              {/* Holat badge */}
              <StatusBadge status={p.status} />
            </div>

            {/* Keldi/Kelmadi tugmalari */}
            <div className="flex gap-2 mt-2">
              {p.status === 'booked' && (
                <>
                  <button
                    onClick={() => onAttendance(p.id, 'arrived')}
                    disabled={actionLoading === p.id}
                    className="flex-1 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
                  >
                    ✅ Keldi
                  </button>
                  <button
                    onClick={() => onAttendance(p.id, 'missed')}
                    disabled={actionLoading === p.id}
                    className="flex-1 px-3 py-1.5 bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-600 rounded-lg text-sm"
                  >
                    ❌ Kelmadi
                  </button>
                </>
              )}
              {(p.status === 'arrived' || p.status === 'missed') && (
                <button
                  onClick={() => onAttendance(p.id, 'reset')}
                  disabled={actionLoading === p.id}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-600 rounded-lg text-xs"
                >
                  ↩ Qaytarish
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    arrived: { label: 'Keldi', class: 'bg-emerald-100 text-emerald-700' },
    missed:  { label: 'Kelmadi', class: 'bg-red-100 text-red-700' },
    booked:  { label: 'Kutmoqda', class: 'bg-amber-100 text-amber-700' },
  }[status] || { label: status, class: 'bg-gray-100 text-gray-600' };

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${config.class}`}>
      {config.label}
    </span>
  );
}
```

### 6.4 — Test va Commit

```bash
npm run build

git add src/app/doctor/ package.json package-lock.json
git commit -m "feat(payment-workflow): doctor UI — service islands, attendance, per-island print/PDF"
```

**TEST:** Build + lokal vizual (shifokor login → faqat to'langan bemorlar, xizmat orolchalari, chop/PDF) → tasdiq → Bosqich 7.

---

## BOSQICH 7 — YAKUNIY VIZUAL TEST VA DEPLOY

### 7.1 — To'liq oqim testi (lokal)

VS Code Claude quyidagi **to'liq stsenariy**ni test qiladi:

```
TEST STSENARIY — To'liq workflow:

1. BEMOR (Telegram bot yoki webapp):
   - Yangi bron yaratish
   - Tekshirish: paymentStatus = 'pending' (DB)
   ✓ Bron yaratildi, pending holatda

2. QABULXONA (receptionist login):
   - /reception sahifaga kirish
   - "🟡 To'lov kutilmoqda" bo'limida yangi bron ko'rinadi
   - Tekshirish: shifokor UI'da bu bemor YO'Q (hali to'lanmagan)
   ✓ Bron faqat qabulxonada

3. QABULXONA "To'ladi" bosadi:
   - paymentStatus: pending -> paid (DB)
   - Bron "🟢 To'langan" bo'limiga o'tadi
   ✓ To'lov qabul qilindi

4. SHIFOKOR (doctor login):
   - /doctor sahifaga kirish
   - Endi bu bemor xizmat orolchasida ko'rinadi
   - Tekshirish: xizmat nomi + mutaxassislik sarlavhada
   ✓ To'langan bemor shifokorda paydo bo'ldi

5. SHIFOKOR "Keldi" bosadi:
   - status: booked -> arrived (DB)
   - Holat badge "Keldi" ga o'zgaradi
   ✓ Muolaja belgilandi

6. CHOP ETISH / PDF:
   - Xizmat orolchasida "🖨 Chop" bosish — print oynasi
   - "⬇ PDF" bosish — PDF yuklab olinadi
   ✓ Har orolcha alohida chop/yuklab olinadi

7. EDGE CASE — To'lanmagan bemorni shifokor ko'ra olmaydi:
   - pending bemor uchun /api/doctor/appointments
   - Tekshirish: javobda u YO'Q
   ✓ To'lov qoidasi ishlaydi

8. EDGE CASE — "To'lamadi":
   - paid bo'lgan bronni "To'lovni qaytarish"
   - paymentStatus: paid -> pending
   - Shifokor UI'dan yo'qoladi
   ✓ Qaytarish ishlaydi

9. EDGE CASE — "Bekor":
   - pending bronni "Bekor"
   - status: cancelled, paymentStatus: cancelled
   - Hech qaysi ro'yxatda ko'rinmaydi
   ✓ Bekor qilish ishlaydi

10. MULTI-CLINIC — boshqa klinika izolyatsiyasi:
    - Test klinika qabulxonachisi BUYUK TABIB bronlarini ko'rmasligi
    ✓ Klinika scope ishlaydi

11. LEGACY — eski 6 ta bron:
    - arrived + not_required bronlar tegilmagan
    ✓ Backward compatibility
```

### 7.2 — Build va deploy

```bash
# Yakuniy build
npm run build
# TypeScript + Next.js build xato nol bo'lishi shart

# Hammasi yaxshi bo'lsa — deploy
git add .
git commit -m "feat(payment-workflow): two-stage reception/doctor workflow — complete"
git push
```

Vercel auto-deploy. Deploy READY bo'lгach:

### 7.3 — Production vizual test

```
PRODUCTION TEKSHIRUV (https://tibtaqvim.vercel.app):

1. receptionist login (+998902222222 / reception123)
   → /reception → 2 bo'lim ko'rinadi

2. doctor login (+998901111111 / doctor123)
   → /doctor → xizmat orolchalari ko'rinadi

3. To'liq oqim: bron → to'ladi → shifokorda paydo → keldi

4. PDF/chop etish ishlashi

5. Vercel runtime logs — error yo'qligi
```

### 7.4 — DB verifikatsiya (deploy keyin)

```sql
-- Yangi bronlar pending bilan yaratilyaptimi
SELECT "paymentStatus", COUNT(*)
FROM appointments
WHERE "createdAt" > NOW() - INTERVAL '1 hour'
GROUP BY "paymentStatus";
-- Yangi bronlar: pending

-- CHECK constraint ishlayotganini tekshirish
-- (noto'g'ri qiymat kiritib ko'rish — xato berishi kerak)

-- Legacy tegilmagan
SELECT COUNT(*) FROM appointments
WHERE status='arrived' AND "paymentStatus"='not_required';
-- 6 (o'zgarmagan)
```

---

## ⚠️ XATO EHTIMOLI VA OLDINI OLISH

### Xato 1 — Eski bronlar `not_required` shifokorda ko'rinmaydi
**Sabab:** Shifokor query `paymentStatus IN ('paid', 'not_required')` — `not_required` ham kiritilgan.
**Holat:** ✅ To'g'ri — eski legacy bronlar ko'rinaveradi. Yangi pending bronlar ko'rinmaydi.

### Xato 2 — Diagnostika xizmati (doctorId NULL) qaysi orolchaga tushadi
**Sabab:** Qon tahlili kabi xizmatlar `doctorId` NULL.
**Yechim:** Shifokor query'da `auth.role === 'doctor'` bo'lsa `doctorId` filter. Diagnostika xizmatlari `doctorId` NULL — doctor ularni ko'rmaydi. clinic_admin/super_admin hammasini ko'radi. Orolcha sarlavhasida `doctorName` NULL bo'lsa faqat xizmat nomi ko'rsatiladi.

### Xato 3 — Bron yaratish kodida `not_required` qattiq yozilgan
**Sabab:** Eski kod `paymentStatus: 'not_required'` beradi.
**Yechim:** Bosqich 4.5 — diagnostika davomida topib, olib tashlash yoki `pending` qilish.

### Xato 4 — CHECK constraint eski ma'lumotni rad qiladi
**Sabab:** Migration paytida mavjud qiymatlar constraint'ga zid bo'lishi.
**Yechim:** Mavjud qiymatlar (`not_required`, `pending`, `paid`, `cancelled`) — hammasi constraint ichida. Muammo yo'q. Lekin migration'dan oldin tekshirish:
```sql
SELECT DISTINCT "paymentStatus" FROM appointments;
```

### Xato 5 — branch_admin boshqa filial bronini ko'rishi
**Sabab:** `getBranchScope` noto'g'ri ishlatilsa.
**Yechim:** Mavjud `branch-scope.ts` helper ishlatiladi — qabulxona va shifokor query'da `scope.branchId` qo'llanadi.

### Xato 6 — jspdf SSR'da xato (window undefined)
**Sabab:** `jspdf` faqat browser'da ishlaydi.
**Yechim:** Dynamic import — `await import('jspdf')` faqat tugma bosilganda (client-side). Yuqorida shunday yozilgan.

### Xato 7 — Qabulxona "To'ladi" bosgach shifokorda darrov ko'rinmaydi
**Sabab:** Shifokor sahifa cache.
**Yechim:** Shifokor `fetch` da `cache: 'no-store'`. Foydalanuvchi sahifani yangilashi yoki sana qayta tanlashi kerak. Kelajakda — real-time (polling yoki websocket), hozir scope tashqarisida.

### Xato 8 — markAsArrived to'lanmagan bemorga ishlaydi
**Sabab:** Validatsiya yo'q bo'lsa.
**Yechim:** `markAsArrived` ichida tekshiruv bor — `paymentStatus !== 'paid' && !== 'not_required'` bo'lsa xato. Shifokor UI'da to'lanmagan bemor umuman ko'rinmaydi, lekin API darajada ham himoya.

### Xato 9 — queueNumber NULL diagnostika bronlarda
**Sabab:** Diagnostika xizmatlari navbat raqamisiz.
**Yechim:** UI'da `queueNumber || (idx + 1)` — NULL bo'lsa indeks ishlatiladi.

### Xato 10 — Kelajakdagi Payme webhook integratsiya
**Sabab:** Hozir webhook yo'q.
**Yechim:** `markAsPaid(id, clinicId, 'payme')` — funksiya tayyor. Kelajakda webhook endpoint shu funksiyani chaqiradi. **Hozir kod zamin sifatida tayyor.**

---

## 📋 BAJARISH TARTIBI (xulosa)

| Bosqich | Mazmun | Test |
|---|---|---|
| 1 | Diagnostika | Hisobot |
| 2 | DB — paymentStatus CHECK + default pending | Build + SQL verifikatsiya |
| 3 | Markaziy workflow funksiyalar | Build |
| 4 | Backend API (reception + doctor) | Build + endpoint test |
| 5 | Qabulxona UI (2 bo'lim) | Build + vizual |
| 6 | Shifokor UI (orolchalar + PDF) | Build + vizual |
| 7 | Yakuniy vizual test + deploy | To'liq oqim + production |

**Har bosqichdan keyin foydalanuvchidan tasdiq olinadi.**

---

## 🎯 YAKUNIY MAQSAD

✅ **Qabulxona UI** — "To'ladi / To'lamadi / Bekor" (to'lov nazorati)  
✅ **Shifokor UI** — "Keldi / Kelmadi" (muolaja nazorati)  
✅ Takror tugmalar yo'q — har xodimning o'z mas'uliyati  
✅ Qabulxona "To'ladi" → bemor shifokorda paydo bo'ladi  
✅ To'lanmagan bemor shifokorda **umuman ko'rinmaydi**  
✅ Qabulxona — 2 bo'lim (🟡 To'lov kutilmoqda · 🟢 To'langan)  
✅ Shifokor — xizmat bo'yicha **orolchalar** (mutaxassislik nomi bilan)  
✅ Har orolcha — alohida **chop etish** va **PDF yuklab olish**  
✅ Markaziy `markAsPaid` — kelajak Payme/Click webhook uchun **zamin**  
✅ DB CHECK constraint — `paymentStatus` qat'iy  
✅ Yangi bron default — `pending`  
✅ Multi-clinic — `branch-scope.ts` orqali, **hard code yo'q**  
✅ Legacy 6 ta bron + eski 43 ta — **tegilmaydi**  
✅ Har bosqich test + yakunda vizual test + deploy  

---

**Sifat birinchi, tezlik ikkinchi. Backward compatibility — majburiy. Hard code — yo'q.**
