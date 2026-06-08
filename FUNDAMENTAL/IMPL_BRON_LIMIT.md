# BRON LIMIT TIZIMI — TO'LIQ AMALGA OSHIRISH MA'LUMOTNOMASI

> **Maqsad:** GitHub'ga ulana olmagan Claude uchun. Bu fayl loyihaning haqiqiy holati + biznes qoidalar + to'liq texnik spetsifikatsiyani bir joyda jamlaydi.
> **Sana:** 2026-05-31

---

## 0. LOYIHA TEXNIK STACK (tezkor eslatma)

| Qatlam | Texnologiya |
|---|---|
| Frontend | Next.js 14 App Router + TypeScript + Tailwind |
| ORM | Prisma 6.x |
| DB | PostgreSQL (Supabase) |
| Bot | node-telegram-bot-api 0.67.x |
| Auth | JWT + bcryptjs |
| Deploy | Vercel (webhook mode) |

**Muhim fayllar:**
- `prisma/schema.prisma` — DB sxemasi
- `src/lib/services/booking.service.ts` — bron mantiq (asosiy)
- `src/lib/validators/booking.ts` — `BookingInput` interface
- `src/lib/workflow/appointment-workflow.ts` — status o'zgartirish
- `src/app/api/book/route.ts` — `POST /api/book` endpoint
- `src/lib/telegram/relay.ts` — Telegram xabar yuborish util
- `vercel.json` — Cron konfiguratsiya

---

## 1. BIZNES QOIDALAR (yakuniy, o'zgarmas)

### 1.1 — 3 ta admin sozlama (`ClinicSettings` ga qo'shiladi)

| Sozlama | Diapazon | Default | Ma'no |
|---|---|---|---|
| `patientSelfLimit` | **1–10** | 4 | Bemor O'ZI uchun bir vaqtda nechta turli shifokorga faol bron |
| `dependentBookingLimit` | **0–5** | 1 | HAR BIR qaramog'idagi uchun alohida limit |
| `maxDependents` | **0–5** | 2 | Bemorning profiliga qo'sha oladigan qaramog'idagilar soni |

