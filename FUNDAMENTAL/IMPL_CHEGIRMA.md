# CHEGIRMA TIZIMI — TO'LIQ IMPLEMENTATSIYA MALUMOTNOMASI

> **Maqsad:** Bu fayl GitHub'ga ulanmagan Claude uchun. Hamma kerakli kontekst, haqiqiy kod, DB holati va implementatsiya rejalari shu yerda.
> **Sana:** 2026-06-01
> **Stack:** Next.js 14 App Router + TypeScript + Tailwind, Prisma 6.x, PostgreSQL (Supabase), project_id: `lxqimithjjabhnldcugc`
> **Deploy:** `npx vercel --prod --yes` (Vercel project_id: `prj_U0d0bOMH4rj6Ao2JVeeQtGvgjKgJ`)

---

## 1. BIZNES QOIDALAR (YAKUNIY, O'ZGARMAYDI)

### 1.1 Admin sozlamasi
- `ClinicSettings.discountPercent` — `0–100` (butun son). Har klinika mustaqil.
- `0` = chegirma o'chiq → chegirma tugmasi **umuman ko'rinmaydi** (faqat "To'ladi" + "Bekor").
- `1–100` = chegirma faol.

### 1.2 Qabulxona tugmalari (discountPercent > 0 bo'lganda)
Uchta tugma, mobilda **ustma-ust (Variant B)**:
1. **"💰 To'ladi"** (yashil `bg-emerald-500`) — eng yuqorida. To'liq narx.
2. **"{qoldiq} so'm to'ladi"** (ko'k `bg-blue-500`) — o'rtada. Chegirmadan keyingi summa.
3. **"Bekor"** (qizil `bg-red-50 text-red-600`) — eng pastda.

discountPercent = 0 bo'lsa: faqat "💰 To'ladi" + "Bekor".

### 1.3 Ko'k tugma matni hisobi
```
qoldiq = service.price × (100 − discountPercent) / 100
```
**Yumalatish:** `Math.round()` — integer so'm uchun.  
Misol: narx 75000, 33% → `75000 * 67 / 100 = 50250` (toza). Narx 75001, 33% → `75001 * 67 / 100 = 50250.67` → `Math.round` → 50251.  
`paidAmount` integer (so'm).

Namunaviy hisob:
```ts
const price = appt.service.price; // float (Number(Decimal))
const paidAmount = Math.round(price * (100 - discountPercent) / 100);
// Tugma: `${paidAmount.toLocaleString("uz-UZ")} so'm to'ladi`
```

### 1.4 To'lov tugmasi bosilganda
- **"To'ladi"** bosilsa → `paidAmount = service.price`, `appliedDiscountPercent = 0`
- **"X so'm to'ladi"** bosilsa → `paidAmount = qoldiq`, `appliedDiscountPercent = joriy discountPercent`
- Ikkalasida ham `paymentStatus = 'paid'` → shifokorga yo'naltiriladi
- **Server tomonda hisoblash** (frontend yuborgan summaga ishonma) — frontend faqat `mode: "full" | "discount"` yuboradi

### 1.5 To'lovni qaytarish
- `paymentStatus = 'paid'` bo'lsa "↩ To'lovni qaytarish" tugmasi chiqadi
- **Istisnо:** `appliedDiscountPercent === 100` (yoki `paidAmount === 0`) bo'lsa — qaytarish tugmasi **YO'Q**
- Qaytarilganda: `paymentStatus = 'pending'`, `paidAmount = null`, `appliedDiscountPercent = 0` → tugmalar qayta chiqadi
- Statistikadan `paidAmount` (haqiqatan to'langan summa) ayriladi

### 1.6 Muzlatish (freeze)
- To'lov bosilganda `appliedDiscountPercent` appointmentga yoziladi
- Admin foizni keyinroq o'zgartirsa — allaqachon to'lganlar **tegilmaydi**
- Hali to'lanmaganlar tugmasi joriy discountPercent'ni ko'rsatadi

### 1.7 Bemor nima ko'radi
- Bemor webapp/Telegram'da har doim **to'liq narx** ko'radi
- Chegirma faqat klinika-ichki (xodim sahifalarida)

### 1.8 Statistika X / Y / Z
```
X = jami haqiqiy tushum = SUM(paidAmount) WHERE paymentStatus='paid'
Z = chegirmali to'lovlardan tushum = SUM(paidAmount) WHERE paymentStatus='paid' AND appliedDiscountPercent > 0
Y = chegirilgan pul = SUM(service.price − paidAmount) WHERE paymentStatus='paid' AND appliedDiscountPercent > 0
```
- Bekor/qaytarilgan bronlar `paymentStatus != 'paid'` → avtomatik hisoblanmaydi
- `X = Z + chegirmasiz to'laganlar paidAmount`
- Diagramma: alohida blok/karta, mavjud KPI'larga aralashtirilmaydi

### 1.9 Mavjud "umumiy summa" hisoblagichi
- Hozir: `SUM(service.price)` faqat `status='arrived'` bronlar
- Kerak bo'ladi: `SUM(paidAmount)` faqat `paymentStatus='paid'` bronlar (chegirma tizimi kuchga kirgandan keyin)
- X va bu hisoblagich bir xil raqamni ko'rsatishi kerak

---

## 2. HOZIRGI DB HOLATI (HAQIQIY, TEKSHIRILGAN)

### 2.1 Appointment model (`prisma/schema.prisma:432`)
```prisma
model Appointment {
  id            String            @id @default(cuid())
  clinicId      String
  branchId      String?
  serviceId     String
  doctorId      String?
  userId        String?
  slotId        String?
  staffId       String?
  patientName   String
  patientPhone  String
  address       String?
  queueNumber   Int?
  date          DateTime          @db.Date
  status        AppointmentStatus @default(booked)
  notes         String?
  // ... live location fields ...
  queueMode     QueueMode         @default(online)
  paymentStatus String            @default("pending")
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt
  dependentId   String?
  // relations: clinic, branch, service, doctor, user, slot, assignedStaff, dependent, payments, relayLogs
  @@map("appointments")
}
```

**MUHIM:**
- `paymentStatus` — text string (`pending` | `paid` | `not_required` | `cancelled`)
- `price` ustuni **YO'Q** — narx `service.price` dan olinadi
- `paidAmount` **YO'Q** — qo'shish kerak
- `appliedDiscountPercent` **YO'Q** — qo'shish kerak

### 2.2 Service model (`prisma/schema.prisma:188`)
```prisma
model Service {
  id          String      @id @default(cuid())
  clinicId    String
  branchId    String?
  name        String
  type        ServiceType
  price       Decimal     @db.Decimal(10, 2)   // ← DECIMAL, kasr bo'lishi mumkin
  // ...
  @@map("services")
}
```

`price` = `Decimal(10,2)`. API serialize'da `Number(a.service.price)` qilinadi → JavaScript `number` (float).

### 2.3 ClinicSettings model (`prisma/schema.prisma:514`)
```prisma
model ClinicSettings {
  id                    String   @id @default(cuid())
  clinicId              String   @unique
  dailyLimit            Int      @default(40)
  timezone              String   @default("Asia/Tashkent")
  bookingWindowDays     Int      @default(7)
  allowSameDay          Boolean  @default(true)
  enableQueue           Boolean  @default(true)
  enableSlots           Boolean  @default(true)
  enableHomeService     Boolean  @default(false)
  enableWebapp          Boolean  @default(true)
  enableBot             Boolean  @default(true)
  is24Hours             Boolean  @default(false)
  holidays              Json     @default("[]") @db.JsonB
  patientSelfLimit      Int      @default(4)      // ← bron-limit ishidan
  dependentBookingLimit Int      @default(1)      // ← bron-limit ishidan
  maxDependents         Int      @default(2)      // ← bron-limit ishidan
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  @@map("clinic_settings")
}
```

`discountPercent` **YO'Q** — qo'shish kerak.

### 2.4 Payment / Refund modellari (`prisma/schema.prisma:602`)
```prisma
model Payment {
  id            String          @id @default(cuid())
  appointmentId String
  clinicId      String
  userId        String?
  provider      PaymentProvider  // enum: payme | click
  providerTxId  String?
  amount        BigInt           // tiyin yoki so'm?
  currency      String           @default("UZS")
  state         PaymentState     // pending|authorized|paid|cancelled|failed|refunded|partial_refunded
  // ...
  refunds       Refund[]
  @@map("payments")
}
model Refund {
  id       String      @id @default(cuid())
  paymentId String
  amount    BigInt
  state     RefundState  // pending|succeeded|failed
  // ...
  @@map("refunds")
}
```

**MUHIM:** Bu jadvallar **Payme/Click online to'lovlar** uchun. Qabulxona "To'ladi" tugmasi bu jadvallarga **TEGMAYDI**. Chegirma shu jadvallarga yozilmaydi — `Appointment` ga yangi ustunlar qo'shiladi.

---

## 3. HOZIRGI TO'LOV OQIMI (HAQIQIY KOD)

### 3.1 To'lov API (`src/app/api/reception/appointments/[id]/payment/route.ts`)
```ts
// PATCH /api/reception/appointments/[id]/payment
// Body: { action: 'paid' | 'unpaid' | 'cancel' }

export async function PATCH(req, { params }) {
  const auth = await requireAuth(req);
  // allowedRoles: receptionist, clinic_admin, branch_admin, super_admin
  
  const { action } = await req.json();
  
  switch (action) {
    case "paid":
      result = await markAsPaid(params.id, actorClinicId, "reception");
      break;
    case "unpaid":
      result = await markAsUnpaid(params.id, actorClinicId);
      break;
    case "cancel":
      result = await cancelAppointment(params.id, actorClinicId);
      // + AuditLog create
      break;
  }
}
```

### 3.2 Workflow funksiyalari (`src/lib/workflow/appointment-workflow.ts`)
```ts
// markAsPaid → paymentStatus = 'paid'
export async function markAsPaid(appointmentId, actorClinicId, source) {
  // Tekshiradi: bron mavjud, clinicId mos, status != cancelled, paymentStatus != 'paid'
  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { paymentStatus: "paid" },
  });
  return { success: true, appointment: updated };
}

// markAsUnpaid → paymentStatus = 'pending'
export async function markAsUnpaid(appointmentId, actorClinicId) {
  // Tekshiradi: bron mavjud, clinicId mos, status != cancelled
  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { paymentStatus: "pending" },
  });
  return { success: true, appointment: updated };
}

// cancelAppointment → status = 'cancelled', paymentStatus = 'cancelled'
export async function cancelAppointment(appointmentId, actorClinicId) {
  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "cancelled", paymentStatus: "cancelled" },
  });
  return { success: true, appointment: updated };
}

// markAsArrived — shifokor tomonidan
// MUHIM: paymentStatus === 'paid' || 'not_required' bo'lishi SHART
export async function markAsArrived(appointmentId, actorClinicId) {
  // if (appt.paymentStatus !== 'paid' && appt.paymentStatus !== 'not_required')
  //   return { success: false, error: "To'lov tasdiqlanmagan..." }
  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "arrived" },
  });
}
```

### 3.3 Reception appointments list API (`src/app/api/reception/appointments/route.ts`)
```ts
// GET /api/reception/appointments?date=YYYY-MM-DD
// pending: paymentStatus === 'pending'
// paid: paymentStatus === 'paid' || 'not_required'

// serialize() funksiyasi:
{
  id, patientName, patientPhone, queueNumber,
  status, paymentStatus, queueMode, date, address, notes,
  service: { id, name, type, price: Number(a.service.price) },  // ← Decimal → Number
  doctor: { id, name, specialty },
  patientTelegramId, tibId,
  locationLat, locationLng, liveLat, liveLng,
  liveStartedAt, liveExpiresAt, liveLastUpdatedAt, liveStatus
}
// paidAmount va appliedDiscountPercent serialize'da YO'Q — qo'shish kerak
```

---

## 4. HOZIRGI QABULXONA UI (HAQIQIY KOD)

### 4.1 ReceptionView komponenti (`src/components/pages/ReceptionView.tsx`)

**Interface (line 10):**
```ts
interface ReceptionAppointment {
  id: string;
  patientName: string;
  patientPhone: string;
  queueNumber: number | null;
  status: string;
  paymentStatus: string;
  // ...
  service: { id: string; name: string; type: string; price: number } | null;
  doctor: { id: string; name: string; specialty: string | null } | null;
  // ... live location fields
}
// paidAmount, appliedDiscountPercent yo'q — qo'shish kerak
```

**handlePaymentAction (line 102):**
```ts
async function handlePaymentAction(appointmentId: string, action: "paid" | "unpaid" | "cancel") {
  await fetch(`/api/reception/appointments/${appointmentId}/payment`, {
    method: "PATCH",
    body: JSON.stringify({ action }),
  });
}
// mode yo'q — qo'shish kerak: "full" | "discount"
```

**Narx ko'rsatish (line 312):**
```ts
// ReceptionCard ichida:
<p>🏷 {appt.service?.name ?? "—"}
  {appt.service?.price ? ` · ${appt.service.price.toLocaleString()} so'm` : ""}
</p>
// service.price (to'liq narx) ko'rsatiladi
```

**Tugmalar (line 348):**
```tsx
{/* HOZIRGI HOLAT: */}
{section === "pending" && (
  <>
    <button onClick={onPaid} className="bg-emerald-500...">💰 To'ladi</button>
    <button onClick={onCancel} className="bg-red-50...">Bekor</button>
  </>
)}
{section === "paid" && (
  <button onClick={onUnpaid} className="bg-amber-50...">↩ To'lovni qaytarish</button>
)}
```

**ReceptionCard props (line 276):**
```ts
interface CardProps {
  appt: ReceptionAppointment;
  loading: boolean;
  section: "pending" | "paid";
  onPaid?: () => void;
  onUnpaid?: () => void;
  onCancel?: () => void;
}
// onDiscount prop yo'q — qo'shish kerak
```

**ReceptionView kontekst:**
```ts
export interface ReceptionViewProps {
  context?: "standalone" | "admin";
}
// standalone: /reception, admin: /admin/reception
// discountPercent yo'q — qo'shish kerak (fetch yoki prop sifatida)
```

---

## 5. HOZIRGI STATISTIKA (HAQIQIY KOD)

### 5.1 KPI queries (`src/lib/stats/queries.ts`)
```ts
// thisMonthRevenue HOZIR:
const revenueAgg = await prisma.appointment.findMany({
  where: { ...baseWhere, date: { gte: monthStart, lt: tomorrow }, status: "arrived" },
  select: { service: { select: { price: true } } },
});
const thisMonthRevenue = revenueAgg.reduce((sum, a) => sum + Number(a.service?.price ?? 0), 0);
// ↑ SUM(service.price) WHERE status='arrived' — CHEGIRMA HISOBLANMAYDI
```

**MUAMMO (0.9):** Chegirma kuchga kirgach bu hisoblagich noto'g'ri bo'ladi.  
**Yechim:** `SUM(paidAmount)` WHERE `paymentStatus='paid'` ga o'tish. Eski bronlar uchun `COALESCE(paidAmount, service.price)`.

### 5.2 Charts daromad (`src/lib/stats/charts.ts:140`)
```sql
-- getDailyRevenue — HOZIR:
SELECT DATE(a."createdAt") AS date, COALESCE(SUM(s.price), 0) AS revenue
FROM appointments a
INNER JOIN services s ON s.id = a."serviceId"
WHERE a.status = 'arrived'  -- ← status='arrived' filtr
GROUP BY DATE(a."createdAt")
```

**MUAMMO:** `SUM(s.price)` ishlatiladi, `paidAmount` emas.  
**Yechim:** `paidAmount` qo'shilgach SQL'ni `SUM(COALESCE(a."paidAmount", s.price))` WHERE `a."paymentStatus"='paid'` ga o'zgartirish.

### 5.3 KpiCards UI (`src/components/stats/KpiCards.tsx`)
```ts
// formatCurrency (line 27):
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("uz-UZ").format(value) + " so'm";
}
// Ishlatilish: formatCurrency(kpi.thisMonthRevenue)
// KPI: { label: "Daromad (oy)", sub: "Faqat 'keldi' status" }
```

### 5.4 DailyRevenueChart (`src/app/stats/components/DailyRevenueChart.tsx`)
```ts
// formatSom (line 22) — chart axis uchun:
function formatSom(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return value.toString();
}
// recharts AreaChart ishlatiladi
```

### 5.5 Stats sahifasi (`src/app/stats/page.tsx`)
```ts
// Route: /stats
// Allowed roles: super_admin, clinic_admin, doctor
// Tarkib:
//   <KpiCards />  — 8 karta (bugungi, haftalik, oylik bronlar, daromad, yangi bemorlar, aktiv, konversiya, live)
//   <ChartsSection />  — 6 grafik (daily bookings, revenue area, services donut, statuses donut, doctors bar, hours bar)
// X/Y/Z bloki YO'Q — qo'shish kerak
```

---

## 6. ADMIN SETTINGS (HAQIQIY KOD)

### 6.1 Settings UI (`src/app/admin/(panel)/settings/page.tsx`)
```ts
// interface LimitSettings { patientSelfLimit, dependentBookingLimit, maxDependents }
// FIELDS array: 3 ta input field
// Fetch: GET /api/admin/clinic-settings → setSettings(res.data)
// Save: PUT /api/admin/clinic-settings → JSON({ ...settings })
// discountPercent yo'q — qo'shish kerak
```

Sahifada `<h1>Bron limit sozlamalari</h1>` sarlavha, 3 ta input field bor.

### 6.2 Clinic-settings API (`src/app/api/admin/clinic-settings/route.ts`)
```ts
// GET — faqat bu 3 fieldni qaytaradi:
select: { patientSelfLimit: true, dependentBookingLimit: true, maxDependents: true }

// PUT — faqat bu 3 fieldni qabul qiladi va tekshiradi:
const { patientSelfLimit, dependentBookingLimit, maxDependents } = body;
// patientSelfLimit: 1..10, dependentBookingLimit: 0..5, maxDependents: 0..5
// upsert: clinicId bo'yicha
// discountPercent yo'q — qo'shish kerak
```

---

## 7. IMPLEMENTATSIYA REJASI (BOSQICHMA-BOSQICH)

### Bosqich 0: Branch
```bash
git checkout -b feat/discount-system
```

### Bosqich 1: DB Migration (Supabase MCP apply_migration)

**Migration nomi:** `add_discount_system`

```sql
-- 1. ClinicSettings ga discountPercent qo'shish
ALTER TABLE clinic_settings
ADD COLUMN IF NOT EXISTS "discountPercent" INTEGER NOT NULL DEFAULT 0;

-- Validatsiya constraint:
ALTER TABLE clinic_settings
ADD CONSTRAINT discount_percent_range CHECK ("discountPercent" >= 0 AND "discountPercent" <= 100);

-- 2. Appointment ga paidAmount va appliedDiscountPercent qo'shish
ALTER TABLE appointments
ADD COLUMN IF NOT EXISTS "paidAmount" INTEGER,
ADD COLUMN IF NOT EXISTS "appliedDiscountPercent" INTEGER NOT NULL DEFAULT 0;

-- Index (statistika uchun)
CREATE INDEX IF NOT EXISTS appointments_payment_discount_idx
ON appointments ("clinicId", "paymentStatus", "appliedDiscountPercent");
```

**Prisma schema yangilanishi:**
```prisma
// ClinicSettings ga:
discountPercent Int @default(0)  // 0..100

// Appointment ga:
paidAmount             Int?   // to'liq so'mda (integer). Null = to'lov bo'lmagan
appliedDiscountPercent Int    @default(0)  // to'lov paytida muzlatilgan foiz
```

### Bosqich 2: Settings API kengaytirish

**`src/app/api/admin/clinic-settings/route.ts` o'zgartirish:**

GET — `discountPercent: true` qo'shish:
```ts
select: {
  patientSelfLimit: true,
  dependentBookingLimit: true,
  maxDependents: true,
  discountPercent: true,  // ← yangi
},
// default: { ..., discountPercent: 0 }
```

PUT — `discountPercent` validatsiya va upsert:
```ts
const { patientSelfLimit, dependentBookingLimit, maxDependents, discountPercent } = body;

// Yangi validatsiya:
if (typeof discountPercent !== "number" || !Number.isInteger(discountPercent) || discountPercent < 0 || discountPercent > 100)
  return error("discountPercent 0 dan 100 gacha butun son bo'lishi kerak", 400);

// upsert ga qo'shish:
update: { patientSelfLimit, dependentBookingLimit, maxDependents, discountPercent },
create: { clinicId: auth.clinicId, patientSelfLimit, dependentBookingLimit, maxDependents, discountPercent },
select: { patientSelfLimit: true, dependentBookingLimit: true, maxDependents: true, discountPercent: true },
```

### Bosqich 3: Settings UI kengaytirish

**`src/app/admin/(panel)/settings/page.tsx` o'zgartirish:**

```ts
// Interface kengaytirish:
interface LimitSettings {
  patientSelfLimit: number;
  dependentBookingLimit: number;
  maxDependents: number;
  discountPercent: number;  // ← yangi
}

// Default state:
const [settings, setSettings] = useState<LimitSettings>({
  patientSelfLimit: 4,
  dependentBookingLimit: 1,
  maxDependents: 2,
  discountPercent: 0,  // ← yangi
});

// FIELDS array ga yangi element qo'shish (boshida yoki oxirida):
{
  key: "discountPercent",
  label: "Klinika chegirma foizi",
  min: 0,
  max: 100,
  hint: "Klinika chegirma foizi. Qabulxona xodimi 'chegirma' tugmasini bosganda, bemor shu foizda kam to'laydi. 0 qo'ysangiz, chegirma tugmasi ko'rinmaydi.",
  example: "Masalan 60% qo'ysangiz, 100 000 so'mlik qabulda bemor 40 000 so'm to'laydi. 100% = bemor bepul. 0 = chegirma o'chiq.",
}
```

Input field: `min=0 max=100` (range yozuvi: "0–100 oralig'ida").

### Bosqich 4: Qabulxona to'lov oqimi

#### 4a. Reception appointments serialize kengaytirish
**`src/app/api/reception/appointments/route.ts` — serialize() funksiya:**
```ts
function serialize(a: any) {
  return {
    // ... mavjud fieldlar ...
    paidAmount: a.paidAmount ?? null,                          // ← yangi
    appliedDiscountPercent: a.appliedDiscountPercent ?? 0,    // ← yangi
  };
}
```

#### 4b. ReceptionView — discountPercent fetch
**`src/components/pages/ReceptionView.tsx`:**
```ts
// State qo'shish:
const [discountPercent, setDiscountPercent] = useState(0);

// useEffect — bir marta yuklash:
useEffect(() => {
  fetch("/api/admin/clinic-settings", { credentials: "include" })
    .then(r => r.json())
    .then(j => { if (j.success && j.data) setDiscountPercent(j.data.discountPercent ?? 0); })
    .catch(() => {});
}, []);
```

#### 4c. Interface kengaytirish
```ts
interface ReceptionAppointment {
  // ... mavjud fieldlar ...
  paidAmount: number | null;              // ← yangi
  appliedDiscountPercent: number;        // ← yangi
}
```

#### 4d. handlePaymentAction kengaytirish
```ts
async function handlePaymentAction(
  appointmentId: string,
  action: "paid" | "unpaid" | "cancel",
  mode?: "full" | "discount"  // ← yangi
) {
  const body: Record<string, unknown> = { action };
  if (action === "paid" && mode) body.mode = mode;
  
  await fetch(`/api/reception/appointments/${appointmentId}/payment`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
```

#### 4e. CardProps kengaytirish
```ts
interface CardProps {
  appt: ReceptionAppointment;
  loading: boolean;
  section: "pending" | "paid";
  discountPercent: number;   // ← yangi
  onPaid?: () => void;
  onDiscount?: () => void;   // ← yangi (ko'k tugma)
  onUnpaid?: () => void;
  onCancel?: () => void;
}
```

#### 4f. ReceptionCard tugmalari yangi holat
```tsx
{/* pending section: */}
<div className="flex flex-col gap-2 mt-3">
  {/* 1. To'ladi (yashil) */}
  <button onClick={onPaid} disabled={loading}
    className="w-full px-3 py-2 min-h-[44px] bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors">
    {loading ? "..." : "💰 To'ladi"}
  </button>
  
  {/* 2. X so'm to'ladi (ko'k) — faqat discountPercent > 0 bo'lganda */}
  {discountPercent > 0 && appt.service?.price != null && (
    <button onClick={onDiscount} disabled={loading}
      className="w-full px-3 py-2 min-h-[44px] bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors">
      {loading ? "..." : `${Math.round(appt.service.price * (100 - discountPercent) / 100).toLocaleString("uz-UZ")} so'm to'ladi`}
    </button>
  )}
  
  {/* 3. Bekor (qizil) */}
  <button onClick={onCancel} disabled={loading}
    className="w-full px-3 py-2 min-h-[44px] bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-600 rounded-lg text-sm transition-colors">
    Bekor
  </button>
</div>

{/* paid section: */}
<div className="flex gap-2 mt-3">
  {/* To'lovni qaytarish — faqat paidAmount > 0 bo'lganda */}
  {(appt.paidAmount == null || appt.paidAmount > 0) && (
    <button onClick={onUnpaid} disabled={loading}
      className="px-3 py-2 min-h-[44px] bg-amber-50 hover:bg-amber-100 disabled:opacity-50 text-amber-700 rounded-lg text-sm transition-colors">
      {loading ? "..." : "↩ To'lovni qaytarish"}
    </button>
  )}
  {/* appliedDiscountPercent === 100 yoki paidAmount === 0 → tugma YO'Q */}
</div>
```

#### 4g. ReceptionCard chaqiruvini yangilash (pending section)
```tsx
{data.pending.map((appt) => (
  <ReceptionCard
    key={appt.id}
    appt={appt}
    loading={actionLoading === appt.id}
    section="pending"
    discountPercent={discountPercent}
    onPaid={() => handlePaymentAction(appt.id, "paid", "full")}
    onDiscount={() => handlePaymentAction(appt.id, "paid", "discount")}
    onCancel={() => handlePaymentAction(appt.id, "cancel")}
  />
))}
```

### Bosqich 5: To'lov API kengaytirish

**`src/app/api/reception/appointments/[id]/payment/route.ts`:**

```ts
// Body: { action: 'paid' | 'unpaid' | 'cancel', mode?: 'full' | 'discount' }

case "paid": {
  const mode = (body.mode as string) === "discount" ? "discount" : "full";
  result = await markAsPaid(params.id, actorClinicId, "reception", mode);
  break;
}
case "unpaid":
  result = await markAsUnpaid(params.id, actorClinicId);
  break;
```

**`src/lib/workflow/appointment-workflow.ts` — markAsPaid kengaytirish:**

```ts
export async function markAsPaid(
  appointmentId: string,
  actorClinicId: string | null,
  source: PaymentSource = "reception",
  mode: "full" | "discount" = "full"
): Promise<WorkflowResult> {
  try {
    const appt = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true, clinicId: true, paymentStatus: true, status: true,
        service: { select: { price: true } },
      },
    });
    if (!appt) return { success: false, error: "Bron topilmadi" };
    if (actorClinicId && appt.clinicId !== actorClinicId)
      return { success: false, error: "Bu bron boshqa klinikaga tegishli" };
    if (appt.status === "cancelled")
      return { success: false, error: "Bekor qilingan bron" };
    if (appt.paymentStatus === "paid")
      return { success: false, error: "Bu bron allaqachon to'langan" };

    const servicePrice = Number(appt.service?.price ?? 0);
    
    let paidAmount: number;
    let appliedDiscountPercent: number;

    if (mode === "discount") {
      // discountPercent ni server tomonda olish (xavfsizlik)
      const settings = await prisma.clinicSettings.findUnique({
        where: { clinicId: appt.clinicId },
        select: { discountPercent: true },
      });
      const dp = settings?.discountPercent ?? 0;
      appliedDiscountPercent = dp;
      paidAmount = Math.round(servicePrice * (100 - dp) / 100);
    } else {
      paidAmount = Math.round(servicePrice);
      appliedDiscountPercent = 0;
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { paymentStatus: "paid", paidAmount, appliedDiscountPercent },
    });
    
    console.log(`[workflow] markAsPaid: ${appointmentId} mode=${mode} paidAmount=${paidAmount} discount=${appliedDiscountPercent}% by ${source}`);
    return { success: true, appointment: updated };
  } catch (err: any) {
    console.error("[workflow/markAsPaid]", err);
    return { success: false, error: err?.message || "Server xatosi" };
  }
}
```

**markAsUnpaid — to'lovni qaytarish (paidAmount reset):**
```ts
export async function markAsUnpaid(appointmentId, actorClinicId) {
  // Tekshirish: mavjud + clinicId mos + status != cancelled
  // YANGI: 100% chegirma edi → qaytarish imkonsiz
  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { id: true, clinicId: true, paymentStatus: true, status: true, appliedDiscountPercent: true, paidAmount: true },
  });
  // ...
  if (appt.appliedDiscountPercent === 100) {
    return { success: false, error: "100% chegirmali to'lovni qaytarib bo'lmaydi (0 so'm to'langan)" };
  }
  
  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { paymentStatus: "pending", paidAmount: null, appliedDiscountPercent: 0 },
  });
  return { success: true, appointment: updated };
}
```

### Bosqich 6: Statistika X/Y/Z API

**Yangi endpoint:** `src/app/api/admin/stats/discount/route.ts`

```ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, error, unauthorized, forbidden } from "@/lib/api-response";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth) return unauthorized();
  if (!["clinic_admin", "super_admin", "branch_admin"].includes(auth.role)) return forbidden();
  
  const clinicId = auth.role === "super_admin" ? null : auth.clinicId;
  if (!clinicId && auth.role !== "super_admin") return error("clinicId topilmadi", 400);

  try {
    const cf = clinicId ? Prisma.sql`AND "clinicId" = ${clinicId}` : Prisma.empty;
    
    // X = jami haqiqiy tushum (barcha paid bronlar)
    const xRows = await prisma.$queryRaw<[{ total: string }]>(
      Prisma.sql`
        SELECT COALESCE(SUM("paidAmount"), 0)::text AS total
        FROM appointments
        WHERE "paymentStatus" = 'paid'
        ${cf}
      `
    );
    
    // Z = chegirmali to'lovlardan tushum
    const zRows = await prisma.$queryRaw<[{ total: string }]>(
      Prisma.sql`
        SELECT COALESCE(SUM("paidAmount"), 0)::text AS total
        FROM appointments
        WHERE "paymentStatus" = 'paid'
          AND "appliedDiscountPercent" > 0
        ${cf}
      `
    );
    
    // Y = chegirilgan pul (xizmat narxi − to'langan summa)
    // faqat chegirmali bronlar uchun
    const yRows = await prisma.$queryRaw<[{ total: string }]>(
      Prisma.sql`
        SELECT COALESCE(
          SUM(CAST(s.price AS NUMERIC) - a."paidAmount"), 0
        )::text AS total
        FROM appointments a
        INNER JOIN services s ON s.id = a."serviceId"
        WHERE a."paymentStatus" = 'paid'
          AND a."appliedDiscountPercent" > 0
        ${cf}
      `
    );

    const x = Number(xRows[0]?.total ?? 0);
    const z = Number(zRows[0]?.total ?? 0);
    const y = Number(yRows[0]?.total ?? 0);

    return ok({ x, y, z });
  } catch (err) {
    console.error("[stats/discount]", err);
    return error("Server xatosi", 500);
  }
}
```

### Bosqich 7: Statistika X/Y/Z UI komponenti

**Yangi fayl:** `src/components/stats/DiscountStats.tsx`

```tsx
"use client";
import { useEffect, useState } from "react";

