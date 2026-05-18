# 🎯 VAZIFA: Admin Stats Dashboard — Tijoriy darajada 6 ta interaktiv grafik

## LOYIHA KONTEKSTI

**Repo:** oqiljonplay-ctrl/tibtaqvim
**Stack:** Next.js 14 (App Router) + Prisma 6 + Supabase PG17 + Vercel
**Production:** https://tibtaqvim.vercel.app
**Supabase project_id:** lxqimithjjabhnldcugc
**Vercel project_id:** prj_U0d0bOMH4rj6Ao2JVeeQtGvgjKgJ

### Hozirgi holat (TEGILMAYDI)

`/stats` sahifa allaqachon mavjud va ishlamoqda:
- **Doctor `/stats`** — shifokorning o'z bemorlari KPI (8 ta karta)
- **Admin `/stats`** — klinika KPI (8 ta karta)
- Pastda placeholder: `"📈 Grafiklar va tahlillar — keyingi bosqichda qo'shiladi"`

**Bizning vazifamiz** — bu placeholder o'rniga **Admin uchun 6 ta interaktiv grafik blok** qo'yish.

### Doctor sahifa (BU PROMPT'DA TEGILMAYDI)
Doctor `/stats` placeholder o'sha holicha qoladi. Doctor uchun grafiklar **keyingi alohida vazifa** bo'ladi.

---

## ⚠️ MUTLAQ QOIDALAR — Kontekstni buzmaslik

Bular **buzilmasligi kerak** (oldingi sessiyalardan jamlangan):

### 1. Mavjud KPI raqamlari (8 ta karta) — TEGILMAYDI
- Bugungi bronlar, Bu hafta, Bu oy, Daromad (oy), Yangi bemorlar (oy), Aktiv bemorlar, Konversiya, Aktiv jonli
- Backend hisob-kitob mantiqi saqlanadi
- Faqat **PASTGA** grafiklar qo'shiladi

### 2. Auth pattern
- `requireAuth(req)` ishlatish — `src/lib/auth.ts` yoki shunga o'xshash
- Cookie + JWT (HttpOnly, 24h, sameSite=lax)
- Role check: faqat `super_admin` va `clinic_admin` admin grafiklarni ko'radi
- Doctor stats endpoint ham `auth.role === 'doctor'` tekshiruvini saqlaydi

### 3. Response wrapper
- Hamma yangi API endpoint'lar `ok()` / `error()` helper'larini ishlatadi
- Mavjud `src/lib/api-response.ts` (yoki shu nom bilan) saqlanadi

### 4. Prisma client
- Faqat `import { prisma } from "@/lib/prisma"` — yangi instance yaratmaslik
- Decimal qiymatlar (price) `Number()` bilan o'tkaziladi yoki `toString()` keyin `Number()`
- BigInt qiymatlar JSON serialize qilinmaydi — `Number()` ga aylantirish

### 5. Mavjud schema o'zgarishlari
- **TEGILMAYDI:** `requiresSlot`, `queueMode`, `paymentStatus`, `service_doctors` jadval
- Yangi ustun yoki jadval qo'shilmaydi — hamma narsa **mavjud schema**'dan hisoblanadi

### 6. RLS va Audit
- 16/16 jadval RLS yoqilgan — yangi endpoint Prisma orqali ishlaydi (RLS bypass bilan, `postgres` user)
- Audit log triggerlari saqlanadi — yangi GET endpoint'lar audit'ga ta'sir qilmaydi (faqat SELECT)

### 7. TypeScript strict
- `any` ishlatilmaydi — har joyda aniq tip
- Frontend state'lar uchun aniq interface

### 8. Mobile-first
- Foydalanuvchi telefondan ishlatadi (skrinshotlar 720x1600)
- Grafiklar mobile'da **bir ustun**, desktop'da grid
- Responsive container

### 9. Vercel build
- `npm run build` xato bermasligi shart
- Mavjud `prisma generate` postinstall saqlanadi

---

## 📊 ARXITEKTURA YECHIM

### Daraja qarori (foydalanuvchi tasdiqlagan)

**Tijoriy 6 ta grafik:**

| # | Grafik | Type | Foydasi |
|---|---|---|---|
| 1 | **Kunlik bronlar trendi** | Line chart | Vaqt dinamikasi |
| 2 | **Kunlik daromad trendi** | Area chart | Pul oqimi |
| 3 | **Xizmatlar bo'yicha taqsimot** | Donut (Pie) | Qaysi xizmat ko'p |
| 4 | **Status taqsimoti** | Donut (Pie) | Konversiya holati |
| 5 | **Shifokorlar bo'yicha bronlar** | Bar chart | Eng band shifokor |
| 6 | **Soatlar bo'yicha bronlar** (0-23) | Bar chart | Pik vaqtlar |

### Vaqt oralig'i filter