- `patientSelfLimit` min = **1** (0 bo'lsa bemor umuman bron qila olmaydi)
- Qolgan ikkisi min = **0** (0 = funksiya o'chiq)
- **Har klinika mustaqil** — A-klinika B-klinikaga ta'sir qilmaydi

### 1.2 — "Faol bron" ta'rifi

Limitga **FAQAT** `booked` (DB'dagi nom) holatidagi bronlar sanaladi.

> ⚠️ MUHIM TERMIN FARQI:
> - DIAGNOZ.md `pending` deydi → DB'da `booked` deb saqlanadi
> - DIAGNOZ.md `no_show` deydi → DB'da `missed` deb saqlanadi
> - Bu bir xil narsa, faqat nomlash farqi

Limitga KIRMAYDI:
- `arrived` (keldi)
- `missed` (kelmadi — DIAGNOZ'da `no_show`)
- `cancelled` (bekor qilingan)
- `expired` (muddati o'tgan) — hozir DB'da YO'Q, qo'shiladi

### 1.3 — Qaramog'idagilar limiti — har shaxs ALOHIDA

`dependentBookingLimit = 1` → har qaramog'idagi **mustaqil** 1 ta faol bron.
- 3 ta qaramog'idagi + limit 1 = jami 3 ta qaramog'idagi bronlari (har biri o'z limitida)
- Bitta qaramog'idagining broni bo'shaganda, FAQAT o'sha qaramog'idagi yangi bron qila oladi

### 1.4 — Bron bo'shatuvchi 4 holat

1. Shifokor "Keldi" → `arrived`
2. Shifokor "Kelmadi" → `missed`
3. Bemor bekor qiladi → `cancelled`
4. Kecha 00:00 da avtomatik → `expired`

### 1.5 — Avtomatik expiry qoidasi

- Bron sanasi `< bugun` VA holati `booked` → `expired` bo'ladi
- **Qachon:** Toshkent vaqti 00:00 da (UTC 19:00 = cron `"0 19 * * *"`)
- Bugungi bronlar TEGILMAYDI
- `expired` = limitdan bo'shaydi

### 1.6 — Kunlik + shifokor qoidasi

- Bir kunda bir shifokorga bitta bron (bir shaxs uchun)
- Bemor O'ZI + farzandini bir shifokorga bir kunga yozdira oladi (ikki shaxs = ruxsat)

### 1.7 — Limit doirasi

- Faqat o'sha klinikadagi shifokorlarga taalluqli
- A-klinika bronlari B-klinikaga ta'sir qilmaydi

### 1.8 — Qaramog'idagini o'chirish

Bemor qaramog'idagini o'chirsa → o'sha qaramog'idagining barcha `booked` bronlari `cancelled` bo'ladi.

### 1.9 — Limitni kamaytirish

Mavjud faol bronlar TEGILMAYDI, yangi bron qilish bloklanadi.

---

## 2. DB HOZIRGI HOLATI — DIAGNOZ NATIJALARI

### 2.1 `AppointmentStatus` enum (hozir)

```prisma
enum AppointmentStatus {
  booked      // DIAGNOZ'da "pending" — faol/kutilmoqda
  arrived     // keldi
  missed      // DIAGNOZ'da "no_show" — kelmadi
  cancelled   // bekor qilingan
  // ❌ expired — YO'Q, qo'shilishi KERAK
}
```

### 2.2 `Appointment` modeli (hozir)

```prisma
model Appointment {
  id          String            @id @default(cuid())
  clinicId    String
  branchId    String?
  serviceId   String
  doctorId    String?
  userId      String?
  slotId      String?
  staffId     String?
  patientName  String
  patientPhone String
  address      String?
  queueNumber  Int?
  date         DateTime          @db.Date
  status       AppointmentStatus @default(booked)
  notes        String?
  queueMode    QueueMode         @default(online)
  paymentStatus String           @default("pending")  // text, not enum
  // ... live location fields ...
  // ❌ dependentId — YO'Q, qo'shilishi KERAK
}
```

**Status ↔ paymentStatus AJRATISH (muhim):**
- `status` = `AppointmentStatus` enum (`booked/arrived/missed/cancelled`)
- `paymentStatus` = oddiy text string (`pending/paid/not_required/cancelled`)
- Bu IKKI ALOHIDA ustun. Limit FAQAT `status`ga qarab ishlaydi.

### 2.3 `Dependent` modeli (MAVJUD ✅)

```prisma
model Dependent {
  id        String    @id @default(cuid())
  userId    String                // egasi (bemor)
  firstName String
  lastName  String?
  phone     String?
  relation  String?               // "farzand", "ota", "ona"...
  birthYear Int?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?             // soft delete

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([userId, deletedAt])
  @@map("dependents")
}
```

**Muhim:** `User.dependents Dependent[]` relation bor.
**Yetishmaydi:** `Appointment.dependentId Int?` ustun YO'Q — qo'shilishi KERAK.

### 2.4 `ClinicSettings` modeli (MAVJUD ✅, lekin yangi ustunlar yo'q)

```prisma
model ClinicSettings {
  id                String   @id @default(cuid())
  clinicId          String   @unique
  dailyLimit        Int      @default(40)
  timezone          String   @default("Asia/Tashkent")
  bookingWindowDays Int      @default(7)
  allowSameDay      Boolean  @default(true)
  enableQueue       Boolean  @default(true)
  enableSlots       Boolean  @default(true)
  enableHomeService Boolean  @default(false)
  enableWebapp      Boolean  @default(true)
  enableBot         Boolean  @default(true)
  is24Hours         Boolean  @default(false)
  holidays          Json     @default("[]") @db.JsonB
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  // ❌ patientSelfLimit     — YO'Q
  // ❌ dependentBookingLimit — YO'Q
  // ❌ maxDependents        — YO'Q
}
```

### 2.5 `BookingInput` (MAVJUD ✅, `dependentId` ALLAQACHON BOR)

```typescript
// src/lib/validators/booking.ts
export interface BookingInput {
  clinicId: string;
  branchId?: string;
  serviceId: string;
  doctorId?: string;
  slotId?: string;
  date: string;           // "YYYY-MM-DD"
  patientName: string;
  patientPhone: string;
  address?: string;
  source?: "bot" | "webapp";
  userId?: string;
  dependentId?: string;  // ✅ ALLAQACHON BOR
}
```

`processBooking()` allaqachon `dependentId` dan ism/telefon smart-fill qiladi. Lekin `appointment.dependentId` DB'ga saqlanmaydi (ustun yo'q).

### 2.6 Cron holati (hozir)

`vercel.json`:
```json
{
  "crons": [
    { "path": "/api/reminders?type=day_before", "schedule": "0 3 * * *" },
    { "path": "/api/cron/ad-broadcast",         "schedule": "0 8 * * *" }
  ]
}
```

- 2 ta cron allaqachon bor
- `/api/cron/expire-bookings` — YO'Q, qo'shilishi KERAK
- ⚠️ **Vercel Hobby plan cheklovi:** Hobby = kuniga 2 ta cron. Allaqachon 2 ta bor.
  - **Yechim A:** expire-bookings + reminders bitta cronni baham ko'radi
  - **Yechim B:** vercel.json'da 3-cronni sinab ko'r (Pro plan bo'lishi mumkin)
  - **Yechim C:** Supabase pg_cron (DB darajasida scheduled job)
  - **Tavsiya:** Avval 3-cronni qo'sh, build xatosi bo'lsa — Supabase pg_cron

### 2.7 Mavjud limit tekshiruvi — HOZIR YO'Q

`bookDoctorQueue()` da hozir faqat:
1. `dailyLimit` (xizmat darajasida, `service.dailyLimit`) ✅
2. `patientPhone + serviceId + date` dublikat tekshiruvi ✅
3. `patientPhone + doctorId + date` dublikat tekshiruvi ✅

**YO'Q:** Bemor/dependent per-clinic faol bron soni limiti.

---

## 3. KERAKLI DB O'ZGARISHLARI (Migration)

Migration nomi: `add_booking_limits_and_expiry`

### 3.1 `AppointmentStatus` enum'ga `expired` qo'shish

```sql
ALTER TYPE "AppointmentStatus" ADD VALUE 'expired';
```

Prisma:
```prisma
enum AppointmentStatus {
  booked
  arrived
  missed
  cancelled
  expired   // ← YANGI
}
```

### 3.2 `Appointment` ga `dependentId` qo'shish

```sql
ALTER TABLE "appointments" ADD COLUMN "dependentId" TEXT;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_dependentId_fkey"
  FOREIGN KEY ("dependentId") REFERENCES "dependents"("id") ON DELETE SET NULL;
CREATE INDEX "appointments_dependentId_idx" ON "appointments"("dependentId");
```

Prisma:
```prisma
model Appointment {
  // ... mavjud maydonlar ...
  dependentId  String?   // ← YANGI, null = bemor o'zi, qiymat = qaramog'idagi ID
  dependent    Dependent? @relation(fields: [dependentId], references: [id], onDelete: SetNull)
  // ...
}
```

**Va `Dependent` modeliga teskari relation:**
```prisma
model Dependent {
  // ...
  appointments Appointment[]  // ← YANGI
}
```

### 3.3 `ClinicSettings` ga 3 limit ustun qo'shish

```sql
ALTER TABLE "clinic_settings"
  ADD COLUMN "patientSelfLimit"      INTEGER NOT NULL DEFAULT 4,
  ADD COLUMN "dependentBookingLimit" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "maxDependents"         INTEGER NOT NULL DEFAULT 2;
```

Prisma:
```prisma
model ClinicSettings {
  // ... mavjud maydonlar ...
  patientSelfLimit      Int   @default(4)   // 1..10
  dependentBookingLimit Int   @default(1)   // 0..5
  maxDependents         Int   @default(2)   // 0..5
}
```

### 3.4 Tezlashtirish indekslari

```sql
-- Limit count uchun
CREATE INDEX "appointments_patient_clinic_status_idx"
  ON "appointments"("userId", "clinicId", "status");

-- Dependent limit uchun
CREATE INDEX "appointments_dependent_clinic_status_idx"
  ON "appointments"("dependentId", "clinicId", "status");

-- Cron expire uchun
CREATE INDEX "appointments_date_status_idx"
  ON "appointments"("date", "status")
  WHERE "status" = 'booked';
```

---

## 4. KOD O'ZGARISHLARI — TO'LIQ SPETSIFIKATSIYA

### 4.1 Bron yaratish API — limit tekshiruvi

**Fayl:** `src/lib/services/booking.service.ts`

`processBooking()` funksiyasiga, service va blockCheck dan KEYIN, switch/case DAN OLDIN quyidagi blok qo'shiladi:

```typescript
// ── Bemor/Dependent limit tekshiruvi ──────────────────────────────────────
if (input.userId) {
  // 1. Klinika sozlamalarini ol
  const settings = await prisma.clinicSettings.findUnique({
    where: { clinicId: input.clinicId },
    select: { patientSelfLimit: true, dependentBookingLimit: true, maxDependents: true },
  });
  const selfLimit = settings?.patientSelfLimit ?? 4;
  const depLimit = settings?.dependentBookingLimit ?? 1;

  if (input.dependentId) {
    // 2a. Qaramog'idagi uchun: o'SHA dependent'ning faol bronlari
    if (depLimit === 0) {
      return bookingError("DEPENDENT_BOOKING_DISABLED",
        "Qaramog'idagilar uchun bron qilish o'chirilgan", 403);
    }
    const depCount = await prisma.appointment.count({
      where: {
        dependentId: input.dependentId,
        clinicId: input.clinicId,
        status: "booked",
      },
    });
    if (depCount >= depLimit) {
      return bookingError("DEPENDENT_LIMIT_REACHED",
        `Qaramog'idagi uchun faol bronlar limiti to'ldi (${depCount}/${depLimit})`, 409);
    }
  } else {
    // 2b. Bemor o'zi uchun: o'SHA bemorning (dependentId=null) faol bronlari
    const selfCount = await prisma.appointment.count({
      where: {
        userId: input.userId,
        dependentId: null,
        clinicId: input.clinicId,
        status: "booked",
      },
    });
    if (selfCount >= selfLimit) {
      return bookingError("PATIENT_LIMIT_REACHED",
        `Faol bronlar limiti to'ldi (${selfCount}/${selfLimit}). Avval biron bronni bekor qiling yoki kuting.`, 409);
    }
  }

  // 3. Bir shifokorga faqat bitta faol bron (butun kalendar, sana'ga qaramay)
  if (input.doctorId) {
    const subjectId = input.dependentId ?? null;
    const existingForDoctor = await prisma.appointment.findFirst({
      where: {
        userId: input.userId,
        dependentId: subjectId,
        clinicId: input.clinicId,
        doctorId: input.doctorId,
        status: "booked",
      },
      select: { id: true, date: true },
    });
    if (existingForDoctor) {
      return bookingError("DOCTOR_ALREADY_BOOKED",
        `Bu shifokorga allaqachon faol bron mavjud. Avval uni bekor qiling yoki kutib turing.`, 409);
    }
  }
}
```

**`bookDoctorQueue()` va `bookDiagnostic()` ichida:** `tx.appointment.create` da `dependentId: input.dependentId ?? null` qo'shiladi.

### 4.2 `expired` enum qo'shilgandan keyin workflow

**Fayl:** `src/lib/workflow/appointment-workflow.ts`

Type eksportini yangilash:
```typescript
export type AppointmentStatus = "booked" | "arrived" | "missed" | "cancelled" | "expired";
```

Yangi funksiya qo'shish:
```typescript
export async function expireBookings(
  beforeDate: string  // "YYYY-MM-DD" — bu sanadan OLDINGI kunlardagi bronlar
): Promise<{ expired: number; errors: number }> {
  // beforeDate = bugungi sana (Asia/Tashkent bo'yicha)
  const cutoff = new Date(beforeDate + "T00:00:00.000Z");

  const result = await prisma.appointment.updateMany({
    where: {
      status: "booked",
      date: { lt: cutoff },
    },
    data: { status: "expired" },
  });

  return { expired: result.count, errors: 0 };
}
```

### 4.3 Cron route — expire-bookings

**Yangi fayl:** `src/app/api/cron/expire-bookings/route.ts`

```typescript
import { NextRequest } from "next/server";
import { ok, error, unauthorized } from "@/lib/api-response";
import { expireBookings } from "@/lib/workflow/appointment-workflow";
import { logger } from "@/lib/logger";

const TZ = process.env.CLINIC_TIMEZONE || "Asia/Tashkent";

function isCronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
  if (req.headers.get("x-cron-secret") === secret) return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) return unauthorized();

  try {
    // Toshkent vaqtida bugungi sanani ol
    const todayStr = new Date().toLocaleDateString("sv-SE", { timeZone: TZ });
    // todayStr = "2026-06-01" formatida

    const result = await expireBookings(todayStr);

    logger.info("[cron/expire-bookings] done", result);

    // TODO: expired bo'lganlarga Telegram xabar (4.4 blok)

    return ok({ ...result, date: todayStr });
  } catch (err) {
    logger.error("[cron/expire-bookings] error", { error: String(err) });
    return error("Server xatosi", 500);
  }
}
```

**`vercel.json` ga qo'shish:**
```json
{
  "crons": [
    { "path": "/api/reminders?type=day_before", "schedule": "0 3 * * *" },
    { "path": "/api/cron/ad-broadcast",         "schedule": "0 8 * * *" },
    { "path": "/api/cron/expire-bookings",       "schedule": "0 19 * * *" }
  ]
}
```

> `0 19 * * *` = UTC 19:00 = Asia/Tashkent 00:00.

⚠️ **Vercel plan tekshiruvi:** Agar Hobby plan bo'lsa 3 ta cron ishlamaydi. Unda `0 19 * * *` cronni reminders bilan birlashtirish yoki Supabase pg_cron ishlatish kerak.

### 4.4 Expired — Telegram xabarnoma

`expire-bookings/route.ts` ichida, `expireBookings()` dan keyin:

```typescript
// Expired bo'lgan bronlarni topib bemorga xabar yubor
async function notifyExpiredBookings(beforeDate: string) {
  const cutoff = new Date(beforeDate + "T00:00:00.000Z");

  const expiredAppts = await prisma.appointment.findMany({
    where: {
      status: "expired",
      date: { lt: cutoff, gte: new Date(new Date(cutoff).setDate(cutoff.getDate() - 1)) },
      // Faqat bugun expired bo'lganlar (kechagi kunda)
    },
    include: {
      service: { select: { name: true } },
      doctor: { select: { firstName: true, lastName: true } },
      user: { select: { telegramId: true } },
    },
  });

  for (const appt of expiredAppts) {
    if (!appt.user?.telegramId) continue;
    const doctorName = appt.doctor
      ? `${appt.doctor.firstName} ${appt.doctor.lastName}`
      : "shifokor";
    const dateStr = appt.date.toLocaleDateString("uz-UZ", {
      timeZone: TZ, day: "numeric", month: "long", year: "numeric"
    });
    const msg = `⏰ Broningiz muddati o'tdi\n\n` +
      `📋 Xizmat: ${appt.service?.name ?? "—"}\n` +
      `👨‍⚕️ Shifokor: ${doctorName}\n` +
      `📅 Sana: ${dateStr}\n\n` +
      `Bu bron avtomatik bekor qilindi. Qayta bron qilishingiz mumkin.`;

    try {
      await sendTelegramConfirmation(appt.user.telegramId, msg);
    } catch {}
  }
}
```

`sendTelegramConfirmation` import: `src/lib/services/confirmation.service.ts` dan.

### 4.5 Admin settings UI — 3 limit sozlama

**Yangi fayl:** `src/app/admin/(panel)/settings/page.tsx` (yoki mavjud settings sahifasiga qo'shish)

Agar `/admin/(panel)/settings/page.tsx` yo'q bo'lsa — yangi yaratiladi.

```typescript
// PUT /api/admin/clinic-settings
// Body: { patientSelfLimit: number, dependentBookingLimit: number, maxDependents: number }
```

**Yangi API fayl:** `src/app/api/admin/clinic-settings/route.ts`

```typescript
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, error, unauthorized, forbidden } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth) return unauthorized();
  if (!["clinic_admin", "branch_admin", "super_admin"].includes(auth.role)) return forbidden();

  const settings = await prisma.clinicSettings.findUnique({
    where: { clinicId: auth.clinicId! },
    select: {
      patientSelfLimit: true,
      dependentBookingLimit: true,
      maxDependents: true,
      // + mavjud boshqa maydonlar kerak bo'lsa
    },
  });
  return ok(settings);
}