interface DiscountData { x: number; y: number; z: number }

function fmt(v: number) {
  return new Intl.NumberFormat("uz-UZ").format(v) + " so'm";
}

export default function DiscountStats() {
  const [data, setData] = useState<DiscountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats/discount", { cache: "no-store" })
      .then(r => r.json())
      .then(d => { if (d.success) setData(d.data); else setError(d.error?.message ?? "Xato"); })
      .catch(() => setError("Tarmoq xatosi"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />;
  if (error) return <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>;
  if (!data) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <h3 className="font-semibold text-gray-900">Chegirma statistikasi</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-emerald-50 rounded-lg p-4">
          <p className="text-xs text-emerald-700 font-medium mb-1">X — Jami tushum</p>
          <p className="text-xl font-bold text-emerald-900">{fmt(data.x)}</p>
          <p className="text-xs text-emerald-600 mt-1">Barcha to'lovlar (chegirmali + to'liq)</p>
        </div>
        <div className="bg-red-50 rounded-lg p-4">
          <p className="text-xs text-red-700 font-medium mb-1">Y — Chegirilgan</p>
          <p className="text-xl font-bold text-red-900">{fmt(data.y)}</p>
          <p className="text-xs text-red-600 mt-1">Chegirma tufayli olinmagan pul</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-xs text-blue-700 font-medium mb-1">Z — Chegirmali tushum</p>
          <p className="text-xl font-bold text-blue-900">{fmt(data.z)}</p>
          <p className="text-xs text-blue-600 mt-1">Chegirma berilgan bronlardan</p>
        </div>
      </div>
    </div>
  );
}
```

**`src/app/stats/page.tsx`** ga qo'shish (ChartsSection dan keyin):
```tsx
import DiscountStats from "@/components/stats/DiscountStats";