Dropdown — `7 / 14 / 30 / 90 kun` — **bitta global filter**, hamma grafikga ta'sir qiladi.
- Default: **30 kun**
- Sahifa yangilanganda — har doim 30 kun (localStorage YO'Q)

### Grafiklar kutubxonasi

**Recharts** (`recharts` paketi). Sabablari:
- Next.js bilan yaxshi ishlaydi (SSR friendly, "use client" yetadi)
- TypeScript first-class qo'llab-quvvatlash
- Sizning skrinshotlardagi 8 ta karta dizayni bilan mos
- Bundle size kichik (~95 KB gzip)
- Active community, doc juda yaxshi

**O'rnatish:**
```bash
npm install recharts
```

---

## 🗂 FAYL STRUKTURASI

Yangi yoki o'zgartiriladigan fayllar:

```
src/
├── lib/
│   └── stats/
│       └── charts.ts                          # YANGI: data aggregation funksiyalar
├── app/
│   ├── stats/
│   │   └── page.tsx                           # O'ZGARTIRILADI: placeholder → 6 grafik
│   ├── api/
│   │   └── admin/
│   │       └── stats/
│   │           └── charts/
│   │               └── route.ts               # YANGI: GET /api/admin/stats/charts
│   └── stats/
│       └── components/
│           ├── ChartsSection.tsx              # YANGI: 6 grafik konteyner
│           ├── DateRangeFilter.tsx            # YANGI: 7/14/30/90 dropdown
│           ├── DailyBookingsChart.tsx         # YANGI: Line chart
│           ├── DailyRevenueChart.tsx          # YANGI: Area chart
│           ├── ServicesDonutChart.tsx         # YANGI: Donut
│           ├── StatusDonutChart.tsx           # YANGI: Donut
│           ├── DoctorsBarChart.tsx            # YANGI: Bar
│           ├── HoursBarChart.tsx              # YANGI: Bar
│           └── ChartCard.tsx                  # YANGI: umumiy wrapper
package.json                                   # recharts qo'shiladi
```

⚠️ **MUHIM:** Hozir `src/app/stats/page.tsx` Doctor va Admin uchun **bir xil fayl** bo'lishi mumkin (role-based render). Buni o'qib, tahlil qilib, **faqat admin qism**iga grafiklarni qo'shing.

---

## 📐 BOSQICH 1 — DIAGNOSTIKA

Boshlashdan oldin quyidagini bajarib chiqing:

### 1.1 — Mavjud Stats sahifani topish
```bash
find src/app -name "page.tsx" | xargs grep -l "Statistika\|Asosiy ko'rsatkichlar" 2>/dev/null
```

### 1.2 — Mavjud API endpoint topish
```bash
find src/app/api -name "*.ts" | xargs grep -l "Bugungi bronlar\|aktiv bemorlar\|konversiya" 2>/dev/null
# yoki
find src/app/api -type d -name "stats"
```

### 1.3 — Sahifaning ko'rinishini tushunish
- Doctor va Admin uchun **bitta sahifa** yoki **alohida fayllar**?
- Role-based render qanday qilingan?
- 8 ta KPI karta qaysi komponent yoki API'dan keladi?
- Placeholder ("Grafiklar va tahlillar — keyingi bosqichda") qaysi qatorda?

### 1.4 — Foydalanuvchiga hisobot
Quyidagi shaklda hisobot bering:
```
DIAGNOSTIKA YAKUNI:
✓ Stats sahifa: src/app/stats/page.tsx (Doctor va Admin role-based)
✓ KPI API: src/app/api/admin/stats/route.ts
✓ Placeholder qatori: line 145 atrofida
✓ Role aniqlanishi: cookie'dan + role check
✓ Mavjud auth helper: src/lib/auth.ts (requireAuth)
✓ Mavjud ok/error helper: src/lib/api-response.ts

REJA:
1. recharts o'rnataman
2. src/lib/stats/charts.ts — 6 ta aggregation funksiya
3. /api/admin/stats/charts — yangi endpoint
4. 6 ta Chart komponent + DateRangeFilter
5. Stats page'da admin qismiga ChartsSection qo'shaman

Boshlashga ruxsatmi?
```

Foydalanuvchi tasdiqlagandan keyin **Bosqich 2 ga o'ting**.

---

## 🗄 BOSQICH 2 — DATA LAYER (charts.ts)

### Fayl: `src/lib/stats/charts.ts`

Bu fayl **6 ta aggregation funksiya** + **umumiy filter type** ni eksport qiladi.

```typescript
import { prisma } from "@/lib/prisma";

// ===================================================================
// TYPES
// ===================================================================

export type ChartRange = 7 | 14 | 30 | 90;

export interface DailyPoint {
  date: string;       // "2026-05-17" (ISO date)
  label: string;      // "17-may" (uz format)
  count: number;
}

export interface RevenuePoint {
  date: string;
  label: string;
  revenue: number;    // so'm (so'mda butun son)
}

export interface BreakdownItem {
  id: string;
  name: string;
  value: number;
  color?: string;
}

export interface HourlyPoint {
  hour: number;       // 0-23
  label: string;      // "09:00"
  count: number;
}

export interface ChartsResponse {
  range: ChartRange;
  startDate: string;
  endDate: string;
  daily: DailyPoint[];
  revenue: RevenuePoint[];
  services: BreakdownItem[];
  statuses: BreakdownItem[];
  doctors: BreakdownItem[];
  hours: HourlyPoint[];
}

// ===================================================================
// HELPERS
// ===================================================================

function getDateRange(rangeDays: ChartRange): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);
  
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  startDate.setDate(startDate.getDate() - (rangeDays - 1)); // inclusive
  
  return { startDate, endDate };
}

function toIsoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function toUzLabel(d: Date): string {
  const months = [
    'yan', 'fev', 'mar', 'apr', 'may', 'iyn',
    'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'
  ];
  return `${d.getDate()}-${months[d.getMonth()]}`;
}

// Sanalar oralig'ini bo'sh kunlar bilan to'ldirish (har sana uchun 0 default)
function fillDateGaps<T extends { date: string }>(
  data: T[],
  startDate: Date,
  endDate: Date,
  defaultFactory: (date: string, label: string) => T
): T[] {
  const map = new Map(data.map(item => [item.date, item]));
  const result: T[] = [];
  
  const current = new Date(startDate);
  while (current <= endDate) {
    const isoDate = toIsoDate(current);
    const label = toUzLabel(current);
    
    if (map.has(isoDate)) {
      result.push(map.get(isoDate)!);
    } else {
      result.push(defaultFactory(isoDate, label));
    }
    
    current.setDate(current.getDate() + 1);
  }
  
  return result;
}

// ===================================================================
// 1. KUNLIK BRONLAR TRENDI (Line chart)
// ===================================================================

export async function getDailyBookings(
  clinicId: string,
  range: ChartRange
): Promise<DailyPoint[]> {
  const { startDate, endDate } = getDateRange(range);
  
  const rows = await prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
    SELECT 
      DATE("createdAt") AS date,
      COUNT(*) AS count
    FROM appointments
    WHERE 
      "clinicId" = ${clinicId}
      AND "createdAt" >= ${startDate}
      AND "createdAt" <= ${endDate}
    GROUP BY DATE("createdAt")
    ORDER BY date ASC
  `;
  
  const raw: DailyPoint[] = rows.map(r => ({
    date: toIsoDate(new Date(r.date)),
    label: toUzLabel(new Date(r.date)),
    count: Number(r.count),
  }));
  
  return fillDateGaps(raw, startDate, endDate, (date, label) => ({
    date,
    label,
    count: 0,
  }));
}