export async function PUT(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth) return unauthorized();
  if (!["clinic_admin", "super_admin"].includes(auth.role)) return forbidden();

  const body = await req.json();
  const { patientSelfLimit, dependentBookingLimit, maxDependents } = body;

  // Validatsiya
  if (typeof patientSelfLimit !== "number" || patientSelfLimit < 1 || patientSelfLimit > 10)
    return error("patientSelfLimit 1 dan 10 gacha bo'lishi kerak", 400);
  if (typeof dependentBookingLimit !== "number" || dependentBookingLimit < 0 || dependentBookingLimit > 5)
    return error("dependentBookingLimit 0 dan 5 gacha bo'lishi kerak", 400);
  if (typeof maxDependents !== "number" || maxDependents < 0 || maxDependents > 5)
    return error("maxDependents 0 dan 5 gacha bo'lishi kerak", 400);

  const updated = await prisma.clinicSettings.upsert({
    where: { clinicId: auth.clinicId! },
    update: { patientSelfLimit, dependentBookingLimit, maxDependents },
    create: {
      clinicId: auth.clinicId!,
      patientSelfLimit,
      dependentBookingLimit,
      maxDependents,
    },
  });
  return ok(updated);
}
```

**Har sozlama yonidagi izoh matni (o'zbek tilida, sodda):**

```
patientSelfLimit:
"Bemor bir vaqtning o'zida nechta turli shifokorga navbat olishi mumkin.
Masalan 4 desangiz, bemor 4 xil shifokorga navbat oladi; 5-shifokorga olish uchun avval
bittasiga borib kelishi yoki bekor qilishi kerak. Minimum 1."

