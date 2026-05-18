# 🏥 VAZIFA: Multi-Clinic Poydevor — Bosqich 1

## 📌 LOYIHA KONTEKSTI

**Repo:** oqiljonplay-ctrl/tibtaqvim  
**Stack:** Next.js 14 (App Router) + Prisma 6 + Supabase PG17 + Vercel + Telegram Bot/WebApp  
**Production:** https://tibtaqvim.vercel.app  
**Supabase project_id:** `lxqimithjjabhnldcugc`  
**Vercel project_id:** `prj_U0d0bOMH4rj6Ao2JVeeQtGvgjKgJ`

---

## 🎯 MAQSAD

Multi-Clinic poydevorni qurish. Hozir 1 ta klinika bor (TibTaqvim), kelajakda **N ta klinika** bo'lishi kerak. Bu prompt **poydevor** — kelajakda Click/Payme to'lov, abonement boshqaruvi, klinika analitika osongina qo'shilishi uchun **nofaol joylar** ham qoldiriladi.

### Strategik tamoyillar (foydalanuvchi tasdiqlagan)

1. **SaaS modeli** — Tibtaqvim platforma, klinikalar mijoz. Pul **hech qachon** Tibtaqvim hisobiga tegmaydi
2. **Yuridik:** Faqat klinikalar Payme/Click bilan shartnoma qiladi (siz yuridik shaxs **emas**)
3. **Bemor flow:** Klinika → Filial → Xizmat → Shifokor → Sana → To'lov
4. **Admin flow:** clinic_admin avtomatik o'z klinika, super_admin tanlash
5. **Hozir kodda joy ochamiz, lekin faol qilmaymiz**:
   - `payment_config` ustun (Payme/Click keys, shifrlangan) — kelajak
   - `subscription_plan` ustun (starter/standard/premium) — kelajak
   - `service_branches` M2M jadval — kelajak (Variant C dan hybrid)

---

## 🛡 MUTLAQ QOIDALAR — Kontekstni buzmaslik

Bular **buzilmasligi shart**:

### Mavjud va tegilmaydi
- 6 ta admin KPI grafik (`/stats` admin section)
- Doctor `/stats` placeholder
- Doctor `/doctor` date picker
- 8 ta KPI karta
- Service-Doctor M2M (`service_doctors` jadval)
- queueMode tizimi (live/online/slot-disabled)
- `requiresSlot` UI yashirilgan (Bosqich 2 ga qadar)
- Specialty dropdown
- Cookie + JWT 24h auth
- Telegram webhook secret
- RLS 16/16 yoqilgan
- 19 ta audit trigger
- Recharts grafiklar
- Mavjud appointments (12 ta), services (9 ta), doctors (7 ta)

### Yangi qo'shiladi
- `clinics` ga 8 ta ustun (3 ta NOFAOL kelajak uchun)
- `branches` ga 5 ta ustun
- Public API'lar (klinika ro'yxati)
- Bot/Webapp flow yangi 2 qadam
- Admin super_admin CRUD
- Admin clinic_admin filial CRUD

### Backward compatibility
- Mavjud 1 ta klinika **avtomatik** to'liq sozlanadi (city='Toshkent', subscription_plan='premium', workingHours='08:00-20:00')
- Mavjud 1 ta filial **avtomatik** ma'lumotlar to'ldiriladi
- Mavjud appointments, services, doctors **tegilmaydi**
- Default clinicId mantiqi (DEFAULT_CLINIC_ID env) saqlanadi — yangi flow ham, eski flow ham ishlaydi

---

## 📊 MAVJUD SCHEMA HOLATI

### clinics jadvali (hozir)
```typescript
{
  id: string
  name: string
  phone: string | null
  address: string | null
  logoUrl: string | null
  isActive: boolean (default true)
  createdAt, updatedAt
  deletedAt: timestamp | null  // soft delete
}
```

### branches jadvali (hozir)
```typescript
{
  id: string
  clinicId: string  // FK
  name: string
  address: string | null
  phone: string | null
  isActive: boolean
  createdAt, updatedAt
}
```

### Mavjud ma'lumot
- **1 ta klinika** (TibTaqvim)
- **1 ta filial** (Asosiy filial)
- **9 ta xizmat**, **7 ta shifokor**, **12 ta appointment**

---

# 📋 ISH BOSQICHLARI

## BOSQICH 1 — DIAGNOSTIKA

### 1.1 — Mavjud fayllarni topish

```bash
# Schema
cat prisma/schema.prisma | grep -A 30 "model Clinic"
cat prisma/schema.prisma | grep -A 20 "model Branch"

# Auth
find src/lib -name "auth.ts" -o -name "jwt.ts"
find src -name "middleware.ts" | head -1

# API pattern (mavjud helper'lar)
find src/lib -name "api-response.ts"

# Bot va Webapp
find src/app -path "*webapp*" -name "page.tsx" | head -5
find src/app -path "*webhook*telegram*" -name "route.ts" | head -3

# Admin
find src/app/admin -name "page.tsx" | head -10
```

### 1.2 — Tushunish kerak

1. `requireAuth(req)` qaytaradi: `{ userId, role, clinicId, ... }` — to'liq tarkibi?
2. `clinicId` super_admin uchun mavjudmi yoki NULL?
3. Mavjud `DEFAULT_CLINIC_ID` env qaerda ishlatiladi?
4. Bot kontekst `bot_states.data` JSON qanday tuzilgan? (step, serviceId, doctorId...)
5. Webapp bosh sahifa qaerda? `/webapp` yoki `/`?
6. Admin login flow — clinic_admin clinicId qaerdan?

### 1.3 — Foydalanuvchiga hisobot

```
DIAGNOSTIKA HISOBOT:
✓ Schema: prisma/schema.prisma (Clinic, Branch modellari)
✓ Auth: src/lib/auth.ts (requireAuth helper)
✓ API helpers: src/lib/api-response.ts (ok, error)
✓ Middleware: src/middleware.ts
✓ Bot webhook: src/app/api/webhook/telegram/route.ts
✓ Bot states: src/lib/bot/states.ts (yoki ichida)
✓ Webapp bosh: src/app/webapp/page.tsx
✓ Admin layout: src/app/admin/layout.tsx
✓ DEFAULT_CLINIC_ID: process.env (qayerda ishlatiladi)

QUYIDAGI NOZIK JOYLAR ANIQLANDI:
- [Mavjud nozik joylarni yozish]

BOSHLASHGA TAYYORMAN. Bosqich 2 ga o'tamizmi?
```

---

## BOSQICH 2 — DATABASE MIGRATION

### 2.1 — Prisma schema o'zgarishi

**Fayl:** `prisma/schema.prisma`

#### Yangi enum'lar
```prisma
enum SubscriptionPlan {
  starter
  standard
  premium
}

enum SubscriptionStatus {
  trial
  active
  past_due
  suspended
  cancelled
}
```