// ===================================================================
// 2. KUNLIK DAROMAD TRENDI (Area chart)
// Faqat status='arrived' bronlar (haqiqiy daromad)
// ===================================================================

export async function getDailyRevenue(
  clinicId: string,
  range: ChartRange
): Promise<RevenuePoint[]> {
  const { startDate, endDate } = getDateRange(range);
  
  const rows = await prisma.$queryRaw<Array<{ date: Date; revenue: string | number }>>`
    SELECT 
      DATE(a."createdAt") AS date,
      COALESCE(SUM(s.price), 0) AS revenue
    FROM appointments a
    INNER JOIN services s ON s.id = a."serviceId"
    WHERE 
      a."clinicId" = ${clinicId}
      AND a."createdAt" >= ${startDate}
      AND a."createdAt" <= ${endDate}
      AND a.status = 'arrived'
    GROUP BY DATE(a."createdAt")
    ORDER BY date ASC
  `;
  
  const raw: RevenuePoint[] = rows.map(r => ({
    date: toIsoDate(new Date(r.date)),
    label: toUzLabel(new Date(r.date)),
    revenue: Number(r.revenue),
  }));
  
  return fillDateGaps(raw, startDate, endDate, (date, label) => ({
    date,
    label,
    revenue: 0,
  }));
}

// ===================================================================
// 3. XIZMATLAR BO'YICHA TAQSIMOT (Donut)
// ===================================================================

const SERVICE_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
];

export async function getServicesBreakdown(
  clinicId: string,
  range: ChartRange
): Promise<BreakdownItem[]> {
  const { startDate, endDate } = getDateRange(range);
  
  const rows = await prisma.$queryRaw<Array<{ id: string; name: string; count: bigint }>>`
    SELECT 
      s.id,
      s.name,
      COUNT(a.id) AS count
    FROM services s
    LEFT JOIN appointments a 
      ON a."serviceId" = s.id 
      AND a."createdAt" >= ${startDate}
      AND a."createdAt" <= ${endDate}
    WHERE s."clinicId" = ${clinicId}
      AND s."isActive" = true
    GROUP BY s.id, s.name
    HAVING COUNT(a.id) > 0
    ORDER BY count DESC
    LIMIT 10
  `;
  
  return rows.map((r, i) => ({
    id: r.id,
    name: r.name,
    value: Number(r.count),
    color: SERVICE_COLORS[i % SERVICE_COLORS.length],
  }));
}

// ===================================================================
// 4. STATUS TAQSIMOTI (Donut)
// ===================================================================

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  booked:    { label: 'Kutmoqda',     color: '#f59e0b' },
  arrived:   { label: 'Keldi',         color: '#10b981' },
  missed:    { label: 'Kelmadi',       color: '#ef4444' },
  cancelled: { label: 'Bekor qilindi', color: '#6b7280' },
};

export async function getStatusBreakdown(
  clinicId: string,
  range: ChartRange
): Promise<BreakdownItem[]> {
  const { startDate, endDate } = getDateRange(range);
  
  const rows = await prisma.$queryRaw<Array<{ status: string; count: bigint }>>`
    SELECT 
      status::text AS status,
      COUNT(*) AS count
    FROM appointments
    WHERE 
      "clinicId" = ${clinicId}
      AND "createdAt" >= ${startDate}
      AND "createdAt" <= ${endDate}
    GROUP BY status
    ORDER BY count DESC
  `;
  
  return rows.map(r => {
    const meta = STATUS_LABELS[r.status] ?? { label: r.status, color: '#9ca3af' };
    return {
      id: r.status,
      name: meta.label,
      value: Number(r.count),
      color: meta.color,
    };
  });
}

// ===================================================================
// 5. SHIFOKORLAR BO'YICHA BRONLAR (Bar)
// ===================================================================

const DOCTOR_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
];

export async function getDoctorsBreakdown(
  clinicId: string,
  range: ChartRange
): Promise<BreakdownItem[]> {
  const { startDate, endDate } = getDateRange(range);
  
  const rows = await prisma.$queryRaw<Array<{ 
    id: string; 
    firstName: string; 
    lastName: string; 
    specialty: string; 
    count: bigint 
  }>>`
    SELECT 
      d.id,
      d."firstName",
      d."lastName",
      d.specialty,
      COUNT(a.id) AS count
    FROM doctors d
    LEFT JOIN appointments a 
      ON a."doctorId" = d.id 
      AND a."createdAt" >= ${startDate}
      AND a."createdAt" <= ${endDate}
    WHERE d."clinicId" = ${clinicId}
      AND d."isActive" = true
    GROUP BY d.id, d."firstName", d."lastName", d.specialty
    HAVING COUNT(a.id) > 0
    ORDER BY count DESC
    LIMIT 10
  `;
  
  return rows.map((r, i) => ({
    id: r.id,
    // Mobile uchun qisqa label: "Yusupova D."
    name: `${r.lastName} ${r.firstName.charAt(0)}.`,
    value: Number(r.count),
    color: DOCTOR_COLORS[i % DOCTOR_COLORS.length],
  }));
}

// ===================================================================
// 6. SOATLAR BO'YICHA BRONLAR (Bar, 0-23)
// createdAt vaqtidan soat olinadi (klinika timezone'iga moslangan)
// ===================================================================