dependentBookingLimit:
"Har bir oila a'zosi (farzand, ota-ona) uchun bir vaqtda nechta navbat olish mumkin.
0 qo'ysangiz, oila a'zolari uchun navbat olish o'chadi. 1 qo'ysangiz, har bir a'zo
bitta navbat oladi va uni bo'shatmaguncha yangi navbat qilolmaydi."

maxDependents:
"Bemor profiliga nechta oila a'zosi qo'sha olishi mumkin (farzand, ota, ona, boshqalar).
0 qo'ysangiz, oila a'zosi qo'shish o'chadi. 2 qo'ysangiz, jami 2 ta a'zo qo'shiladi."
```

### 4.6 Bemor webapp — faol bron sanagich

**Fayl:** `src/app/webapp/page.tsx`

`/api/webapp/appointments` dan kelgan ma'lumotga asosan:

```typescript
// Faol bronlar soni (status="booked" VA dependentId=null)
const selfActiveCount = appointments.filter(
  (a: any) => a.status === "booked" && !a.dependentId
).length;

// "Faol bronlaringiz: 3/4" ko'rsatish
```

### 4.7 Dependent o'chirilganda bronlar cancel

**Fayl:** `src/app/api/webapp/dependents/[id]/route.ts` (mavjud bo'lsa) yoki yangi DELETE handler

```typescript
// Dependent o'chirishda:
await prisma.$transaction([
  // 1. Dependent'ni soft-delete qil
  prisma.dependent.update({
    where: { id: dependentId, userId: auth.userId },
    data: { deletedAt: new Date() },
  }),
  // 2. O'sha dependent'ning barcha faol bronlarini cancel qil
  prisma.appointment.updateMany({
    where: {
      dependentId: dependentId,
      status: "booked",
    },
    data: { status: "cancelled" },
  }),
]);
```

---

## 5. STATUS RANGLARI — UI SPETSIFIKATSIYA

Bemor webapp va admin panelda status vizual farqlanishi:

| Status (DB) | Rang | Ko'rinish | Izoh |
|---|---|---|---|
| `booked` | Yashil / ko'k | To'liq ko'rinish, badge | Faol, kutilmoqda |
| `arrived` | Ko'k-kulrang | ✓ belgisi | Keldi, muolaja bo'ldi |
| `missed` | Qizg'ish | Shaffofroq | Kelmadi |
| `cancelled` | Kulrang | Strikethrough matni | Bekor qilingan |
| `expired` | Och sariq/kulrang | "Muddati o'tdi" yorlig'i | Avtomatik bekor |

Tailwind class tavsiyasi:
```
booked    → bg-green-50 border-green-200 text-green-800
arrived   → bg-blue-50 border-blue-200 text-blue-700
missed    → bg-red-50 border-red-200 text-red-700 opacity-75
cancelled → bg-gray-50 border-gray-200 text-gray-500 line-through
expired   → bg-yellow-50 border-yellow-200 text-yellow-700
```

---

## 6. ERROR KODLAR (yangi, mavjudlarga qo'shimcha)

Loyihada mavjud: `LIMIT_REACHED, DUPLICATE_BOOKING, SLOT_REQUIRED, SLOT_INVALID, SLOT_FULL, ADDRESS_REQUIRED, SERVICE_NOT_FOUND, SERVER_ERROR, UNAUTHORIZED, FORBIDDEN, NOT_FOUND`

Yangi qo'shiladigan kodlar:
```typescript
"PATIENT_LIMIT_REACHED"      // Bemor o'zi faol bron limiti to'ldi
"DEPENDENT_LIMIT_REACHED"    // Qaramog'idagi faol bron limiti to'ldi
"DEPENDENT_BOOKING_DISABLED" // dependentBookingLimit = 0 (o'chirilgan)
"DEPENDENT_NOT_FOUND"        // dependentId noto'g'ri (allaqachon bor!)
"DOCTOR_ALREADY_BOOKED"      // O'sha shifokorga faol bron mavjud
```

---

## 7. AMALGA OSHIRISH TARTIBI

```
Bosqich 1: DB migration (Prisma + Supabase MCP)
  - AppointmentStatus enum'ga 'expired' qo'sh
  - appointments.dependentId ustun + FK + index
  - clinic_settings 3 yangi ustun + indexlar
  - prisma generate