// ...
<section className="mb-8">
  <h2 className="text-lg font-semibold text-gray-800 mb-4">Chegirma tahlili</h2>
  {(payload.role === "super_admin" || payload.role === "clinic_admin") ? (
    <DiscountStats />
  ) : null}
</section>
```

### Bosqich 8: Mavjud daromad statistikasini moslashtirish (0.9)

**`src/lib/stats/queries.ts` — fetchKpi:**
```ts
// HOZIR:
const revenueAgg = await prisma.appointment.findMany({
  where: { ...baseWhere, date: { gte: monthStart, lt: tomorrow }, status: "arrived" },
  select: { service: { select: { price: true } } },
});
const thisMonthRevenue = revenueAgg.reduce((sum, a) => sum + Number(a.service?.price ?? 0), 0);

// YANGI (chegirma kuchga kirgach):
const revenueAgg = await prisma.appointment.findMany({
  where: { ...baseWhere, date: { gte: monthStart, lt: tomorrow }, paymentStatus: "paid" },
  select: { paidAmount: true, service: { select: { price: true } } },
});
const thisMonthRevenue = revenueAgg.reduce(
  (sum, a) => sum + (a.paidAmount != null ? a.paidAmount : Number(a.service?.price ?? 0)),
  0
);
// COALESCE mantiq: eski bronlar (paidAmount=null) → service.price; yangi bronlar → paidAmount
```

**`src/lib/stats/charts.ts` — getDailyRevenue:**
```sql
-- HOZIR:
INNER JOIN services s ON s.id = a."serviceId"
WHERE a.status = 'arrived'
SUM(s.price)