export async function getHourlyBreakdown(
  clinicId: string,
  range: ChartRange
): Promise<HourlyPoint[]> {
  const { startDate, endDate } = getDateRange(range);
  
  // Timezone Asia/Tashkent — DB time UTC bo'lsa 5 soatga oldinga
  const rows = await prisma.$queryRaw<Array<{ hour: number; count: bigint }>>`
    SELECT 
      EXTRACT(HOUR FROM "createdAt" AT TIME ZONE 'Asia/Tashkent')::int AS hour,
      COUNT(*) AS count
    FROM appointments
    WHERE 
      "clinicId" = ${clinicId}
      AND "createdAt" >= ${startDate}
      AND "createdAt" <= ${endDate}
    GROUP BY hour
    ORDER BY hour ASC
  `;
  
  const map = new Map(rows.map(r => [Number(r.hour), Number(r.count)]));
  
  const result: HourlyPoint[] = [];
  for (let h = 0; h < 24; h++) {
    result.push({
      hour: h,
      label: `${h.toString().padStart(2, '0')}:00`,
      count: map.get(h) ?? 0,
    });
  }
  
  return result;
}

// ===================================================================
// MASTER FUNCTION — barchasini parallel chaqirish
// ===================================================================

export async function getAllChartsData(
  clinicId: string,
  range: ChartRange
): Promise<ChartsResponse> {
  const { startDate, endDate } = getDateRange(range);
  
  // Parallel — performance uchun
  const [daily, revenue, services, statuses, doctors, hours] = await Promise.all([
    getDailyBookings(clinicId, range),
    getDailyRevenue(clinicId, range),
    getServicesBreakdown(clinicId, range),
    getStatusBreakdown(clinicId, range),
    getDoctorsBreakdown(clinicId, range),
    getHourlyBreakdown(clinicId, range),
  ]);
  
  return {
    range,
    startDate: toIsoDate(startDate),
    endDate: toIsoDate(endDate),
    daily,
    revenue,
    services,
    statuses,
    doctors,
    hours,
  };
}
```

### ⚠️ Texnik nuanslar

1. **`$queryRaw`** ishlatish sabablari:
   - Prisma `groupBy` `DATE()` cast ni qo'llab-quvvatlamaydi
   - SQL ko'p marta tez (raw aggregate)
   - Parametr injection xavfsiz (`${}` template literal — auto-sanitize)

2. **`bigint`** muammosi:
   - PostgreSQL `COUNT(*)` `bigint` qaytaradi
   - JSON serialize qila olmaydi
   - `Number()` bilan aylantirish **shart**

3. **Sana bo'shliqlari to'ldirish:**
   - `fillDateGaps` har sana uchun 0 yozadi (grafik silliq bo'ladi)
   - Aksincha — chart "tirnoqli" ko'rinadi

4. **Timezone:**
   - DB `timestamp without time zone` (UTC ehtimoli yuqori)
   - `AT TIME ZONE 'Asia/Tashkent'` — soatlarni mahalliy vaqtga konvert qiladi
   - clinic_settings'da `timezone='Asia/Tashkent'` mavjud

5. **Tartib (ORDER BY):**
   - Donut/Bar uchun `count DESC` — ko'p ko'rinadi
   - Line/Hours uchun `date/hour ASC` — vaqt tartibida

---

## 🌐 BOSQICH 3 — API ENDPOINT

### Fayl: `src/app/api/admin/stats/charts/route.ts`

```typescript
import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, error } from "@/lib/api-response";
import { getAllChartsData, type ChartRange } from "@/lib/stats/charts";

export const dynamic = 'force-dynamic'; // har so'rovda yangi data

const ALLOWED_RANGES: ChartRange[] = [7, 14, 30, 90];

export async function GET(req: NextRequest) {
  // Auth
  const auth = requireAuth(req);
  if (!auth) {
    return error("Unauthorized", 401);
  }
  
  // Faqat admin grafiklar
  if (auth.role !== 'super_admin' && auth.role !== 'clinic_admin') {
    return error("Forbidden — only admin can access this", 403);
  }
  
  // clinicId — admin uchun bu cookie/JWT'dan keladi
  const clinicId = auth.clinicId;
  if (!clinicId) {
    return error("Clinic not assigned to admin", 400);
  }
  
  // Range parameter (default 30)
  const { searchParams } = new URL(req.url);
  const rangeParam = parseInt(searchParams.get('range') ?? '30', 10);
  const range: ChartRange = (ALLOWED_RANGES.includes(rangeParam as ChartRange) 
    ? rangeParam 
    : 30) as ChartRange;
  
  try {
    const data = await getAllChartsData(clinicId, range);
    return ok(data);
  } catch (err) {
    console.error('[stats/charts] error:', err);
    return error(
      err instanceof Error ? err.message : "Charts data fetch failed",
      500
    );
  }
}
```

### ⚠️ Texnik nuanslar

1. **`export const dynamic = 'force-dynamic'`** — sahifa cache qilinmasligi (har doim yangi data)
2. **Allowed ranges** — faqat 7/14/30/90 qabul qilinadi, boshqasi → 30 ga fallback
3. **`auth.clinicId`** — sizning JWT payload'da bormi tekshiring. Yo'q bo'lsa, doctor/admin uchun `user.clinicId`'dan olinishi mumkin (tahlil paytida aniqlang)
4. **Error handling** — agar SQL xato bo'lsa, frontend uchun aniq xabar qaytaradi
5. **Audit log** — bu **read-only** GET endpoint, audit kerak emas (RLS ham faqat o'qish)

---

## 🎨 BOSQICH 4 — FRONTEND KOMPONENTLAR

### 4.1 — ChartCard (umumiy wrapper)

**Fayl:** `src/app/stats/components/ChartCard.tsx`

```tsx
"use client";
import { ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  icon?: string;
  children: ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  fullWidth?: boolean;
}