#### Clinic model — kengaytirish
```prisma
model Clinic {
  id        String   @id @default(cuid())
  name      String
  phone     String?
  address   String?
  logoUrl   String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  deletedAt DateTime?

  // ===== YANGI USTUNLAR (Bosqich 1 — FAOL) =====
  
  /// Qisqa tavsif (bemor uchun)
  description String? @db.Text
  
  /// Shahar (filter uchun)
  city String?
  
  /// Ish vaqti (klinika umumiy, filial alohida bo'lishi mumkin)
  /// Format: "08:00-20:00" yoki "24/7" yoki "08:00-18:00 (Du-Sh)"
  workingHours String?
  
  /// O'rtacha reyting (kelajakda hisoblanadi)
  rating Float @default(0) @db.Real
  
  /// Reyting bahochilar soni
  ratingCount Int @default(0)

  // ===== KELAJAK UCHUN NOFAOL USTUNLAR =====
  // Bu ustunlar yaratiladi lekin Bosqich 1 da ishlatilmaydi.
  // Bosqich 2 (to'lov) va Bosqich 3 (abonement) da yoqiladi.

  /// To'lov sozlamalari (Payme/Click keys SHIFRLANGAN)
  /// Bosqich 2 da yoqiladi. Format:
  /// { "payme": { "merchantId": "...", "secretKey": "<encrypted>", "isActive": true, "isTestMode": false },
  ///   "click":  { "merchantId": "...", "serviceId": "...", "secretKey": "<encrypted>", "isActive": true } }
  paymentConfig Json? @db.JsonB
  
  /// Abonement reja (kelajak)
  subscriptionPlan SubscriptionPlan @default(starter)
  
  /// Abonement holati (kelajak)
  subscriptionStatus SubscriptionStatus @default(trial)
  
  /// Abonement tugash sanasi (kelajak)
  subscriptionExpiresAt DateTime?

  // ===== RELATIONS (mavjud, tegmaydi) =====
  branches        Branch[]
  services        Service[]
  doctors         Doctor[]
  appointments    Appointment[]
  users           User[]
  staff           Staff[]
  slots           Slot[]
  clinicSettings  ClinicSettings?
  featureFlags    FeatureFlag[]
  moduleConfigs   ModuleConfig[]

  @@index([isActive, city])
  @@index([subscriptionStatus])
  @@map("clinics")
}
```

#### Branch model — kengaytirish
```prisma
model Branch {
  id        String   @id @default(cuid())
  clinicId  String
  name      String
  address   String?
  phone     String?
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // ===== YANGI USTUNLAR (Bosqich 1 — FAOL) =====
  
  /// Google Maps koordinatalari (kelajakda "yaqin filiallar" uchun)
  latitude  Float? @db.DoublePrecision
  longitude Float? @db.DoublePrecision
  
  /// Yaqin metro stansiya (UX uchun)
  nearbyMetro String?
  
  /// Filial ish vaqti (klinika umumiyga override)
  /// Format: "08:00-20:00"
  workingHours String?
  
  /// Filialning saralash tartibi (UI uchun)
  sortOrder Int @default(0)

  // ===== RELATIONS (mavjud) =====
  clinic       Clinic        @relation(fields: [clinicId], references: [id])
  doctors      Doctor[]
  appointments Appointment[]
  staff        Staff[]
  slots        Slot[]
  
  // ===== KELAJAK UCHUN NOFAOL: service_branches M2M =====
  // Bosqich 1 da xizmatlar klinika darajasida qoladi.
  // Kelajakda agar har filial alohida xizmat berish kerak bo'lsa,
  // ServiceBranch jadvali qo'shiladi (commented out hozircha).

  @@index([clinicId, isActive])
  @@index([clinicId, sortOrder])
  @@map("branches")
}
```

### 2.2 — Migration yaratish

**MUHIM:** Prisma migrate ishlatish. Lekin chunki RLS yoqilgan va custom triggerlar bor, biz **dual-step** qilamiz:

#### Qadam 1 — Prisma schema o'zgartirib, migration yaratish
```bash
npx prisma migrate dev --name multiclinic_foundation --create-only
```

Bu **faqat SQL yaratadi**, ishga tushirmaydi. Yaratilgan faylni tekshirib chiqing:
- `prisma/migrations/YYYYMMDD_multiclinic_foundation/migration.sql`

#### Qadam 2 — Migration SQL'ga qo'shimcha
Yaratilgan SQL'ga **qo'shing** (oxirida):

```sql
-- ============================================================
-- BACKWARD COMPATIBILITY — Mavjud klinikani to'liq sozlash
-- ============================================================

-- Mavjud TibTaqvim klinikasini to'ldirish
UPDATE clinics SET
  city = COALESCE(city, 'Toshkent'),
  description = COALESCE(description, 'Tibbiy klinika — sifatli xizmatlar'),
  "workingHours" = COALESCE("workingHours", '08:00-20:00'),
  "subscriptionPlan" = 'premium',
  "subscriptionStatus" = 'active',
  "subscriptionExpiresAt" = NOW() + INTERVAL '1 year'
WHERE city IS NULL;

-- Mavjud Asosiy filialni to'ldirish
UPDATE branches SET
  "workingHours" = COALESCE("workingHours", '08:00-20:00')
WHERE "workingHours" IS NULL;

-- ============================================================
-- INDEXLAR
-- ============================================================
-- (Prisma avtomatik yaratadi, lekin qo'shimcha tekshirish)
-- @@index Prisma kompozit indexlarni yaratishi shart

-- ============================================================
-- RLS POLITIKALARI — yangi ustunlar uchun
-- ============================================================
-- RLS allaqachon yoqilgan, yangi ustunlar avtomatik shu policy'larga binoan ishlaydi.
-- Lekin payment_config maxsus himoya kerak: faqat super_admin va o'z clinic_admin

-- Hozircha skip — kelajakda Bosqich 2 (to'lov) da batafsil RLS yaratiladi
```

#### Qadam 3 — Migration'ni qo'lda ishga tushirish
```bash
npx prisma migrate deploy
npx prisma generate
```

**Tekshirish:**
```bash
# Schema yangilanganmi
npx prisma db pull --print
```

### 2.3 — Verifikatsiya SQL

```sql
-- Yangi ustunlar qo'shilganmi
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name='clinics' 
  AND column_name IN ('description','city','workingHours','rating','ratingCount','paymentConfig','subscriptionPlan','subscriptionStatus','subscriptionExpiresAt');
-- Natija: 9 qator

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name='branches' 
  AND column_name IN ('latitude','longitude','nearbyMetro','workingHours','sortOrder');
-- Natija: 5 qator

-- Mavjud klinika to'ldirilganmi
SELECT name, city, "workingHours", "subscriptionPlan", "subscriptionStatus" 
FROM clinics;
-- Natija: TibTaqvim, Toshkent, 08:00-20:00, premium, active

-- Migration finished
SELECT migration_name, finished_at FROM _prisma_migrations 
ORDER BY started_at DESC LIMIT 3;
```

### 2.4 — Commit
```bash
git add prisma/
git commit -m "feat(schema): multi-clinic foundation — clinics + branches kengaytirish (active fields + future-ready fields)"
```