Bosqich 2: Workflow kengaytirish
  - appointment-workflow.ts: expireBookings() funksiyasi
  - AppointmentStatus type'ga 'expired' qo'sh

Bosqich 3: Bron yaratish limit tekshiruvi
  - booking.service.ts: processBooking() ichiga limit blok
  - bookDoctorQueue() va bookDiagnostic() da dependentId saqlash

Bosqich 4: Cron expire-bookings
  - src/app/api/cron/expire-bookings/route.ts — yangi fayl
  - vercel.json — 3-cron (yoki Supabase pg_cron)
  - Telegram expired xabarnoma

Bosqich 5: Admin settings
  - src/app/api/admin/clinic-settings/route.ts — yangi fayl
  - Admin settings UI sahifasi (izohlar bilan)

Bosqich 6: Bemor webapp UI
  - Status ranglari (BookingFlipCard.tsx)
  - Faol bron sanagich

Bosqich 7: Dependent o'chirish → cancel
  - Dependent DELETE handler

Bosqich 8: Test + build
  - tsc --noEmit
  - npm run build
  - Manual QISM E testlari
```

---

## 8. RISKLAR VA EHTIYOTKORLIK CHORALARI

| # | Risk | Muhimlik | Yechim |
|---|---|---|---|
| R1 | **Status termin farqi** | Yuqori | DIAGNOZ `pending`=DB `booked`, `no_show`=`missed`. Kod yozganda DB nomini ishlatish SHART |
| R2 | **`dependentId` yo'qligi** | Yuqori | Allaqachon BookingInput'da bor, faqat Appointment ustun yo'q — migration shart |
| R3 | **Vercel 3-chi cron** | O'rta | Tekshir. Muammo bo'lsa: Supabase pg_cron, yoki reminders bilan birlashtirish |
| R4 | **TZ xatosi** | O'rta | `toLocaleDateString("sv-SE", { timeZone: "Asia/Tashkent" })` ishlatish shart |
| R5 | **Race condition** | O'rta | `prisma.$transaction()` ichida count+create allaqachon bor. Limit count ham shu transaction'da bo'lishi kerak |
| R6 | **paymentStatus ↔ status** | Yuqori | Limit FAQAT `status` (booked) ga bog'liq. `paymentStatus`'dan hech qanday limitga ta'sir qilmaydi |
| R7 | **ClinicSettings yo'q klinika** | Past | `?.patientSelfLimit ?? 4` — null-safe default bilan ishlash |
| R8 | **Telegram rate limit** | Past | Batch/throttle: bir kechada ko'p expired bo'lsa, xabarni navbatga qo'y |
| R9 | **dependent.deletedAt** | Past | Faol dependent check: `deletedAt: null` — o'chirilganlar hisoblanmaydi |

---

## 9. MUHIM MAVJUD KOD QOIDALARI (O'ZGARTIRMA)

1. **`processBooking()` asosiy oqimi** — transaction tuzilishi saqlansin
2. **`normalizePhone()`** — barcha telefon raqamlarda ishlatish shart
3. **`source: "bot"` flag** — bot orqali bronlarda notification yuborilmaydi (duplicate oldini olish)
4. **`clinicId` scope** — BARCHA so'rovlarda `clinicId` filtri shart
5. **`tibId` format** — `tib` + 6 raqam, o'zgartirish mumkin emas
6. **`withRetry()`** — DB operatsiyalarida retry pattern
7. **Mavjud status oqimi** — `arrived` va `missed` faqat `paymentStatus=paid/not_required` bo'lganda ishlaydi (tekshirildi)

---

## 10. API ENDPOINTLAR XULOSA (yangi va o'zgartirilganlar)

| Method | Yo'l | Yangi/O'zgargan | Ta'rif |
|---|---|---|---|
| `POST` | `/api/book` | O'zgartiriladi | Limit tekshiruvi qo'shiladi, `dependentId` saqlanadi |
| `GET/PUT` | `/api/admin/clinic-settings` | YANGI | 3 limit sozlama |
| `GET` | `/api/cron/expire-bookings` | YANGI | Avtomatik expiry |
| `PATCH` | `/api/doctor/appointments/[id]/attendance` | Tekshiriladi | `expired` status uchun O'ZGARMAYDI |
| `PATCH` | `/api/reception/appointments/[id]/payment` | Tekshiriladi | `expired` status uchun O'ZGARMAYDI |

---

## 11. TEST REJASI

### Bemor limit testlari:
1. `patientSelfLimit=4` → 4 ta turli shifokorga bron OK, 5-chiga `PATIENT_LIMIT_REACHED`
2. 1 ta `cancelled` → count kamaydi → yangi bron OK
3. `arrived` → bo'shadi → o'sha shifokorga qayta bron OK (farq: `DOCTOR_ALREADY_BOOKED` yo'q)
4. `missed` → bo'shadi
5. Bir kunda bir shifokorga 2-bron → `DOCTOR_DUPLICATE` (mavjud tekshiruv)
6. O'zi + qaramog'idagi farzandni bir shifokorga → ikkalasi OK (ikki shaxs)

### Qaramog'idagi limit testlari:
7. `dependentBookingLimit=1` → 1-farzand 1 ta bron OK, 2-bron `DEPENDENT_LIMIT_REACHED`
8. 1-farzand broni bekor → yangi bron OK
9. 2-farzand mustaqil: 1-farzand limitdan to'lsa ham 2-farzand bron qila oladi
10. `maxDependents=2` → 3-farzand qo'shish bloklanadi
11. Farzand o'chirilsa → uning `booked` bronlari `cancelled`

### Cron/expiry testlari:
12. Kechagi `booked` bron → expire cron → `expired`, limitdan bo'shadi
13. Bugungi `booked` → expire cron → TEGILMAYDI
14. Expired → Telegram xabar yuborildi

### Admin testlari:
15. 3 sozlamani o'zgartirib saqlash, diapazon validatsiya
16. Boshqa klinika admini mustaqil son belgilaydi
17. Har sozlama yonida izoh ko'rinadi

### Build testlari:
18. `tsc --noEmit` → 0 xato
19. `npm run build` → muvaffaqiyatli

---

## 12. ENV VA MUHIT ESLATMALARI

```
CLINIC_TIMEZONE=Asia/Tashkent   # TZ — UTC bilan adashma
CRON_SECRET=...                  # Cron endpoint himoyasi
DATABASE_URL=...?pgbouncer=true  # Supabase pgBouncer (muhim!)
DIRECT_URL=...                   # Migration uchun direct (pgBouncer'siz)
```

**Supabase Migration:** Loyihada `prisma migrate dev` ishlamaydi (shadow DB muammosi). Faqat:
1. Prisma migration SQL fayl yozing
2. **Supabase MCP** orqali `apply_migration` qiling

**Deploy jarayoni:**
1. `tsc --noEmit` — TS xatolarni tekshir
2. `npm run build` — build
3. Commit + push → Vercel avtomatik deploy QILMAYDI
4. `npx vercel --prod --yes` — MAJBURIY buyruq (git push ≠ Vercel deploy)

---

## 13. TASHXIS XULOSASI (DIAGNOZ A9 hisobot)

### 1. Bron modeli hozirgi holati:
- Status enum: `booked/arrived/missed/cancelled` — `expired` YOQY
- `dependentId` ustun: YO'Q
- Hozirgi nomlash: `booked`=DIAGNOZ'da`pending`, `missed`=DIAGNOZ'da`no_show`

### 2. Qaramog'idagi modeli:
- `Dependent` model BOR ✅
- `BookingInput.dependentId` BOR ✅
- `Appointment.dependentId` DB ustun — YO'Q, migration kerak

### 3. Cron tizimi:
- 2 ta cron ishlamoqda (reminders + ad-broadcast)
- expire-bookings cron YO'Q — yaratish kerak
- Vercel plan cheklovi: sinab ko'ring, muammo bo'lsa Supabase pg_cron

### 4. Admin settings UI:
- `ClinicSettings` modeli BOR, API (`/api/admin/super/clinics/[id]/settings`) BOR
- Lekin 3 yangi limit ustun YO'Q
- Clinic_admin uchun limit sozlama UI YO'Q — yaratish kerak

### 5. Status/payment ajratish:
- `status` = `AppointmentStatus` enum (bron hayot sikli) — LIMITga bog'liq
- `paymentStatus` = text string (to'lov holati) — LIMITga bog'liq EMAS

### 6. Asosiy to'siqlar:
- **D1 (Dependent):** Hal qilindi — model bor, faqat `Appointment.dependentId` qo'shiladi
- **D2 (TZ):** `toLocaleDateString("sv-SE", { timeZone })` ishlatiladi
- **D3 (Race condition):** Transaction ichida count+create — mavjud pattern saqlanadi
- **D4 (Vercel cron):** Sinab ko'ring, muammo bo'lsa kombinatsiya
- **D6 (Status chalkashishi):** `booked` vs `paymentStatus` — aniq ajratildi