export default function ChartCard({
  title,
  subtitle,
  icon,
  children,
  loading = false,
  empty = false,
  emptyMessage = "Ma'lumot yo'q",
  fullWidth = false,
}: Props) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-4 ${fullWidth ? 'col-span-full' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            {icon && <span>{icon}</span>}
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      
      <div className="relative" style={{ minHeight: 240 }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm rounded-lg z-10">
            <div className="text-sm text-gray-400">Yuklanmoqda...</div>
          </div>
        )}
        
        {empty && !loading ? (
          <div className="flex items-center justify-center h-60 text-sm text-gray-400">
            {emptyMessage}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
```

### 4.2 — DateRangeFilter

**Fayl:** `src/app/stats/components/DateRangeFilter.tsx`

```tsx
"use client";

interface Props {
  value: 7 | 14 | 30 | 90;
  onChange: (v: 7 | 14 | 30 | 90) => void;
  disabled?: boolean;
}

const OPTIONS: Array<{ value: 7 | 14 | 30 | 90; label: string }> = [
  { value: 7,  label: '7 kun' },
  { value: 14, label: '14 kun' },
  { value: 30, label: '30 kun' },
  { value: 90, label: '90 kun' },
];

export default function DateRangeFilter({ value, onChange, disabled = false }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          disabled={disabled}
          className={`
            px-3 py-1.5 rounded-lg text-xs font-medium transition
            ${value === opt.value 
              ? 'bg-blue-600 text-white shadow-sm' 
              : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'}
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
```

### 4.3 — DailyBookingsChart (Line)

**Fayl:** `src/app/stats/components/DailyBookingsChart.tsx`

```tsx
"use client";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

interface DailyPoint {
  date: string;
  label: string;
  count: number;
}

interface Props {
  data: DailyPoint[];
}

export default function DailyBookingsChart({ data }: Props) {
  // Mobile uchun: agar 30+ kun bo'lsa, har 5-chi label
  const tickInterval = data.length > 30 ? Math.floor(data.length / 7) : 'preserveStartEnd';
  
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis 
          dataKey="label" 
          tick={{ fontSize: 11, fill: '#6b7280' }}
          interval={tickInterval as number | "preserveStartEnd"}
        />
        <YAxis 
          tick={{ fontSize: 11, fill: '#6b7280' }}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ fontWeight: 600, marginBottom: 4 }}
          formatter={(value: number) => [`${value} ta`, 'Bronlar']}
        />
        <Line 
          type="monotone" 
          dataKey="count" 
          stroke="#3b82f6" 
          strokeWidth={2.5}
          dot={{ r: 3, fill: '#3b82f6' }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

### 4.4 — DailyRevenueChart (Area)

**Fayl:** `src/app/stats/components/DailyRevenueChart.tsx`

```tsx
"use client";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

interface RevenuePoint {
  date: string;
  label: string;
  revenue: number;
}

interface Props {
  data: RevenuePoint[];
}

function formatSom(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return value.toString();
}

export default function DailyRevenueChart({ data }: Props) {
  const tickInterval = data.length > 30 ? Math.floor(data.length / 7) : 'preserveStartEnd';
  
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis 
          dataKey="label" 
          tick={{ fontSize: 11, fill: '#6b7280' }}
          interval={tickInterval as number | "preserveStartEnd"}
        />
        <YAxis 
          tick={{ fontSize: 11, fill: '#6b7280' }}
          tickFormatter={formatSom}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ fontWeight: 600, marginBottom: 4 }}
          formatter={(value: number) => [
            `${value.toLocaleString('uz-UZ')} so'm`,
            'Daromad',
          ]}
        />
        <Area 
          type="monotone" 
          dataKey="revenue" 
          stroke="#10b981" 
          strokeWidth={2.5}
          fill="url(#revenueGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
```

### 4.5 — ServicesDonutChart (Pie)

**Fayl:** `src/app/stats/components/ServicesDonutChart.tsx`

```tsx
"use client";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

interface BreakdownItem {
  id: string;
  name: string;
  value: number;
  color?: string;
}

interface Props {
  data: BreakdownItem[];
}

const RADIAN = Math.PI / 180;

function renderLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  if (percent < 0.05) return null; // 5%dan kam — label ko'rsatmaslik
  
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  
  return (
    <text 
      x={x} 
      y={y} 
      fill="white" 
      textAnchor={x > cx ? 'start' : 'end'} 
      dominantBaseline="central"
      fontSize={11}
      fontWeight={600}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

export default function ServicesDonutChart({ data }: Props) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="45%"
          labelLine={false}
          label={renderLabel}
          outerRadius={80}
          innerRadius={45}
          dataKey="value"
          paddingAngle={2}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color ?? '#9ca3af'} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value: number, name: string) => [
            `${value} ta (${total > 0 ? ((value / total) * 100).toFixed(1) : 0}%)`,
            name,
          ]}
        />
        <Legend 
          verticalAlign="bottom" 
          height={36}
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          iconType="circle"
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
```

### 4.6 — StatusDonutChart (Pie)

**Fayl:** `src/app/stats/components/StatusDonutChart.tsx`

Xuddi ServicesDonutChart kabi, lekin **mavjud komponentni qayta ishlatish yaxshiroq**.

```tsx
"use client";
import ServicesDonutChart from "./ServicesDonutChart";

interface BreakdownItem {
  id: string;
  name: string;
  value: number;
  color?: string;
}

interface Props {
  data: BreakdownItem[];
}

// Status donut — bir xil komponent, faqat boshqa rang sxemasi
export default function StatusDonutChart({ data }: Props) {
  return <ServicesDonutChart data={data} />;
}
```

⚠️ **Optimallashtirish:** ServicesDonutChart va StatusDonutChart bir xil — agar xohlasangiz, **bir komponent (`DonutChart`)** ga birlashtirish mumkin. Lekin alohida saqlash **kelajakda farqlash uchun** yaxshi (masalan, status uchun ikonkalar qo'shilishi mumkin).

### 4.7 — DoctorsBarChart (Bar)

**Fayl:** `src/app/stats/components/DoctorsBarChart.tsx`

```tsx
"use client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from "recharts";

interface BreakdownItem {
  id: string;
  name: string;
  value: number;
  color?: string;
}

interface Props {
  data: BreakdownItem[];
}

export default function DoctorsBarChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(240, data.length * 36)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
        <XAxis 
          type="number" 
          tick={{ fontSize: 11, fill: '#6b7280' }}
          allowDecimals={false}
        />
        <YAxis 
          type="category" 
          dataKey="name" 
          tick={{ fontSize: 11, fill: '#374151' }}
          width={100}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value: number) => [`${value} ta`, 'Bronlar']}
        />
        <Bar dataKey="value" radius={[0, 6, 6, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color ?? '#3b82f6'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
```

⚠️ **Mobile uchun:** vertical layout — mobile ekrandagi yon-aylanmaydigan bar chart. 10+ shifokor bo'lsa, sahifa scroll bo'ladi (`height = data.length * 36`).

### 4.8 — HoursBarChart (Bar)

**Fayl:** `src/app/stats/components/HoursBarChart.tsx`

```tsx
"use client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

interface HourlyPoint {
  hour: number;
  label: string;
  count: number;
}

interface Props {
  data: HourlyPoint[];
}

export default function HoursBarChart({ data }: Props) {
  // Faqat ish soatlari (07:00 - 21:00) ko'proq mantiqiy
  // Lekin to'liq 0-23 ham qoldiramiz, foydalanuvchi ko'rsin
  const maxCount = Math.max(...data.map(d => d.count), 1);
  
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis 
          dataKey="label" 
          tick={{ fontSize: 9, fill: '#6b7280' }}
          interval={1}
        />
        <YAxis 
          tick={{ fontSize: 11, fill: '#6b7280' }}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value: number) => [`${value} ta`, 'Bronlar']}
          labelFormatter={(label) => `Soat ${label}`}
        />
        <Bar 
          dataKey="count" 
          fill="#8b5cf6" 
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

### 4.9 — ChartsSection (asosiy konteyner)

**Fayl:** `src/app/stats/components/ChartsSection.tsx`

```tsx
"use client";
import { useState, useEffect, useCallback } from "react";
import DateRangeFilter from "./DateRangeFilter";
import ChartCard from "./ChartCard";
import DailyBookingsChart from "./DailyBookingsChart";
import DailyRevenueChart from "./DailyRevenueChart";
import ServicesDonutChart from "./ServicesDonutChart";
import StatusDonutChart from "./StatusDonutChart";
import DoctorsBarChart from "./DoctorsBarChart";
import HoursBarChart from "./HoursBarChart";

type Range = 7 | 14 | 30 | 90;

interface DailyPoint  { date: string; label: string; count: number; }
interface RevenuePoint { date: string; label: string; revenue: number; }
interface BreakdownItem { id: string; name: string; value: number; color?: string; }
interface HourlyPoint { hour: number; label: string; count: number; }

interface ChartsData {
  range: Range;
  startDate: string;
  endDate: string;
  daily: DailyPoint[];
  revenue: RevenuePoint[];
  services: BreakdownItem[];
  statuses: BreakdownItem[];
  doctors: BreakdownItem[];
  hours: HourlyPoint[];
}

export default function ChartsSection() {
  const [range, setRange] = useState<Range>(30);
  const [data, setData] = useState<ChartsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  
  const fetchCharts = useCallback(async (r: Range) => {
    setLoading(true);
    setErr(null);
    
    try {
      const res = await fetch(`/api/admin/stats/charts?range=${r}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const json = await res.json();
      
      if (!json.success) {
        setErr(json.error?.message ?? 'Ma\'lumot yuklanmadi');
        return;
      }
      
      setData(json.data);
    } catch (e) {
      setErr('Server bilan bog\'lanishda xato');
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchCharts(range);
  }, [range, fetchCharts]);
  
  if (err) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
        ⚠️ {err}
        <button 
          onClick={() => fetchCharts(range)} 
          className="ml-2 underline hover:no-underline"
        >
          Qayta urinish
        </button>
      </div>
    );
  }
  
  const hasData = data !== null;
  const totalBookings = data?.daily.reduce((s, d) => s + d.count, 0) ?? 0;
  
  return (
    <div className="space-y-4">
      {/* Filter va sarlavha */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-800">
            📊 Grafiklar va tahlillar
          </h2>
          {data && (
            <p className="text-xs text-gray-500 mt-0.5">
              {data.startDate} dan {data.endDate} gacha · Jami {totalBookings} bron
            </p>
          )}
        </div>
        
        <DateRangeFilter 
          value={range} 
          onChange={setRange} 
          disabled={loading}
        />
      </div>
      
      {/* Grafiklar grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        
        {/* 1. Kunlik bronlar */}
        <ChartCard
          title="Kunlik bronlar trendi"
          subtitle="Yangi bronlar har kun"
          icon="📈"
          loading={loading}
          empty={hasData && totalBookings === 0}
          emptyMessage="Bu davrda bronlar yo'q"
        >
          {data && <DailyBookingsChart data={data.daily} />}
        </ChartCard>
        
        {/* 2. Kunlik daromad */}
        <ChartCard
          title="Kunlik daromad"
          subtitle="Faqat keldi bronlardan (so'm)"
          icon="💰"
          loading={loading}
          empty={hasData && data.revenue.every(r => r.revenue === 0)}
          emptyMessage="Bu davrda daromad yo'q"
        >
          {data && <DailyRevenueChart data={data.revenue} />}
        </ChartCard>
        
        {/* 3. Xizmatlar */}
        <ChartCard
          title="Xizmatlar taqsimoti"
          subtitle="Qaysi xizmat ko'p so'raldi"
          icon="🥧"
          loading={loading}
          empty={hasData && data.services.length === 0}
          emptyMessage="Bu davrda xizmat ishlatilmagan"
        >
          {data && <ServicesDonutChart data={data.services} />}
        </ChartCard>
        
        {/* 4. Status */}
        <ChartCard
          title="Status taqsimoti"
          subtitle="Bron holatlari (konversiya)"
          icon="✅"
          loading={loading}
          empty={hasData && data.statuses.length === 0}
          emptyMessage="Ma'lumot yo'q"
        >
          {data && <StatusDonutChart data={data.statuses} />}
        </ChartCard>
        
        {/* 5. Shifokorlar — full width (vertical bar) */}
        <ChartCard
          title="Shifokorlar bo'yicha"
          subtitle="Eng band shifokorlar (TOP 10)"
          icon="👨‍⚕️"
          loading={loading}
          empty={hasData && data.doctors.length === 0}
          emptyMessage="Bu davrda shifokorlarga bron yo'q"
          fullWidth
        >
          {data && <DoctorsBarChart data={data.doctors} />}
        </ChartCard>
        
        {/* 6. Soatlar — full width */}
        <ChartCard
          title="Soatlar bo'yicha"
          subtitle="Kun davomida pik vaqtlar (Asia/Tashkent)"
          icon="⏰"
          loading={loading}
          empty={hasData && data.hours.every(h => h.count === 0)}
          emptyMessage="Ma'lumot yo'q"
          fullWidth
        >
          {data && <HoursBarChart data={data.hours} />}
        </ChartCard>
        
      </div>
    </div>
  );
}
```

---

## 🔧 BOSQICH 5 — Stats Page'ga integratsiya

### Fayl: `src/app/stats/page.tsx` (mavjud)

**Diagnostika natijasiga ko'ra harakat qiling:**

#### Holat A: Stats page Doctor va Admin uchun bitta fayl
Placeholder qatorini topib, **shartli render** qilish:

```tsx
// Mavjud kod yuqorida saqlanadi...