**Foydalanuvchidan tasdiq olib** Bosqich 3 ga o'ting.

---

## BOSQICH 3 — PUBLIC API ENDPOINT'LAR

### 3.1 — Klinika ro'yxati endpoint

**Fayl:** `src/app/api/clinics/route.ts` (yangi)

```typescript
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, error } from "@/lib/api-response";

export const dynamic = 'force-dynamic';
export const revalidate = 60; // 1 daqiqa cache

/**
 * GET /api/clinics
 * 
 * Public endpoint — bemor uchun klinikalar ro'yxati
 * 
 * Query params:
 *   ?city=Toshkent       — shahar bo'yicha filter
 *   ?search=tibtaqvim    — qidiruv (name va description)
 *   ?limit=20            — default 50, max 100
 *   ?offset=0            — pagination
 * 
 * Faqat aktiv va subscription active klinikalar ko'rinadi.
 * Filiallar va shifokor sonini ham qaytaradi (ko'rinish uchun).
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const city = searchParams.get('city')?.trim() || undefined;
    const search = searchParams.get('search')?.trim() || undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);

    const where: any = {
      isActive: true,
      deletedAt: null,
      // Subscription aktivlik tekshiruvi — kelajakda Bosqich 3 da yoqiladi
      // Hozir hammasi ko'rinaveradi (subscriptionStatus 'trial' yoki 'active' bo'lsa ham)
      subscriptionStatus: { in: ['trial', 'active'] },
    };

    if (city) where.city = city;
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [clinics, total] = await Promise.all([
      prisma.clinic.findMany({
        where,
        select: {
          id: true,
          name: true,
          description: true,
          phone: true,
          address: true,
          logoUrl: true,
          city: true,
          workingHours: true,
          rating: true,
          ratingCount: true,
          // _count orqali shifokorlar va filiallar sonini olamiz
          _count: {
            select: {
              branches: { where: { isActive: true } },
              doctors: { where: { isActive: true } },
              services: { where: { isActive: true } },
            },
          },
        },
        orderBy: [
          { rating: 'desc' },
          { name: 'asc' },
        ],
        take: limit,
        skip: offset,
      }),
      prisma.clinic.count({ where }),
    ]);

    // Response format
    const data = clinics.map(c => ({
      id: c.id,
      name: c.name,
      description: c.description,
      phone: c.phone,
      address: c.address,
      logoUrl: c.logoUrl,
      city: c.city,
      workingHours: c.workingHours,
      rating: Number(c.rating ?? 0),
      ratingCount: c._count ? c.ratingCount : 0,
      branchCount: c._count.branches,
      doctorCount: c._count.doctors,
      serviceCount: c._count.services,
    }));

    return ok({ items: data, total, limit, offset });
  } catch (err) {
    console.error('[GET /api/clinics] error:', err);
    return error('Failed to fetch clinics', 500);
  }
}
```

### 3.2 — Bitta klinika endpoint

**Fayl:** `src/app/api/clinics/[id]/route.ts`

```typescript
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, error } from "@/lib/api-response";

export const dynamic = 'force-dynamic';

/**
 * GET /api/clinics/[id]
 * 
 * Bir klinika to'liq ma'lumot + filiallar (qisqa ro'yxat).
 * Bemor klinika tanlagandan keyin ko'radi.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const clinic = await prisma.clinic.findFirst({
      where: {
        id: params.id,
        isActive: true,
        deletedAt: null,
        subscriptionStatus: { in: ['trial', 'active'] },
      },
      select: {
        id: true,
        name: true,
        description: true,
        phone: true,
        address: true,
        logoUrl: true,
        city: true,
        workingHours: true,
        rating: true,
        ratingCount: true,
        branches: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            address: true,
            phone: true,
            workingHours: true,
            nearbyMetro: true,
            latitude: true,
            longitude: true,
            sortOrder: true,
            _count: {
              select: {
                doctors: { where: { isActive: true } },
              },
            },
          },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
        _count: {
          select: {
            doctors: { where: { isActive: true } },
            services: { where: { isActive: true } },
          },
        },
      },
    });

    if (!clinic) {
      return error('Clinic not found', 404);
    }

    return ok({
      id: clinic.id,
      name: clinic.name,
      description: clinic.description,
      phone: clinic.phone,
      address: clinic.address,
      logoUrl: clinic.logoUrl,
      city: clinic.city,
      workingHours: clinic.workingHours,
      rating: Number(clinic.rating ?? 0),
      ratingCount: clinic.ratingCount,
      doctorCount: clinic._count.doctors,
      serviceCount: clinic._count.services,
      branches: clinic.branches.map(b => ({
        id: b.id,
        name: b.name,
        address: b.address,
        phone: b.phone,
        workingHours: b.workingHours,
        nearbyMetro: b.nearbyMetro,
        latitude: b.latitude,
        longitude: b.longitude,
        doctorCount: b._count.doctors,
      })),
    });
  } catch (err) {
    console.error(`[GET /api/clinics/${params.id}] error:`, err);
    return error('Failed to fetch clinic', 500);
  }
}
```

### 3.3 — Filiallar endpoint (alohida)

**Fayl:** `src/app/api/clinics/[id]/branches/route.ts`

```typescript
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, error } from "@/lib/api-response";

export const dynamic = 'force-dynamic';

/**
 * GET /api/clinics/[id]/branches
 * 
 * Klinikaning barcha aktiv filiallari.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Klinika mavjudligi va aktivligini tekshirish
    const clinic = await prisma.clinic.findFirst({
      where: {
        id: params.id,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!clinic) return error('Clinic not found', 404);

    const branches = await prisma.branch.findMany({
      where: {
        clinicId: params.id,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        workingHours: true,
        nearbyMetro: true,
        latitude: true,
        longitude: true,
        sortOrder: true,
        _count: {
          select: {
            doctors: { where: { isActive: true } },
          },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });

    return ok(branches.map(b => ({
      id: b.id,
      name: b.name,
      address: b.address,
      phone: b.phone,
      workingHours: b.workingHours,
      nearbyMetro: b.nearbyMetro,
      latitude: b.latitude,
      longitude: b.longitude,
      doctorCount: b._count.doctors,
    })));
  } catch (err) {
    console.error(`[GET /api/clinics/${params.id}/branches] error:`, err);
    return error('Failed to fetch branches', 500);
  }
}
```

### 3.4 — Mavjud /api/services kengaytirish

**Fayl:** `src/app/api/services/route.ts` (mavjud — kengaytirish)

Mavjud handler tegilmaydi, faqat **filter qo'shiladi**:

```typescript
// Mavjud GET handler topiladi va shu qo'shimcha kiritiladi:

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  
  // YANGI: clinicId va branchId filterlar
  const clinicId = searchParams.get('clinicId') || process.env.DEFAULT_CLINIC_ID;
  const branchId = searchParams.get('branchId') || undefined;
  
  if (!clinicId) {
    return error('clinicId is required', 400);
  }

  // ⚠️ MUHIM: Mavjud filter va include mantiqi SAQLANADI
  // Faqat where clause'ga clinicId qo'shiladi
  
  const services = await prisma.service.findMany({
    where: {
      clinicId,        // YANGI — mavjud bo'lmagan bo'lsa qo'shiladi
      isActive: true,
      // Bosqich 1 — branchId hali services'da yo'q.
      // Bu kelajak Variant C (service_branches M2M) da yoqiladi.
      // Hozirda branchId parametr keladi lekin filter qilinmaydi (ignore).
    },
    include: {
      // Mavjud include (doctors va h.k.) SAQLANADI
      doctors: {
        where: { doctor: { isActive: true } },
        include: {
          doctor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              specialty: true,
              photoUrl: true,
              // YANGI: filial bo'yicha filter qilish uchun
              branchId: true,
            },
          },
        },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  // YANGI: Agar branchId berilgan bo'lsa, faqat shu filial shifokorlarini qaytarish
  let filtered = services;
  if (branchId) {
    filtered = services
      .map(s => ({
        ...s,
        doctors: s.doctors.filter(sd => sd.doctor.branchId === branchId),
      }))
      // Faqat shifokori bor xizmatlarni qoldirish
      .filter(s => s.doctors.length > 0 || s.type === 'diagnostic');
    // Diagnostika xizmatlari (qon tahlili, EKG) — shifokor majburiy emas
  }

  // Mavjud response format SAQLANADI
  // ...
  
  return ok(filtered);
}
```

⚠️ **MUHIM:** Mavjud handler'da response format va include mantiqi **batafsil tegilmaydi**. Faqat `where` ga `clinicId` qo'shiladi va `branchId` filter qo'shimcha.

### 3.5 — Verifikatsiya

```bash
# Build test
npm run build

# Lokal test (ixtiyoriy)
curl http://localhost:3000/api/clinics
curl http://localhost:3000/api/clinics/[id]
curl http://localhost:3000/api/clinics/[id]/branches
```

### 3.6 — Commit
```bash
git add src/app/api/
git commit -m "feat(api): public clinic endpoints + services clinicId filter"
```

---

## BOSQICH 4 — WEBAPP UI

### 4.1 — Klinika tanlash sahifa (yangi)

**Fayl:** `src/app/webapp/clinics/page.tsx` (yangi)

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface Clinic {
  id: string;
  name: string;
  description: string | null;
  phone: string | null;
  address: string | null;
  logoUrl: string | null;
  city: string | null;
  workingHours: string | null;
  rating: number;
  ratingCount: number;
  branchCount: number;
  doctorCount: number;
  serviceCount: number;
}