-- YANGI:
INNER JOIN services s ON s.id = a."serviceId"
WHERE a."paymentStatus" = 'paid'
SUM(COALESCE(a."paidAmount", CAST(s.price AS INTEGER)))
```

**KpiCards sub matni o'zgaradi:** `"Faqat 'keldi' status"` → `"Haqiqiy to'lovlar"`.

---

## 8. RISKLAR VA QARASHLAR

### R1 — paidAmount kasr muammo
- `service.price` = `Decimal(10,2)` → `Number(price)` = float (masalan 75001.50)
- `Math.round(price * (100-d) / 100)` — to'g'ri
- `paidAmount Int?` — integer so'm. 0.50 so'm bo'lmaydi → Math.round yetarli

### R2 — Frontend xavfsizligi
- Frontend faqat `mode: "full" | "discount"` yuboradi
- Server `discountPercent`'ni `ClinicSettings`'dan o'zi oladi
- Hech qanday summa frontend'dan qabul qilinmaydi

### R3 — 100% chegirma holati
- `discountPercent=100` → `paidAmount=0`
- Qaytarish tugmasi ko'rsatilmaydi: `appt.appliedDiscountPercent === 100`
- `markAsUnpaid` server tomonda ham rad etadi

### R4 — Eski bronlar (D4)
- Mavjud `paid` bronlar uchun `paidAmount=null`
- `COALESCE(paidAmount, service.price)` pattern — xavfsiz
- Test rejimida data baribir nollanadi

### R5 — markAsArrived bilan birgalik
- `markAsArrived` `paymentStatus === 'paid'` tekshiradi — bu o'zgarmasligi kerak
- Chegirma `paymentStatus` ni o'zgartirmaydi — faqat `paidAmount` va `appliedDiscountPercent` qo'shiladi
- O'zaro munosabat to'g'ri

### R6 — discountPercent=0, price=0 xavfsizligi
- `discountPercent=0` → ko'k tugma chiqmaydi (UI ichida `discountPercent > 0` tekshiruvi)
- `price=0, dp=50` → `paidAmount=0`, `Y=0`, `Z=0` — hech qanday xato yo'q
- NaN imkoniyati yo'q chunki `Number(price)` va `Math.round` xavfsiz

---

## 9. FAYL YO'LLARI XARITASI

```
src/
├── app/
│   ├── api/
│   │   ├── admin/
│   │   │   ├── clinic-settings/route.ts  ← KENGAYTIRISH (discountPercent)
│   │   │   └── stats/
│   │   │       ├── charts/route.ts        ← MAVJUD (getDailyRevenue o'zgaradi)
│   │   │       ├── route.ts               ← MAVJUD (hozir ishlatilmaydi)
│   │   │       └── discount/route.ts      ← YANGI (X/Y/Z)
│   │   └── reception/
│   │       └── appointments/
│   │           ├── route.ts               ← KENGAYTIRISH (serialize paidAmount)
│   │           └── [id]/payment/route.ts  ← KENGAYTIRISH (mode param)
│   ├── admin/
│   │   └── (panel)/
│   │       └── settings/page.tsx          ← KENGAYTIRISH (discountPercent field)
│   └── stats/
│       ├── page.tsx                       ← KENGAYTIRISH (DiscountStats blok)
│       └── components/
│           └── DailyRevenueChart.tsx      ← KENGAYTIRISH (revenue hisob)
├── components/
│   ├── pages/
│   │   └── ReceptionView.tsx              ← KENGAYTIRISH (discountPercent, 3 tugma)
│   └── stats/
│       ├── KpiCards.tsx                   ← KENGAYTIRISH (sub matn, paidAmount)
│       └── DiscountStats.tsx              ← YANGI (X/Y/Z UI)
├── lib/
│   ├── stats/
│   │   ├── queries.ts                     ← KENGAYTIRISH (thisMonthRevenue)
│   │   └── charts.ts                      ← KENGAYTIRISH (getDailyRevenue)
│   └── workflow/
│       └── appointment-workflow.ts        ← KENGAYTIRISH (markAsPaid mode, markAsUnpaid reset)
└── prisma/
    └── schema.prisma                      ← KENGAYTIRISH (2 model)
```

---

## 10. TEST REJASI (BARCHA HOLATLAR)

### DB/Migration:
- [ ] `clinic_settings` jadvalida `discountPercent` ustun bor, default 0
- [ ] `appointments` jadvalida `paidAmount` va `appliedDiscountPercent` ustunlar bor

### Admin settings:
- [ ] `discountPercent=60` saqlandi → GET qaytaradi 60
- [ ] `discountPercent=0` → saqlandi (chegirma o'chiq)
- [ ] `discountPercent=100` → saqlandi (to'liq chegirma)
- [ ] `discountPercent=-1` → 400 xato
- [ ] `discountPercent=101` → 400 xato
- [ ] Boshqa klinika mustaqil (boshqa klinika settings'i o'zgarmaydi)

### Qabulxona UI:
- [ ] `discount=0` → faqat "To'ladi" + "Bekor" (ko'k tugma yo'q)
- [ ] `discount=60`, narx 100000 → "40 000 so'm to'ladi" (ko'k tugma)
- [ ] `discount=60`, narx 70000 → "28 000 so'm to'ladi"
- [ ] `discount=100`, narx 50000 → "0 so'm to'ladi"
- [ ] "To'ladi" bosildi → `paidAmount=100000`, `appliedDiscountPercent=0`, status shifokorga
- [ ] "40000 so'm to'ladi" bosildi → `paidAmount=40000`, `appliedDiscountPercent=60`
- [ ] Tugmalar yo'qoldi (ikkala to'lov tugmasi paid bo'lgach)
- [ ] `/reception` va `/admin/reception` ikkalasida ishlaydi

### To'lovni qaytarish:
- [ ] `discount=60, paidAmount=40000` → qaytarish tugmasi BOR
- [ ] `discount=100, paidAmount=0` → qaytarish tugmasi **YO'Q**
- [ ] To'liq to'lagan (`appliedDiscount=0`) → qaytarish bor
- [ ] Qaytarilganda: `paymentStatus=pending`, `paidAmount=null`, `appliedDiscountPercent=0`
- [ ] Qaytarilganda: tugmalar qayta chiqdi

### Statistika X/Y/Z:
- [ ] 100000 to'liq: X+=100000, Y+=0, Z+=0
- [ ] 100000, 90% (10000 to'langan): X+=10000, Y+=90000, Z+=10000
- [ ] Qaytarilgan bron: X/Y/Z dan ayriladi
- [ ] X = mavjud "Daromad (oy)" KPI bilan bir xil raqam

### Xavfsizlik:
- [ ] Frontend soxta summa yuklaydimi? → yo'q (mode qabul qilinadi, summa emas)
- [ ] Narx 0 → summalar 0, xato yo'q

### Regressiya:
- [ ] Bron-limit tizimi buzilmagan
- [ ] Mavjud to'lov oqimi (chegirmasiz) ishlaydi
- [ ] `tsc --noEmit` toza
- [ ] `npm run build` toza

---

## 11. MUHIM INVARIANTLAR (O'ZGARTIRMA)

1. `clinicId` scope har so'rovda saqlanadi
2. `paymentStatus` faqat: `pending | paid | not_required | cancelled`
3. `status` (AppointmentStatus) chegirma bilan tegilmaydi
4. `markAsArrived` `paymentStatus === 'paid'` talab qiladi — chegirma bu shartni buzmaydi
5. `normalizePhone()`, `withRetry()`, transaction pattern — mavjud
6. Responsive: `components/layout/` primitivlari, xs/md/lg/2xl
7. Migration: SQL + Supabase MCP `apply_migration` (project_id: `lxqimithjjabhnldcugc`)
8. Deploy: `npx vercel --prod --yes` faqat ruxsatdan keyin
9. `prisma migrate dev` ishlamaydi (shadow DB muammo)

---

## 12. INFRA (LIVE)

- **Supabase project_id:** `lxqimithjjabhnldcugc`
- **Vercel project_id:** `prj_U0d0bOMH4rj6Ao2JVeeQtGvgjKgJ`
- **DB URL env:** `DATABASE_URL`, `DIRECT_URL`
- **Auth:** JWT cookie `auth_token`

---

*Bu fayl DIAGNOZ_chegirma_tizimi.md asosida to'liq implementatsiya malumotnomasi sifatida yozildi. Hamma kod haqiqiy fayllardan olingan.*