// Placeholder qatori:
// {/* "📈 Grafiklar va tahlillar — keyingi bosqichda qo'shiladi" */}

// O'zgartirish:
import ChartsSection from "./components/ChartsSection";

// Doctor placeholder qoladi:
{role === 'doctor' && (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center text-sm text-gray-400">
    📈 Grafiklar va tahlillar — keyingi bosqichda qo'shiladi
  </div>
)}

// Admin yangi blok:
{(role === 'super_admin' || role === 'clinic_admin') && (
  <ChartsSection />
)}
```

#### Holat B: Stats page rolega qarab alohida fayllar
Faqat **admin variantida** ChartsSection qo'shing, doctor variantida placeholder qoldiring.

⚠️ **MUHIM:** Sahifa role'ni qaerdan oladi? (cookie, JWT, server component, client fetch) — diagnostika paytida aniq ko'rsating. Yangi grafik bloki **admin role'da** ko'rinishi shart.

---

## 📦 BOSQICH 6 — Paket o'rnatish

```bash
npm install recharts
```

`package.json` da:
```json
{
  "dependencies": {
    "recharts": "^2.12.0"
  }
}
```

⚠️ Mavjud `prisma generate` postinstall ishlashi shart. `npm install`'dan keyin `prisma generate` chaqirilsa, hech narsa buzilmaydi.

---

## ✅ BOSQICH 7 — TEST VA VERIFIKATSIYA

### 7.1 — Lokal build test
```bash
npm run build
```
TypeScript xato bo'lmasligi shart. Recharts importlari to'g'ri keladi.

### 7.2 — Lokal dev test
```bash
npm run dev
```

1. Admin sifatida login: `+998900000000` / `admin123`
2. `/stats` ga o'ting
3. **Tepada** 8 ta KPI karta — saqlangan (tegilmagan) ✅
4. **Pastida** yangi blok:
   - "📊 Grafiklar va tahlillar"
   - 7/14/30/90 dropdown
   - 6 ta grafik
5. **30 kun** default tanlangan
6. **7 kun** bosing → barcha grafiklar yangilanadi
7. **90 kun** bosing → grafiklar 90 kunlik ma'lumot ko'rsatadi
8. Sahifa yangilash (F5) → 30 kun ga qaytadi

### 7.3 — Bo'sh ma'lumot xulq-atvori
1. **90 kun** tanlang — ma'lumotlar ko'rinmasa, "Bu davrda bronlar yo'q" xabari
2. Daromad — agar `arrived` yo'q bo'lsa "Bu davrda daromad yo'q"

### 7.4 — Doctor sifatida test
1. Doctor login: `+998901111111` / `doctor123`
2. `/stats` ga o'ting
3. Pastida hali ham **eski placeholder** ("Grafiklar va tahlillar — keyingi bosqichda")
4. Admin grafiklar **ko'rinmaydi** (faqat admin uchun)

### 7.5 — API direct test
```bash
# Admin cookie bilan
curl -X GET "https://tibtaqvim.vercel.app/api/admin/stats/charts?range=30" \
  -H "Cookie: auth_token=..." \
  -H "Content-Type: application/json"