export default function ClinicsPage() {
  const router = useRouter();
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [city, setCity] = useState<string | null>(null);

  const fetchClinics = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (city) params.set('city', city);
      
      const res = await fetch(`/api/clinics?${params.toString()}`, {
        cache: 'no-store',
      });
      const json = await res.json();
      
      if (json.success) {
        setClinics(json.data.items || []);
      }
    } catch (err) {
      console.error('Klinikalar yuklashda xato:', err);
    } finally {
      setLoading(false);
    }
  }, [search, city]);

  useEffect(() => {
    const timer = setTimeout(fetchClinics, 300); // debounce
    return () => clearTimeout(timer);
  }, [fetchClinics]);

  const handleSelect = (clinicId: string) => {
    // Klinika tanlandi — branch sahifasiga o'tish
    // Yoki agar bitta filial bo'lsa, to'g'ridan xizmatlar sahifasiga
    router.push(`/webapp/clinics/${clinicId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm px-4 py-3 sticky top-0 z-10">
        <h1 className="text-xl font-bold text-gray-900">TibTaqvim</h1>
        <p className="text-xs text-gray-500 mt-0.5">Klinikani tanlang</p>
      </div>

      <div className="p-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Klinika qidirish..."
            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-12 text-gray-400">
            <div className="inline-block animate-spin mb-2">⏳</div>
            <p className="text-sm">Yuklanmoqda...</p>
          </div>
        )}

        {/* Empty */}
        {!loading && clinics.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p>🔍 Klinikalar topilmadi</p>
          </div>
        )}

        {/* Clinics list */}
        {!loading && clinics.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              {clinics.length} ta klinika topildi
            </p>
            
            {clinics.map(clinic => (
              <button
                key={clinic.id}
                onClick={() => handleSelect(clinic.id)}
                className="w-full bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-left hover:shadow-md transition active:scale-[0.98]"
              >
                <div className="flex items-start gap-3">
                  {/* Logo */}
                  <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center text-2xl">
                    {clinic.logoUrl ? (
                      <Image
                        src={clinic.logoUrl}
                        alt={clinic.name}
                        width={56}
                        height={56}
                        className="rounded-xl object-cover"
                      />
                    ) : (
                      '🏥'
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {clinic.name}
                    </h3>
                    
                    {clinic.rating > 0 && (
                      <p className="text-xs text-amber-600 mt-0.5">
                        ⭐ {clinic.rating.toFixed(1)} ({clinic.ratingCount} baho)
                      </p>
                    )}
                    
                    {clinic.address && (
                      <p className="text-xs text-gray-500 mt-1 truncate">
                        📍 {clinic.address}
                      </p>
                    )}
                    
                    {clinic.workingHours && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        🕐 {clinic.workingHours}
                      </p>
                    )}
                    
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">
                        👨‍⚕️ {clinic.doctorCount} shifokor
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full">
                        🏷 {clinic.serviceCount} xizmat
                      </span>
                      {clinic.branchCount > 1 && (
                        <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full">
                          🏥 {clinic.branchCount} filial
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="flex-shrink-0 text-gray-400">
                    →
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

### 4.2 — Klinika tafsiloti + filial tanlash sahifa

**Fayl:** `src/app/webapp/clinics/[id]/page.tsx` (yangi)

```tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

interface Branch {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  workingHours: string | null;
  nearbyMetro: string | null;
  latitude: number | null;
  longitude: number | null;
  doctorCount: number;
}

interface ClinicDetail {
  id: string;
  name: string;
  description: string | null;
  phone: string | null;
  address: string | null;
  logoUrl: string | null;
  city: string | null;
  workingHours: string | null;
  rating: number;
  ratingCount: number;
  doctorCount: number;
  serviceCount: number;
  branches: Branch[];
}

export default function ClinicDetailPage() {
  const router = useRouter();
  const params = useParams();
  const clinicId = params.id as string;
  
  const [clinic, setClinic] = useState<ClinicDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClinic = async () => {
      try {
        const res = await fetch(`/api/clinics/${clinicId}`, { cache: 'no-store' });
        const json = await res.json();
        if (json.success) setClinic(json.data);
      } catch (err) {
        console.error('Klinika yuklashda xato:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchClinic();
  }, [clinicId]);

  // ⚠️ MUHIM MANTIQ: Agar klinikada faqat 1 ta filial bo'lsa,
  // avtomatik to'g'ridan xizmatlar sahifasiga o'tish (filial tanlash kerak emas)
  useEffect(() => {
    if (clinic && clinic.branches.length === 1) {
      const branch = clinic.branches[0];
      router.replace(`/webapp/clinics/${clinicId}/branches/${branch.id}`);
    }
  }, [clinic, clinicId, router]);

  const handleSelectBranch = (branchId: string) => {
    router.push(`/webapp/clinics/${clinicId}/branches/${branchId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">⏳ Yuklanmoqda...</div>
      </div>
    );
  }

  if (!clinic) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">Klinika topilmadi</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm px-4 py-3 sticky top-0 z-10">
        <Link href="/webapp/clinics" className="text-sm text-blue-600">
          ← Klinikalar
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mt-1">{clinic.name}</h1>
        {clinic.workingHours && (
          <p className="text-xs text-gray-500 mt-0.5">🕐 {clinic.workingHours}</p>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Klinika ma'lumotlari */}
        {clinic.description && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-700">{clinic.description}</p>
          </div>
        )}

        {/* Filiallar */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">
            Filialni tanlang ({clinic.branches.length})
          </h2>
          
          <div className="space-y-2">
            {clinic.branches.map(branch => (
              <button
                key={branch.id}
                onClick={() => handleSelectBranch(branch.id)}
                className="w-full bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-left hover:shadow-md transition active:scale-[0.98]"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-xl flex items-center justify-center text-xl">
                    🏥
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900">
                      {branch.name}
                    </h3>
                    
                    {branch.address && (
                      <p className="text-xs text-gray-500 mt-1">
                        📍 {branch.address}
                      </p>
                    )}
                    
                    {branch.nearbyMetro && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        🚇 {branch.nearbyMetro}
                      </p>
                    )}
                    
                    {branch.workingHours && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        🕐 {branch.workingHours}
                      </p>
                    )}
                    
                    <p className="text-xs text-blue-700 mt-2">
                      👨‍⚕️ {branch.doctorCount} shifokor
                    </p>
                  </div>
                  
                  <div className="flex-shrink-0 text-gray-400">→</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

### 4.3 — Filial sahifasi (xizmatlar ro'yxati)

**Fayl:** `src/app/webapp/clinics/[id]/branches/[branchId]/page.tsx` (yangi)

Bu sahifa **mavjud webapp xizmatlar sahifasini** asosiy oladi. Faqat URL'da `clinicId` va `branchId` keladi va shu filter bilan API chaqiriladi.

```tsx
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

// ... (mavjud xizmatlar sahifasidan code import)

export default function BranchServicesPage() {
  const params = useParams();
  const clinicId = params.id as string;
  const branchId = params.branchId as string;
  
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        // ⚠️ Yangi: clinicId va branchId filter bilan
        const res = await fetch(
          `/api/services?clinicId=${clinicId}&branchId=${branchId}`,
          { cache: 'no-store' }
        );
        const json = await res.json();
        if (json.success) setServices(json.data || []);
      } catch (err) {
        console.error('Xizmatlar yuklashda xato:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchServices();
  }, [clinicId, branchId]);

  // ... (mavjud xizmatlar render kodi)
  // Bemorga ko'rinish bir xil — faqat keyin bron qilishda
  // clinicId va branchId localStorage'ga saqlanadi yoki URL'da o'tkaziladi
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm px-4 py-3 sticky top-0 z-10">
        <Link href={`/webapp/clinics/${clinicId}`} className="text-sm text-blue-600">
          ← Filiallar
        </Link>
        <h1 className="text-xl font-bold text-gray-900 mt-1">Xizmatlar</h1>
      </div>
      
      {/* Mavjud xizmatlar render */}
      {/* ⚠️ Bron yaratishda clinicId va branchId yuborilishi shart */}
    </div>
  );
}
```

⚠️ **MUHIM:** Mavjud webapp bron yaratish flow **clinicId va branchId** ni ham yuborishi kerak. Bu **POST /api/book** endpoint'iga ham qo'shiladi.

### 4.4 — Webapp bosh sahifa o'zgartirish

**Fayl:** `src/app/webapp/page.tsx` (mavjud — redirect qo'shish)

```tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function WebappHome() {
  const router = useRouter();
  
  useEffect(() => {
    // ⚠️ YANGI MANTIQ:
    // Webapp ochilganda — klinika tanlash sahifasiga o'tkazish.
    // Lekin agar foydalanuvchi avval klinika tanlagan bo'lsa,
    // to'g'ridan ushbu klinikaga o'tish (UX uchun)
    
    const lastClinicId = sessionStorage.getItem('selectedClinicId');
    const lastBranchId = sessionStorage.getItem('selectedBranchId');
    
    if (lastClinicId && lastBranchId) {
      router.replace(`/webapp/clinics/${lastClinicId}/branches/${lastBranchId}`);
    } else {
      router.replace('/webapp/clinics');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-gray-400">⏳ Yo'naltirilmoqda...</div>
    </div>
  );
}
```

⚠️ **MUHIM:** Mavjud webapp bosh sahifa kontentini **o'chirmaslik** — agar boshqa tarkib bo'lsa (Profilim shortcut, Uy xizmati shortcut), shu sahifaning yangi versiyasini "Klinikalar" + boshqa shortcut'lar bilan birga ishlatish mumkin.

**Alternativ yondashuv** (saqlash):
- `/webapp` — bosh sahifa qoladi
- "Yangi bron qilish" tugmasi `/webapp/clinics` ga olib boradi

### 4.5 — Bron yaratishda clinicId/branchId

**Fayl:** Mavjud bron yaratish komponentlari va `POST /api/book`

```typescript
// Mavjud handler'da:
const body = await req.json();

const clinicId = body.clinicId || process.env.DEFAULT_CLINIC_ID;
const branchId = body.branchId || undefined;

if (!clinicId) {
  return error('clinicId required', 400);
}

const appointment = await prisma.appointment.create({
  data: {
    clinicId,
    branchId,  // YANGI — agar berilsa
    serviceId: body.serviceId,
    doctorId: body.doctorId,
    // ... (mavjud maydonlar)
  },
});
```

### 4.6 — Verifikatsiya va Commit

```bash
npm run build
# Test
# /webapp/clinics — klinika ro'yxati ko'rinishi
# Klinika tanlash → /webapp/clinics/[id]
# Filiallar ko'rinishi
# 1 ta filial bo'lsa avtomatik o'tish
# Filial tanlash → xizmatlar

git add src/app/webapp/ src/app/api/
git commit -m "feat(webapp): clinic selection flow — clinics list + branch select + services filter"
```

---

## BOSQICH 5 — BOT FLOW O'ZGARISH

### 5.1 — Bot states kengaytirish

**Fayl:** Bot flow logic qaerda joylashgan (taxminan `src/app/api/webhook/telegram/route.ts` yoki `src/lib/bot/`)

Mavjud `bot_states.data` JSON tuzilishi taxminan:
```json
{
  "step": "select_service",
  "serviceId": "...",
  "doctorId": "...",
  "date": "..."
}
```

**Yangi tuzilish:**
```json
{
  "step": "select_clinic",
  "clinicId": "...",
  "branchId": "...",
  "serviceId": "...",
  "doctorId": "...",
  "date": "..."
}
```

### 5.2 — Yangi bot qadamlar

**Steplar:**
1. `select_clinic` (YANGI) — klinika tanlash
2. `select_branch` (YANGI, agar > 1 filial bo'lsa)
3. `select_service` (mavjud)
4. `select_doctor` (mavjud)
5. `select_date` (mavjud)
6. `confirm` (mavjud)

### 5.3 — Klinika tanlash xabari

```typescript
async function showClinicSelection(chatId: number) {
  const clinics = await prisma.clinic.findMany({
    where: { 
      isActive: true, 
      deletedAt: null,
      subscriptionStatus: { in: ['trial', 'active'] },
    },
    select: { id: true, name: true, city: true, workingHours: true },
    orderBy: { name: 'asc' },
    take: 20,
  });

  // Agar faqat 1 ta klinika bo'lsa — to'g'ridan o'tkazib yuborish
  if (clinics.length === 1) {
    await updateBotState(chatId, {
      clinicId: clinics[0].id,
      step: 'select_branch', // yoki select_service agar 1 filial
    });
    return showBranchOrService(chatId, clinics[0].id);
  }

  const keyboard = clinics.map(c => ([{
    text: `🏥 ${c.name}${c.city ? ` — ${c.city}` : ''}`,
    callback_data: `clinic:${c.id}`,
  }]));

  await bot.sendMessage(chatId, 
    '🏥 Salom! Klinikani tanlang:', 
    { reply_markup: { inline_keyboard: keyboard } }
  );
}
```

### 5.4 — Filial tanlash xabari

```typescript
async function showBranchSelection(chatId: number, clinicId: string) {
  const branches = await prisma.branch.findMany({
    where: { clinicId, isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });

  // Agar 1 ta filial — to'g'ridan o'tkazib yuborish
  if (branches.length === 1) {
    await updateBotState(chatId, {
      branchId: branches[0].id,
      step: 'select_service',
    });
    return showServiceSelection(chatId, clinicId, branches[0].id);
  }

  const keyboard = branches.map(b => ([{
    text: `🏥 ${b.name}${b.nearbyMetro ? ` (🚇 ${b.nearbyMetro})` : ''}`,
    callback_data: `branch:${b.id}`,
  }]));

  keyboard.push([{ text: '⬅️ Orqaga', callback_data: 'back:clinic' }]);

  await bot.sendMessage(chatId, 
    `📍 Filialni tanlang:`, 
    { reply_markup: { inline_keyboard: keyboard } }
  );
}
```

### 5.5 — Mavjud xizmat tanlash — clinic/branch filter

```typescript
async function showServiceSelection(chatId: number, clinicId: string, branchId?: string) {
  // Mavjud kod — faqat where ga clinicId qo'shiladi
  const services = await prisma.service.findMany({
    where: {
      clinicId,
      isActive: true,
    },
    include: {
      doctors: {
        where: { doctor: { isActive: true, ...(branchId ? { branchId } : {}) } },
      },
    },
  });
  
  // ... mavjud render mantiq
}
```

### 5.6 — Bot callback handler

```typescript
// Inline button callback'lar:
case 'clinic:': {
  const clinicId = data.split(':')[1];
  await updateBotState(chatId, { clinicId, step: 'select_branch' });
  return showBranchSelection(chatId, clinicId);
}

case 'branch:': {
  const branchId = data.split(':')[1];
  await updateBotState(chatId, { branchId, step: 'select_service' });
  return showServiceSelection(chatId, state.clinicId, branchId);
}

case 'back:clinic': {
  await updateBotState(chatId, { step: 'select_clinic' });
  return showClinicSelection(chatId);
}
```

### 5.7 — /start bilan boshlanishni o'zgartirish

Mavjud `/start` xabari quyidagicha ishlasin:

```typescript
async function handleStart(chatId: number, telegramId: string) {
  // Mavjud welcome xabari (Profilim, Uyga xizmat tugmalari) — saqlanadi
  await sendWelcomeMessage(chatId);
  
  // Keyin klinika tanlash:
  await showClinicSelection(chatId);
}
```

⚠️ **Backward compatibility:** Agar foydalanuvchi avval bron qilgan bo'lsa, ularning Profilim ishlab ketadi (chunki appointments'da clinicId allaqachon saqlangan).

### 5.8 — Commit
```bash
git add src/lib/bot/ src/app/api/webhook/
git commit -m "feat(bot): clinic + branch selection flow (auto-skip if single)"
```

---

## BOSQICH 6 — ADMIN PANEL — SUPER_ADMIN KLINIKA CRUD

### 6.1 — Klinikalar ro'yxati sahifasi

**Fayl:** `src/app/admin/clinics/page.tsx` (yangi)

Faqat `super_admin` ko'radi. `clinic_admin` ko'rmaydi.

```tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Clinic {
  id: string;
  name: string;
  phone: string | null;
  city: string | null;
  isActive: boolean;
  subscriptionPlan: string;
  subscriptionStatus: string;
  subscriptionExpiresAt: string | null;
  _count: {
    branches: number;
    doctors: number;
    appointments: number;
  };
}

export default function AdminClinicsPage() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClinics();
  }, []);

  const fetchClinics = async () => {
    try {
      const res = await fetch('/api/admin/clinics', { credentials: 'include' });
      const json = await res.json();
      if (json.success) setClinics(json.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-4 text-gray-400">Yuklanmoqda...</div>;

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Klinikalar</h1>
        <Link
          href="/admin/clinics/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
        >
          + Yangi klinika
        </Link>
      </div>

      <div className="space-y-3">
        {clinics.map(c => (
          <div key={c.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{c.name}</h3>
                <p className="text-xs text-gray-500 mt-1">
                  📍 {c.city || '—'} · {c.phone || '—'}
                </p>
                <div className="flex gap-2 mt-2">
                  <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">
                    🏥 {c._count.branches} filial
                  </span>
                  <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full">
                    👨‍⚕️ {c._count.doctors} shifokor
                  </span>
                  <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full">
                    📋 {c._count.appointments} bron
                  </span>
                </div>
                {/* Subscription badge (kelajak uchun ham ko'rsatamiz) */}
                <div className="flex gap-2 mt-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    c.subscriptionStatus === 'active' ? 'bg-green-50 text-green-700' :
                    c.subscriptionStatus === 'trial' ? 'bg-amber-50 text-amber-700' :
                    'bg-red-50 text-red-700'
                  }`}>
                    {c.subscriptionPlan} — {c.subscriptionStatus}
                  </span>
                </div>
              </div>
              <Link
                href={`/admin/clinics/${c.id}/edit`}
                className="text-blue-600 text-sm"
              >
                Tahrirlash
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 6.2 — Klinika yaratish/tahrirlash formasi

**Fayl:** `src/app/admin/clinics/new/page.tsx` va `src/app/admin/clinics/[id]/edit/page.tsx`

Yangi klinika formasida:

**Bosqich 1 maydonlari (FAOL):**
- Nomi *
- Tavsif
- Shahar (Toshkent default)
- Telefon
- Manzil
- Ish vaqti
- Logo URL

**Bosqich 1 default qiymatlar (NOFAOL):**
- `paymentConfig` — null (kelajakda alohida sahifa)
- `subscriptionPlan` — 'starter' (default)
- `subscriptionStatus` — 'trial' (yangi klinika 14 kun bepul)
- `subscriptionExpiresAt` — `NOW() + 14 kun` (trial period)

⚠️ **MUHIM:** Yangi klinika yaratilganda **avtomatik 1 ta filial yaratiladi** (`name: 'Asosiy filial'`) — chunki har klinikada hech bo'lmasa 1 ta filial bo'lishi shart.

⚠️ **MUHIM 2:** Yangi klinika yaratilganda **`clinic_settings` ham yaratiladi** (default qiymatlar bilan).

### 6.3 — Backend admin endpoint'lar

**Fayl:** `src/app/api/admin/clinics/route.ts` (yangi)

```typescript
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, error } from "@/lib/api-response";

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/clinics
 * Faqat super_admin
 */
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth) return error('Unauthorized', 401);
  if (auth.role !== 'super_admin') return error('Forbidden', 403);

  const clinics = await prisma.clinic.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      phone: true,
      address: true,
      city: true,
      isActive: true,
      subscriptionPlan: true,
      subscriptionStatus: true,
      subscriptionExpiresAt: true,
      createdAt: true,
      _count: {
        select: {
          branches: true,
          doctors: true,
          appointments: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return ok(clinics);
}

/**
 * POST /api/admin/clinics
 * Yangi klinika yaratish
 * Faqat super_admin
 */
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth) return error('Unauthorized', 401);
  if (auth.role !== 'super_admin') return error('Forbidden', 403);

  try {
    const body = await req.json();

    // Validation
    if (!body.name?.trim()) return error('Klinika nomi majburiy', 400);

    // Trial period — 14 kun
    const trialExpires = new Date();
    trialExpires.setDate(trialExpires.getDate() + 14);

    // Transactional: clinic + branch + settings birga
    const result = await prisma.$transaction(async (tx) => {
      // 1. Klinika yaratish
      const clinic = await tx.clinic.create({
        data: {
          name: body.name.trim(),
          description: body.description?.trim() || null,
          phone: body.phone?.trim() || null,
          address: body.address?.trim() || null,
          city: body.city?.trim() || 'Toshkent',
          workingHours: body.workingHours?.trim() || '08:00-20:00',
          logoUrl: body.logoUrl?.trim() || null,
          isActive: true,
          // Trial period
          subscriptionPlan: 'starter',
          subscriptionStatus: 'trial',
          subscriptionExpiresAt: trialExpires,
        },
      });

      // 2. Asosiy filial yaratish (avtomatik)
      const branch = await tx.branch.create({
        data: {
          clinicId: clinic.id,
          name: 'Asosiy filial',
          address: body.address?.trim() || null,
          phone: body.phone?.trim() || null,
          workingHours: body.workingHours?.trim() || '08:00-20:00',
          sortOrder: 0,
        },
      });

      // 3. Clinic settings yaratish (default qiymatlar)
      await tx.clinicSettings.create({
        data: {
          clinicId: clinic.id,
          // Boshqa default qiymatlar Prisma'da
        },
      });

      return { clinic, branch };
    });

    return ok(result.clinic);
  } catch (err) {
    console.error('[POST /api/admin/clinics] error:', err);
    return error('Failed to create clinic', 500);
  }
}
```

**Fayl:** `src/app/api/admin/clinics/[id]/route.ts` (yangi)

```typescript
// GET — bir klinika (super_admin uchun to'liq)
// PATCH — yangilash
// DELETE — soft delete (deletedAt)

// PATCH'da clinic_admin ham o'z klinikasini tahrirlashi mumkin (faqat ba'zi maydonlar)
// super_admin barcha maydonlarni o'zgartiradi (subscription'ni ham)
```

### 6.4 — Filial CRUD (clinic_admin uchun)

**Fayl:** `src/app/admin/branches/page.tsx`, `src/app/api/admin/branches/route.ts`

`clinic_admin` o'z klinikasi filiallarini boshqaradi. Mavjud admin layout'iga "Filiallar" navigation qo'shish.

### 6.5 — Commit
```bash
git add src/app/admin/clinics/ src/app/admin/branches/ src/app/api/admin/clinics/ src/app/api/admin/branches/
git commit -m "feat(admin): super_admin clinic CRUD + clinic_admin branch CRUD"
```

---

## BOSQICH 7 — RLS POLITIKALAR

### 7.1 — Yangi RLS

Bosqich 1 da yangi RLS minimal — mavjud RLS yaxshi ishlaydi. Lekin **payment_config** ustun himoyasi kerak:

```sql
-- payment_config faqat super_admin ko'rishi mumkin
-- (clinic_admin ham ko'rishi mumkin, lekin faqat o'z klinika)

-- Mavjud RLS policy'lariga binoan ishlaydi
-- (clinics jadval RLS yoqilgan, har rol o'ziga tegishli yozuvlarni ko'radi)
```

⚠️ Hozir maxsus policy yaratish shart emas — Bosqich 2 (to'lov) da payment_config ishlatilganda batafsil RLS yaratiladi.

---

## BOSQICH 8 — TEST VA VERIFIKATSIYA

### 8.1 — Build test
```bash
npm run build
```
TypeScript xato bo'lmasligi shart. Prisma client regenerate.

### 8.2 — Lokal manual test

#### Public flow
1. `/webapp` ochiladi → `/webapp/clinics` ga avtomatik o'tkaziladi
2. 1 ta klinika ko'rinadi (TibTaqvim)
3. Tanlash → `/webapp/clinics/[id]` → 1 ta filial → avtomatik o'tkazib `/branches/[id]` ga
4. Xizmatlar ro'yxati ko'rinadi (mavjud)
5. Bron qilish (mavjud flow, lekin clinicId va branchId yuboriladi)

#### Bot flow
1. `/start` → klinika tanlash xabari
2. 1 ta klinika bo'lsa avtomatik o'tkazib yuboriladi
3. Mavjud flow davom

#### Admin flow (super_admin)
1. Login: `+998999999999`
2. `/admin/clinics` → klinikalar ro'yxati
3. "Yangi klinika" → forma to'ldirish → saqlash
4. Yangi klinika yaratiladi + 1 ta filial avtomatik
5. Tahrirlash → ma'lumotlar yangilash

#### Admin flow (clinic_admin)
1. Login: `+998900000000` / `admin123`
2. `/admin/clinics` ga kirsa — 403 yoki redirect (ko'rmasligi kerak)
3. `/admin/branches` → o'z filiallari ro'yxati
4. Yangi filial yaratish
5. Tahrirlash

### 8.3 — Sinov klinika qo'shish

Real ma'lumot bilan test qilish uchun super_admin orqali 1-2 ta sinov klinika qo'shing:

```
2-klinika: "MediCare", city: "Toshkent"
  - Filial 1: "Yunusobod filiali"
  - Filial 2: "Mirzo Ulug'bek filiali"

3-klinika: "Sayfimed", city: "Samarqand"
  - Filial 1: "Markaziy filial"
```

Webapp ochilganda 3 ta klinika ko'rinishi shart.

### 8.4 — Deploy
```bash
git add .
git commit -m "feat: multi-clinic foundation (phase 1) — full integration"
git push
```

### 8.5 — Production tekshirish
- https://tibtaqvim.vercel.app/webapp/clinics — klinikalar ko'rinadi
- Bot `/start` — klinika tanlash xabari
- Admin paneldan klinika qo'shish

---

## ⚠️ MUHIM XATO EHTIMOLI VA OLDINI OLISH

### Xato 1 — Eski webapp bosh sahifa buziladi
**Sabab:** `/webapp` redirect qilamiz `/webapp/clinics` ga, lekin eski Profilim shortcut'lar bo'lishi mumkin.

**Yechim:** Mavjud `/webapp/page.tsx` ni o'qib, kontent yo'qolmasligini tekshirish. Agar muhim shortcut'lar bo'lsa — saqlash, "Yangi bron" tugmasi orqali `/webapp/clinics` ga ulanish.

### Xato 2 — Eski appointments clinicId yo'q
**Sabab:** appointments'da clinicId NOT NULL allaqachon — bu xato bo'lmaydi.

### Xato 3 — DEFAULT_CLINIC_ID env
**Sabab:** Mavjud kod `process.env.DEFAULT_CLINIC_ID` ishlatadi. Yangi flow'da clinicId URL'dan keladi.

**Yechim:** Mavjud env saqlanadi — fallback sifatida. Lekin yangi flow'da URL'dan o'tkaziladi.

### Xato 4 — Bot eski user (state'da clinicId yo'q)
**Sabab:** Eski bot foydalanuvchilarining state'ida clinicId yo'q.

**Yechim:** `select_clinic` qadami **majburiy** — har bron yaratish boshlanishi shu yerdan. Eski state DEFAULT_CLINIC_ID bilan to'ldiriladi (fallback).

### Xato 5 — Yangi klinika yaratilsa lekin filial yo'q
**Sabab:** Transaction xatosi.

**Yechim:** `prisma.$transaction` ishlatish — clinic + branch + settings birga.

### Xato 6 — Subscription expired klinika ko'rinmaydi
**Sabab:** Public API'da `subscriptionStatus: { in: ['trial', 'active'] }` filter.

**Yechim:** Hozir hammasi 'active' yoki 'trial' — muammo yo'q. Kelajakda 'past_due' va 'suspended' qachon paydo bo'lsa, klinika public'dan yashiriladi.

### Xato 7 — RLS clinic_admin boshqa klinika ko'rishi
**Sabab:** Yangi endpoint'da RLS to'g'ri filterlamasa.

**Yechim:** Har endpoint'da `auth.clinicId` ishlatish — Prisma where ga aniq qo'shish. RLS qo'shimcha himoya, lekin asosiy filter app darajasida.

### Xato 8 — Bot button callback uzun bo'lsa
**Sabab:** Telegram inline button callback_data max 64 byte.

**Yechim:** `clinic:cuid_short` — clinicId odatda 25 char (cuid), prefix bilan 32 char — OK.

---

## 📋 BAJARISH TARTIBI

### Ketma-ketlik (har qadamdan keyin tasdiq)

1. **Diagnostika** (Bosqich 1) → hisobot
2. **Schema migration** (Bosqich 2) → verifikatsiya SQL → tasdiq
3. **Public API** (Bosqich 3) → 3 ta endpoint → curl test
4. **Webapp UI** (Bosqich 4) → 3 ta sahifa + redirect
5. **Bot flow** (Bosqich 5) → klinika va filial tanlash
6. **Admin CRUD** (Bosqich 6) → super_admin + clinic_admin
7. **RLS check** (Bosqich 7) → mavjud RLS yetadi
8. **Test va deploy** (Bosqich 8) → production sinov

### Vaqt rejasi
- Bosqich 1: 10 daqiqa
- Bosqich 2: 30 daqiqa
- Bosqich 3: 30 daqiqa
- Bosqich 4: 60 daqiqa
- Bosqich 5: 45 daqiqa
- Bosqich 6: 60 daqiqa
- Bosqich 7: 5 daqiqa
- Bosqich 8: 30 daqiqa

**Jami: ~4.5 soat**

---

## 🎯 YAKUNIY MAQSAD

### Bosqich 1 tugagandan keyin

✅ **DB:**
- clinics: 8 ta yangi ustun (5 faol, 3 nofaol kelajak uchun)
- branches: 5 ta yangi ustun
- Migration qo'llanildi, RLS saqlandi

✅ **API:**
- GET /api/clinics — public, klinika ro'yxati
- GET /api/clinics/[id] — public, klinika tafsiloti
- GET /api/clinics/[id]/branches — public, filiallar
- GET /api/services — clinicId filter qo'shildi
- POST /api/admin/clinics — super_admin yaratish
- GET /api/admin/clinics — super_admin ro'yxat
- PATCH /api/admin/clinics/[id] — yangilash
- DELETE /api/admin/clinics/[id] — soft delete
- POST /api/admin/branches — clinic_admin filial yaratish
- (va boshqa CRUD)

✅ **Webapp:**
- `/webapp/clinics` — klinika tanlash sahifa
- `/webapp/clinics/[id]` — klinika tafsiloti + filial tanlash
- `/webapp/clinics/[id]/branches/[branchId]` — xizmatlar ro'yxati
- 1 ta filial bo'lsa avtomatik o'tkazib yuborish
- sessionStorage'da oxirgi tanlov saqlanadi (UX uchun)

✅ **Bot:**
- `select_clinic` va `select_branch` qadamlar qo'shildi
- 1 ta klinika/filial — avtomatik o'tkazib yuborish
- Mavjud bron flow saqlandi

✅ **Admin:**
- super_admin: klinikalar CRUD
- clinic_admin: filiallar CRUD (o'z klinika)
- super_admin layout'iga "Klinikalar" navigation
- clinic_admin layout'iga "Filiallar" navigation

✅ **Kelajak uchun:**
- `paymentConfig` JSONB — Bosqich 2 (Click/Payme) da yoqiladi
- `subscriptionPlan/Status` — Bosqich 3 (abonement) da yoqiladi
- `service_branches` M2M — Variant C kerak bo'lsa qo'shiladi

---

## 🚀 BOSHLA

1. Diagnostika hisobotini ber
2. Foydalanuvchi tasdiqi bilan har bosqichni ketma-ket bajarish
3. Har bosqichdan keyin commit + tasdiq
4. Yakuniy deploy + production test

**Sifat birinchi, tezlik ikkinchi. Backward compatibility — majburiy.**