```

Javob `success: true` va `data` ichida 6 ta array.

### 7.6 — Mobile test
- Telefon brauzeridan oching
- Grafiklar **bir ustun**da chiqishi shart
- Tooltip va legend o'qiladigan
- Touch — Pie slice'larni bossangiz tooltip chiqadi

### 7.7 — Production deploy
```bash
git add .
git commit -m "feat(stats): admin charts dashboard — 6 interactive charts with date range filter"
git push
```

---

## 📋 BAJARISH TARTIBI

### Qadam 1: Diagnostika
- Mavjud `src/app/stats/page.tsx` ni o'qib chiq
- Role aniqlash mexanizmini topish
- Placeholder qatori va admin section'ni aniqlash
- KPI API endpoint qaerda — topish
- Foydalanuvchiga hisobot

### Qadam 2: Paket
- `npm install recharts`
- `package.json` git'ga commit

### Qadam 3: Data layer
- `src/lib/stats/charts.ts` yaratish
- 6 ta aggregation funksiya
- `getAllChartsData` master function
- Lokal test (`tsx` script bilan ixtiyoriy)

### Qadam 4: API endpoint
- `src/app/api/admin/stats/charts/route.ts`
- Auth + role check
- Range validation
- Error handling

### Qadam 5: Komponentlar
- 9 ta fayl yaratish (ChartCard, DateRangeFilter, 6 ta Chart, ChartsSection)
- Har komponent alohida — Recharts importlari to'g'ri

### Qadam 6: Stats page integratsiya
- Placeholder o'rniga `<ChartsSection />` admin uchun
- Doctor placeholder saqlanadi
- Role-based conditional render

### Qadam 7: Build test
- `npm run build`
- TypeScript strict — xato bo'lmasligi

### Qadam 8: Commit + Push
```bash
git add .
git commit -m "feat(stats): admin charts dashboard with 6 interactive charts (Recharts)"
git push
```

### Qadam 9: Foydalanuvchiga ma'lumot

Quyidagi xabarni yuboring:

```
✅ Admin Charts Dashboard tayyor!

Bajarilgan ishlar (11 fayl):

YANGI FAYLLAR:
1. src/lib/stats/charts.ts — 6 aggregation funksiya
2. src/app/api/admin/stats/charts/route.ts — GET endpoint
3. src/app/stats/components/ChartCard.tsx
4. src/app/stats/components/DateRangeFilter.tsx
5. src/app/stats/components/DailyBookingsChart.tsx
6. src/app/stats/components/DailyRevenueChart.tsx
7. src/app/stats/components/ServicesDonutChart.tsx
8. src/app/stats/components/StatusDonutChart.tsx
9. src/app/stats/components/DoctorsBarChart.tsx
10. src/app/stats/components/HoursBarChart.tsx
11. src/app/stats/components/ChartsSection.tsx

O'ZGARTIRILGAN:
- src/app/stats/page.tsx — admin uchun ChartsSection qo'shildi
- package.json — recharts dependency

TEGILMAGAN:
- 8 ta KPI karta (Bugungi, Bu hafta...)
- Doctor /stats placeholder
- Auth, RLS, audit log
- queueMode, requiresSlot mantiqi

TEST:
1. https://tibtaqvim.vercel.app/login → admin
2. /stats — pastda 6 ta grafik
3. 7/14/30/90 dropdown — global filter
4. Mobile responsive
5. Bo'sh ma'lumot — chiroyli xabar
```

---

## ⚠️ XATO EHTIMOLI VA OLDINI OLISH

### Xato 1 — BigInt JSON serialization

**Sabab:** PostgreSQL `COUNT(*)` `bigint` qaytaradi.

**Yechim:** Hamma `Number(r.count)` ga aylantirish. **Hech qachon raw bigint qaytarmaslik**.

### Xato 2 — Decimal price

**Sabab:** `services.price` `Decimal` tipida.

**Yechim:** SQL ichida `SUM(s.price)` `numeric` qaytaradi — `Number()` bilan aylantirish.

### Xato 3 — Timezone noto'g'ri soatlar

**Sabab:** DB UTC, `Asia/Tashkent` UTC+5.

**Yechim:** `EXTRACT(HOUR FROM "createdAt" AT TIME ZONE 'Asia/Tashkent')`. Eslab qoling: clinic_settings'da `timezone='Asia/Tashkent'` bor.

### Xato 4 — `auth.clinicId` undefined

**Sabab:** JWT payload'da `clinicId` bo'lmasligi mumkin.

**Yechim:** Diagnostika paytida `auth` interface'ni o'qing. Agar `clinicId` yo'q bo'lsa, `user.clinicId`'dan olish:
```typescript
const user = await prisma.user.findUnique({
  where: { id: auth.userId },
  select: { clinicId: true },
});
const clinicId = user?.clinicId;
```

### Xato 5 — Recharts SSR error

**Sabab:** Recharts client-only.

**Yechim:** Har Chart komponent'da `"use client"` direktivi yuqorida.

### Xato 6 — Bo'sh ro'yxat Pie chart'da

**Sabab:** Recharts bo'sh data array bilan crash bo'lishi mumkin.

**Yechim:** ChartsSection'da `empty` prop — bo'sh bo'lsa "Ma'lumot yo'q" xabar.

### Xato 7 — Mobile'da label ko'rinmaydi

**Sabab:** Mobile ekrandagi label'lar siqilib ketadi.

**Yechim:** `XAxis interval` — har 5-chi label. Doctor bar — vertical layout.

### Xato 8 — Cache muammosi

**Sabab:** Next.js fetch caches.

**Yechim:** `cache: 'no-store'` va `export const dynamic = 'force-dynamic'`.

---

## 🎯 YAKUNIY MAQSAD

✅ Admin `/stats` sahifasida:
- 8 ta KPI karta (tegilmagan)
- Pastida 6 ta interaktiv grafik
- 7/14/30/90 kun dropdown filter
- Mobile responsive
- Loading state har grafikda
- Empty state — chiroyli xabar
- Real DB ma'lumotlari (mock yo'q)
- Real auth bilan himoyalangan
- Build error yo'q
- Deploy READY

✅ Doctor `/stats`:
- Eski placeholder saqlanadi
- Admin grafiklar ko'rinmaydi

---

## 🚀 BOSHLA

**Diagnostikadan boshlang, har bosqichdan keyin foydalanuvchidan tasdiq oling.**

Sifat birinchi, tezlik ikkinchi. Mavjud kontekst, auth, RLS, schema — **tegmasin**. Yangi grafiklar bloki — toza, alohida, izolyatsiyalangan.

Vaqt taxminan: 2-3 soat (sifat darajasida).
