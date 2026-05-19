# Tibtaqvim — Faza 3: Filial CRUD + Filial Admin

> **Loyiha:** Tibtaqvim (Next.js App Router + Prisma + Supabase Postgres 17 + Vercel)
> **Repo:** `oqiljonplay-ctrl/tibtaqvim` | **Branch:** `main`
> **Oldingi fazalar:** Faza 1 (clinic edit + logo) ✅, Faza 2 (clinic admins) ✅
> **Stack:** TypeScript, Next.js (App Router), Prisma, bcrypt

---

## 🎯 Bu fazaning maqsadi

1. **Filial (Branch) CRUD** — super_admin **va** clinic_admin yarata olishi kerak
2. **Filial admin (`branch_admin` roli)** — filialga ulangan admin, faqat o'z filialida ishlaydi
3. **Permission qatlami:**
   - `super_admin` → barcha klinikalar va filiallar
   - `clinic_admin` → o'z klinikasining barcha filiallari
   - `branch_admin` → faqat o'z filiali
4. **Filial detail sahifasi** — Faza 2'dagi klinika detail kabi: tablar (Ma'lumotlar, Adminlar, Shifokorlar, Xizmatlar)
5. **Filial admin login** — Faza 2'dagi flow bilan bir xil (username + parol)

---

## ⚠️ MUHIM KOIDALAR (CHALG'IMASLIK UCHUN)

1. **Faqat Vazifa 3.1 → 3.8 tartibida bajar.**
2. **Schema migratsiyasi BIRINCHI qadam.** Migratsiya muvaffaqiyatsiz bo'lsa, qolgan ish ishlamaydi.
3. **`UserRole` enum'ga `branch_admin` qo'shish kerak.**
4. **`User.branchId` field qo'shish kerak** (nullable, faqat branch_admin'da to'ldiriladi).
5. **Username pattern `branch_admin` uchun: `tib_badmin_xxxxxx`** (Faza 2'dagi `tib_admin_` dan farqi). Shu pattern qat'iy.
6. **Permission helper'ni reusable qil** — `lib/permissions.ts`'ga joylash.
7. **Bcrypt salt rounds = 12** (Faza 2 bilan bir xil).
8. **Audit log MAJBURIY** har bir create/update/delete uchun.
9. **Soft delete:** filial o'chirilganda `isActive=false`, hard delete YO'Q.
10. **Filial o'chirilsa**, undagi `branch_admin`lar ham nofaol bo'lsin (cascade emas, manual update transaction ichida).
11. **TypeScript strict.** `any` ishlatma.
12. **Bu fazada Webapp O'ZGARMAYDI.** Faqat admin panel.
13. **`branches` table allaqachon mavjud** (Faza 0'da yaratilgan, hozir 2 row bor). Schema'ga qo'shimcha column **kerak emas** branches uchun. Faqat User'ga `branchId`.

---

## 📋 Vazifalar (tartib bilan)

### Vazifa 3.1 — Prisma schema migratsiyasi

**Fayl:** `prisma/schema.prisma`

**O'zgartirishlar:**

1. `UserRole` enum'ga `branch_admin` qo'shish
2. `User` modeliga `branchId` field qo'shish + relation

```prisma
enum UserRole {
  patient
  doctor
  clinic_admin
  branch_admin    // ← YANGI
  super_admin
}

model User {
  id           String   @id @default(cuid())
  clinicId     String?
  branchId     String?              // ← YANGI
  telegramId   String?  @unique
  tibId        String?  @unique
  phone        String?  @unique
  username     String?  @unique
  firstName    String
  lastName     String?
  role         UserRole @default(patient)
  passwordHash String?
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  
  clinic       Clinic?  @relation(fields: [clinicId], references: [id])
  branch       Branch?  @relation(fields: [branchId], references: [id])  // ← YANGI
  // ... boshqa relations o'zgarmaydi
  
  @@index([username])
  @@index([branchId])  // ← YANGI
  @@map("users")
}

model Branch {
  // ... mavjud field'lar saqlanadi
  // Faqat reverse relation qo'shish kerak (agar yo'q bo'lsa):
  admins       User[]   // ← YANGI yoki tekshirish
}
```

**Buyruqlar:**
```bash
npx prisma migrate dev --name add_branch_admin_role_and_user_branchid
npx prisma generate
```

**Tekshirish:**
```sql
-- Supabase SQL editor'da
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'branchId';

-- Enum tekshirish
SELECT enum_range(NULL::"UserRole");
-- Natijada: {patient,doctor,clinic_admin,branch_admin,super_admin}
```

---

### Vazifa 3.2 — Permission helper utility

**Fayl:** `lib/permissions.ts` (YANGI)

```typescript
import { UserRole } from '@prisma/client'

export type SessionUser = {
  id: string
  role: UserRole
  clinicId: string | null
  branchId: string | null
}

/**
 * Foydalanuvchi klinikani boshqara oladimi?
 */
export function canManageClinic(user: SessionUser, clinicId: string): boolean {
  if (user.role === 'super_admin') return true
  if (user.role === 'clinic_admin' && user.clinicId === clinicId) return true
  return false
}

/**
 * Foydalanuvchi filialni boshqara oladimi?
 */
export function canManageBranch(
  user: SessionUser,
  branchClinicId: string,
  branchId: string
): boolean {
  if (user.role === 'super_admin') return true
  if (user.role === 'clinic_admin' && user.clinicId === branchClinicId) return true
  if (user.role === 'branch_admin' && user.branchId === branchId) return true
  return false
}

/**
 * Foydalanuvchi klinikaga admin yarata oladimi?
 * (faqat super_admin yaratadi clinic_admin'ni, Faza 2 logikasi)
 */
export function canCreateClinicAdmin(user: SessionUser): boolean {
  return user.role === 'super_admin'
}

/**
 * Foydalanuvchi filialga admin yarata oladimi?
 * super_admin → istalgan filial
 * clinic_admin → o'z klinikasidagi filiallar
 */
export function canCreateBranchAdmin(
  user: SessionUser,
  branchClinicId: string
): boolean {
  if (user.role === 'super_admin') return true
  if (user.role === 'clinic_admin' && user.clinicId === branchClinicId) return true
  return false
}

/**
 * Filial ko'rish ruxsati (read)
 */
export function canViewBranch(
  user: SessionUser,
  branchClinicId: string,
  branchId: string
): boolean {
  return canManageBranch(user, branchClinicId, branchId)
}

/**
 * 403 response uchun shartcut
 */
export function forbidden(message = 'Forbidden') {
  return Response.json({ error: message }, { status: 403 })
}
```

---

### Vazifa 3.3 — Username generatorni kengaytirish

**Fayl:** `lib/admin-username.ts` (Faza 2'da yaratilgan, kengaytirish)

```typescript
import { prisma } from './prisma'

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'

/**
 * Username generatsiya: prefix + random suffix
 * @param prefix - 'tib_admin' (clinic_admin) yoki 'tib_badmin' (branch_admin)
 */
async function generateUsername(prefix: string): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    let suffix = ''
    for (let i = 0; i < 7; i++) {
      suffix += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
    }
    const username = `${prefix}_${suffix}`
    
    const exists = await prisma.user.findUnique({ where: { username } })
    if (!exists) return username
  }
  throw new Error('Username generatsiya qilishda muammo')
}

export async function generateAdminUsername(): Promise<string> {
  return generateUsername('tib_admin')
}

export async function generateBranchAdminUsername(): Promise<string> {
  return generateUsername('tib_badmin')
}

export function isValidUsername(username: string): boolean {
  return /^tib_b?admin_[a-z0-9]{6,8}$/.test(username)
}
```

---

### Vazifa 3.4 — Filial CRUD API

#### A) `GET /api/admin/clinics/[clinicId]/branches` va `POST`

**Fayl:** `app/api/admin/clinics/[clinicId]/branches/route.ts` (YANGI yoki yangilash)

> Eslatma: Faza 0'da `app/api/admin/branches` mavjud bo'lishi mumkin. Agar shu strukturada bo'lsa, **clinicId-nested route** qo'shish va eski endpointlar saqlansin (yoki redirect). **Diqqat:** route paramni `clinicId` (camelCase emas, URL'da kichik harf bilan, lekin Next.js folder nomi) — buni loyihangizdagi konventsiyaga moslashtiring. Quyidagi misol `clinicId` ishlatadi.

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { canManageClinic, forbidden } from '@/lib/permissions'

// GET — klinikaning filiallar ro'yxati
export async function GET(
  req: NextRequest,
  { params }: { params: { clinicId: string } }
) {
  const session = await getSession()
  if (!session) return forbidden('Avtorizatsiya kerak')
  
  if (!canManageClinic(session.user, params.clinicId)) {
    return forbidden()
  }
  
  const branches = await prisma.branch.findMany({
    where: { clinicId: params.clinicId },
    include: {
      _count: {
        select: {
          // doctors, services agar branchId bilan bog'langan bo'lsa
          admins: { where: { role: 'branch_admin', isActive: true } },
        },
      },
    },
    orderBy: [
      { isActive: 'desc' },
      { sortOrder: 'asc' },
      { createdAt: 'asc' },
    ],
  })
  
  return NextResponse.json({ branches, total: branches.length })
}

// POST — yangi filial yaratish
export async function POST(
  req: NextRequest,
  { params }: { params: { clinicId: string } }
) {
  const session = await getSession()
  if (!session) return forbidden('Avtorizatsiya kerak')
  
  if (!canManageClinic(session.user, params.clinicId)) {
    return forbidden()
  }
  
  // Klinika mavjudligi
  const clinic = await prisma.clinic.findUnique({ where: { id: params.clinicId } })
  if (!clinic) {
    return NextResponse.json({ error: 'Klinika topilmadi' }, { status: 404 })
  }
  
  const body = await req.json()
  const {
    name, address, phone, latitude, longitude,
    nearbyMetro, workingHours, sortOrder
  } = body
  
  // Validatsiya
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return NextResponse.json({ error: 'Filial nomi noto\'g\'ri' }, { status: 400 })
  }
  if (!address || typeof address !== 'string' || address.trim().length < 5) {
    return NextResponse.json({ error: 'Manzil kerak (kamida 5 belgi)' }, { status: 400 })
  }
  
  // Koordinatalar (agar berilgan bo'lsa)
  if (latitude !== undefined && latitude !== null) {
    if (typeof latitude !== 'number' || latitude < -90 || latitude > 90) {
      return NextResponse.json({ error: 'Latitude noto\'g\'ri' }, { status: 400 })
    }
  }
  if (longitude !== undefined && longitude !== null) {
    if (typeof longitude !== 'number' || longitude < -180 || longitude > 180) {
      return NextResponse.json({ error: 'Longitude noto\'g\'ri' }, { status: 400 })
    }
  }
  
  const branch = await prisma.branch.create({
    data: {
      clinicId: params.clinicId,
      name: name.trim(),
      address: address.trim(),
      phone: phone?.trim() || null,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      nearbyMetro: nearbyMetro?.trim() || null,
      workingHours: workingHours?.trim() || null,
      sortOrder: typeof sortOrder === 'number' ? sortOrder : 0,
      isActive: true,
    },
  })
  
  await prisma.auditLog.create({
    data: {
      actorId: session.user.id,
      clinicId: params.clinicId,
      action: 'branch.create',
      payload: { branchId: branch.id, name: branch.name },
    },
  })
  
  return NextResponse.json({ branch }, { status: 201 })
}
```

#### B) `GET`, `PATCH`, `DELETE /api/admin/clinics/[clinicId]/branches/[branchId]`

**Fayl:** `app/api/admin/clinics/[clinicId]/branches/[branchId]/route.ts` (YANGI)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { canManageClinic, canManageBranch, forbidden } from '@/lib/permissions'

// GET — filial detail
export async function GET(
  req: NextRequest,
  { params }: { params: { clinicId: string; branchId: string } }
) {
  const session = await getSession()
  if (!session) return forbidden('Avtorizatsiya kerak')
  
  if (!canManageBranch(session.user, params.clinicId, params.branchId)) {
    return forbidden()
  }
  
  const branch = await prisma.branch.findFirst({
    where: {
      id: params.branchId,
      clinicId: params.clinicId,
    },
    include: {
      _count: {
        select: {
          admins: { where: { role: 'branch_admin', isActive: true } },
        },
      },
    },
  })
  
  if (!branch) {
    return NextResponse.json({ error: 'Filial topilmadi' }, { status: 404 })
  }
  
  return NextResponse.json({ branch })
}

// PATCH — filial yangilash
export async function PATCH(
  req: NextRequest,
  { params }: { params: { clinicId: string; branchId: string } }
) {
  const session = await getSession()
  if (!session) return forbidden('Avtorizatsiya kerak')
  
  if (!canManageClinic(session.user, params.clinicId)) {
    return forbidden()
  }
  
  const branch = await prisma.branch.findFirst({
    where: { id: params.branchId, clinicId: params.clinicId },
  })
  if (!branch) {
    return NextResponse.json({ error: 'Filial topilmadi' }, { status: 404 })
  }
  
  const body = await req.json()
  const allowed = ['name', 'address', 'phone', 'latitude', 'longitude', 
                   'nearbyMetro', 'workingHours', 'sortOrder', 'isActive']
  const data: Record<string, any> = {}
  
  for (const key of allowed) {
    if (key in body) data[key] = body[key]
  }
  
  // Validatsiya (qisqartirilgan, POST'dagi kabi)
  if (data.name !== undefined && (typeof data.name !== 'string' || data.name.trim().length < 2)) {
    return NextResponse.json({ error: 'Filial nomi noto\'g\'ri' }, { status: 400 })
  }
  if (data.name) data.name = data.name.trim()
  if (data.address) data.address = data.address.trim()
  
  const updated = await prisma.branch.update({
    where: { id: params.branchId },
    data,
  })
  
  await prisma.auditLog.create({
    data: {
      actorId: session.user.id,
      clinicId: params.clinicId,
      action: 'branch.update',
      payload: { branchId: params.branchId, changes: Object.keys(data) },
    },
  })
  
  return NextResponse.json({ branch: updated })
}

// DELETE — soft delete + filial admin'larini nofaol qilish
export async function DELETE(
  req: NextRequest,
  { params }: { params: { clinicId: string; branchId: string } }
) {
  const session = await getSession()
  if (!session) return forbidden('Avtorizatsiya kerak')
  
  if (!canManageClinic(session.user, params.clinicId)) {
    return forbidden()
  }
  
  const branch = await prisma.branch.findFirst({
    where: { id: params.branchId, clinicId: params.clinicId },
  })
  if (!branch) {
    return NextResponse.json({ error: 'Filial topilmadi' }, { status: 404 })
  }
  
  // Transaction: filialni nofaol qilish + uning adminlarini ham nofaol qilish
  await prisma.$transaction([
    prisma.branch.update({
      where: { id: params.branchId },
      data: { isActive: false },
    }),
    prisma.user.updateMany({
      where: { branchId: params.branchId, role: 'branch_admin' },
      data: { isActive: false },
    }),
  ])
  
  await prisma.auditLog.create({
    data: {
      actorId: session.user.id,
      clinicId: params.clinicId,
      action: 'branch.delete',
      payload: { branchId: params.branchId, name: branch.name },
    },
  })
  
  return NextResponse.json({ success: true })
}
```

---

### Vazifa 3.5 — Filial admin API

#### A) `GET` va `POST /api/admin/clinics/[clinicId]/branches/[branchId]/admins`

**Fayl:** `app/api/admin/clinics/[clinicId]/branches/[branchId]/admins/route.ts` (YANGI)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { canCreateBranchAdmin, canManageBranch, forbidden } from '@/lib/permissions'
import { generateBranchAdminUsername } from '@/lib/admin-username'
import { hashPassword, validatePasswordStrength, generateRandomPassword } from '@/lib/password'

// GET — filialning adminlar ro'yxati
export async function GET(
  req: NextRequest,
  { params }: { params: { clinicId: string; branchId: string } }
) {
  const session = await getSession()
  if (!session) return forbidden('Avtorizatsiya kerak')
  
  if (!canManageBranch(session.user, params.clinicId, params.branchId)) {
    return forbidden()
  }
  
  const branch = await prisma.branch.findFirst({
    where: { id: params.branchId, clinicId: params.clinicId },
  })
  if (!branch) {
    return NextResponse.json({ error: 'Filial topilmadi' }, { status: 404 })
  }
  
  const admins = await prisma.user.findMany({
    where: {
      branchId: params.branchId,
      role: 'branch_admin',
    },
    select: {
      id: true, username: true, firstName: true, lastName: true,
      phone: true, isActive: true, createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  })
  
  return NextResponse.json({ admins, total: admins.length })
}

// POST — yangi filial admin yaratish
export async function POST(
  req: NextRequest,
  { params }: { params: { clinicId: string; branchId: string } }
) {
  const session = await getSession()
  if (!session) return forbidden('Avtorizatsiya kerak')
  
  if (!canCreateBranchAdmin(session.user, params.clinicId)) {
    return forbidden('Filialga admin yaratish ruxsati yo\'q')
  }
  
  // Filial mavjudligi + klinikaga tegishliligi
  const branch = await prisma.branch.findFirst({
    where: { id: params.branchId, clinicId: params.clinicId, isActive: true },
  })
  if (!branch) {
    return NextResponse.json({ error: 'Filial topilmadi yoki nofaol' }, { status: 404 })
  }
  
  const body = await req.json()
  const { firstName, lastName, phone, password, autoPassword } = body
  
  // Validatsiya
  if (!firstName || typeof firstName !== 'string' || firstName.trim().length < 2) {
    return NextResponse.json({ error: 'Ism kamida 2 belgi bo\'lishi kerak' }, { status: 400 })
  }
  
  if (phone) {
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length < 9 || cleaned.length > 12) {
      return NextResponse.json({ error: 'Telefon noto\'g\'ri' }, { status: 400 })
    }
    const existing = await prisma.user.findUnique({ where: { phone } })
    if (existing) {
      return NextResponse.json({ error: 'Telefon band' }, { status: 409 })
    }
  }
  
  let finalPassword: string
  if (autoPassword) {
    finalPassword = generateRandomPassword(12)
  } else {
    if (!password) return NextResponse.json({ error: 'Parol kerak' }, { status: 400 })
    const check = validatePasswordStrength(password)
    if (!check.valid) return NextResponse.json({ error: check.error }, { status: 400 })
    finalPassword = password
  }
  
  const username = await generateBranchAdminUsername()
  const passwordHash = await hashPassword(finalPassword)
  
  const newAdmin = await prisma.user.create({
    data: {
      clinicId: params.clinicId,
      branchId: params.branchId,
      username,
      firstName: firstName.trim(),
      lastName: lastName?.trim() || null,
      phone: phone || null,
      passwordHash,
      role: 'branch_admin',
      isActive: true,
    },
    select: {
      id: true, username: true, firstName: true, lastName: true,
      phone: true, isActive: true, createdAt: true,
    },
  })
  
  await prisma.auditLog.create({
    data: {
      actorId: session.user.id,
      clinicId: params.clinicId,
      action: 'branch_admin.create',
      payload: {
        adminId: newAdmin.id,
        branchId: params.branchId,
        username: newAdmin.username,
        autoGeneratedPassword: !!autoPassword,
      },
    },
  })
  
  return NextResponse.json({
    admin: newAdmin,
    credentials: { username, password: finalPassword },
  }, { status: 201 })
}
```

#### B) `PATCH`, `DELETE /api/admin/clinics/[clinicId]/branches/[branchId]/admins/[adminId]`

**Fayl:** `app/api/admin/clinics/[clinicId]/branches/[branchId]/admins/[adminId]/route.ts` (YANGI)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { canCreateBranchAdmin, forbidden } from '@/lib/permissions'
import { hashPassword, validatePasswordStrength, generateRandomPassword } from '@/lib/password'

type RouteParams = {
  params: { clinicId: string; branchId: string; adminId: string }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await getSession()
  if (!session) return forbidden('Avtorizatsiya kerak')
  
  if (!canCreateBranchAdmin(session.user, params.clinicId)) {
    return forbidden()
  }
  
  const admin = await prisma.user.findFirst({
    where: {
      id: params.adminId,
      branchId: params.branchId,
      clinicId: params.clinicId,
      role: 'branch_admin',
    },
  })
  if (!admin) {
    return NextResponse.json({ error: 'Admin topilmadi' }, { status: 404 })
  }
  
  const body = await req.json()
  const { firstName, lastName, phone, isActive, resetPassword, newPassword } = body
  
  const data: Record<string, any> = {}
  
  if (firstName !== undefined) {
    if (typeof firstName !== 'string' || firstName.trim().length < 2) {
      return NextResponse.json({ error: 'Ism noto\'g\'ri' }, { status: 400 })
    }
    data.firstName = firstName.trim()
  }
  if (lastName !== undefined) data.lastName = lastName?.trim() || null
  if (phone !== undefined) {
    if (phone) {
      const existing = await prisma.user.findFirst({
        where: { phone, id: { not: params.adminId } },
      })
      if (existing) return NextResponse.json({ error: 'Telefon band' }, { status: 409 })
    }
    data.phone = phone || null
  }
  if (isActive !== undefined) data.isActive = Boolean(isActive)
  
  let returnedPassword: string | null = null
  if (resetPassword) {
    const pwd = newPassword || generateRandomPassword(12)
    if (newPassword) {
      const check = validatePasswordStrength(newPassword)
      if (!check.valid) return NextResponse.json({ error: check.error }, { status: 400 })
    }
    data.passwordHash = await hashPassword(pwd)
    returnedPassword = pwd
  }
  
  const updated = await prisma.user.update({
    where: { id: params.adminId },
    data,
    select: {
      id: true, username: true, firstName: true, lastName: true,
      phone: true, isActive: true, updatedAt: true,
    },
  })
  
  await prisma.auditLog.create({
    data: {
      actorId: session.user.id,
      clinicId: params.clinicId,
      action: resetPassword ? 'branch_admin.reset_password' : 'branch_admin.update',
      payload: {
        adminId: params.adminId,
        branchId: params.branchId,
        changes: Object.keys(data).filter(k => k !== 'passwordHash'),
      },
    },
  })
  
  return NextResponse.json({
    admin: updated,
    ...(returnedPassword ? { newPassword: returnedPassword } : {}),
  })
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const session = await getSession()
  if (!session) return forbidden('Avtorizatsiya kerak')
  
  if (!canCreateBranchAdmin(session.user, params.clinicId)) {
    return forbidden()
  }
  
  const admin = await prisma.user.findFirst({
    where: {
      id: params.adminId,
      branchId: params.branchId,
      role: 'branch_admin',
    },
  })
  if (!admin) return NextResponse.json({ error: 'Admin topilmadi' }, { status: 404 })
  
  await prisma.user.update({
    where: { id: params.adminId },
    data: { isActive: false },
  })
  
  await prisma.auditLog.create({
    data: {
      actorId: session.user.id,
      clinicId: params.clinicId,
      action: 'branch_admin.delete',
      payload: {
        adminId: params.adminId,
        branchId: params.branchId,
        username: admin.username,
      },
    },
  })
  
  return NextResponse.json({ success: true })
}
```

---

### Vazifa 3.6 — UI: BranchesTab (Faza 2'dagi placeholder o'rniga)

**Fayl:** `app/(panel)/admin/super/clinics/[id]/BranchesTab.tsx` (YANGI)

Va Faza 2'dagi klinika detail sahifasi (`page.tsx`)'da `BranchesTab`'ni import qil va placeholder o'rniga qo'y:

```tsx
// app/(panel)/admin/super/clinics/[id]/page.tsx ichida:
import { BranchesTab } from './BranchesTab'

// Tab content qismida:
{tab === 'branches' && <BranchesTab clinicId={clinicId} />}
```

**`BranchesTab.tsx` kodi:**

```tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { CreateBranchModal } from './CreateBranchModal'

type Branch = {
  id: string
  name: string
  address: string
  phone: string | null
  workingHours: string | null
  isActive: boolean
  sortOrder: number
  _count: { admins: number }
}

export function BranchesTab({ clinicId }: { clinicId: string }) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  
  const load = async () => {
    setLoading(true)
    const res = await fetch(`/api/admin/clinics/${clinicId}/branches`)
    const data = await res.json()
    setBranches(data.branches || [])
    setLoading(false)
  }
  
  useEffect(() => { load() }, [clinicId])
  
  const handleToggle = async (b: Branch) => {
    if (!confirm(b.isActive ? 'Filialni o\'chirishni xohlaysizmi? Uning adminlari ham nofaol bo\'ladi.' : 'Filialni qayta yoqasizmi?')) return
    
    await fetch(`/api/admin/clinics/${clinicId}/branches/${b.id}`, {
      method: b.isActive ? 'DELETE' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: b.isActive ? undefined : JSON.stringify({ isActive: true }),
    })
    await load()
  }
  
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-lg font-semibold">Filiallar ({branches.length})</h2>
          <p className="text-sm text-gray-500">Klinika filiallari va ularning adminlari</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Filial qo'shish
        </button>
      </div>
      
      {loading ? (
        <div>Yuklanmoqda...</div>
      ) : branches.length === 0 ? (
        <div className="p-8 text-center bg-gray-50 rounded-lg text-gray-500">
          Hali filial qo'shilmagan
        </div>
      ) : (
        <div className="space-y-3">
          {branches.map(b => (
            <div
              key={b.id}
              className={`p-4 border rounded-lg ${!b.isActive ? 'opacity-60 bg-gray-50' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{b.name}</h3>
                    {!b.isActive && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded">
                        Nofaol
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">📍 {b.address}</p>
                  {b.phone && <p className="text-sm text-gray-600">📞 {b.phone}</p>}
                  {b.workingHours && (
                    <p className="text-sm text-gray-600">🕐 {b.workingHours}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    Adminlar: {b._count.admins}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Link
                    href={`/admin/super/clinics/${clinicId}/branches/${b.id}`}
                    className="px-3 py-1 text-sm border rounded hover:bg-gray-50 text-center"
                  >
                    Boshqarish
                  </Link>
                  <button
                    onClick={() => handleToggle(b)}
                    className={`px-3 py-1 text-sm border rounded ${
                      b.isActive ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'
                    }`}
                  >
                    {b.isActive ? 'O\'chirish' : 'Yoqish'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {showCreate && (
        <CreateBranchModal
          clinicId={clinicId}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load() }}
        />
      )}
    </div>
  )
}
```

**`CreateBranchModal.tsx`:**

**Fayl:** `app/(panel)/admin/super/clinics/[id]/CreateBranchModal.tsx` (YANGI)

```tsx
'use client'

import { useState } from 'react'

type Props = {
  clinicId: string
  onClose: () => void
  onCreated: () => void
}

export function CreateBranchModal({ clinicId, onClose, onCreated }: Props) {
  const [form, setForm] = useState({
    name: '',
    address: '',
    phone: '',
    workingHours: '',
    nearbyMetro: '',
    latitude: '',
    longitude: '',
    sortOrder: 0,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    
    const payload: any = {
      name: form.name,
      address: form.address,
      phone: form.phone || undefined,
      workingHours: form.workingHours || undefined,
      nearbyMetro: form.nearbyMetro || undefined,
      sortOrder: Number(form.sortOrder) || 0,
    }
    
    if (form.latitude) payload.latitude = parseFloat(form.latitude)
    if (form.longitude) payload.longitude = parseFloat(form.longitude)
    
    const res = await fetch(`/api/admin/clinics/${clinicId}/branches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    
    const data = await res.json()
    setLoading(false)
    
    if (!res.ok) {
      setError(data.error || 'Xato yuz berdi')
      return
    }
    onCreated()
  }
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Yangi filial</h2>
        
        <div className="space-y-3">
          <Field label="Filial nomi *" value={form.name}
            onChange={v => setForm({ ...form, name: v })} />
          <Field label="Manzil *" value={form.address}
            onChange={v => setForm({ ...form, address: v })} />
          <Field label="Telefon" value={form.phone}
            onChange={v => setForm({ ...form, phone: v })}
            placeholder="+998 71 123 45 67" />
          <Field label="Ish vaqti" value={form.workingHours}
            onChange={v => setForm({ ...form, workingHours: v })}
            placeholder="09:00 - 18:00, Du-Sh" />
          <Field label="Yaqin metro" value={form.nearbyMetro}
            onChange={v => setForm({ ...form, nearbyMetro: v })}
            placeholder="Mustaqillik" />
          
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude" value={form.latitude}
              onChange={v => setForm({ ...form, latitude: v })}
              placeholder="41.311" />
            <Field label="Longitude" value={form.longitude}
              onChange={v => setForm({ ...form, longitude: v })}
              placeholder="69.279" />
          </div>
        </div>
        
        {error && (
          <div className="mt-3 p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>
        )}
        
        <div className="mt-6 flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={loading || !form.name || !form.address}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Yaratilmoqda...' : 'Yaratish'}
          </button>
          <button onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
            Bekor qilish
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder }: any) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 border rounded-lg"
      />
    </div>
  )
}
```

---

### Vazifa 3.7 — Filial detail sahifasi

**Fayl:** `app/(panel)/admin/super/clinics/[id]/branches/[branchId]/page.tsx` (YANGI)

```tsx
'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { BranchAdminsTab } from './BranchAdminsTab'
import { BranchInfoTab } from './BranchInfoTab'

type Branch = {
  id: string
  name: string
  address: string
  phone: string | null
  workingHours: string | null
  nearbyMetro: string | null
  latitude: number | null
  longitude: number | null
  isActive: boolean
  clinicId: string
}

export default function BranchDetailPage() {
  const params = useParams()
  const clinicId = params.id as string
  const branchId = params.branchId as string
  
  const [branch, setBranch] = useState<Branch | null>(null)
  const [tab, setTab] = useState<'info' | 'admins'>('info')
  const [loading, setLoading] = useState(true)
  
  const reload = async () => {
    const res = await fetch(`/api/admin/clinics/${clinicId}/branches/${branchId}`)
    const data = await res.json()
    setBranch(data.branch)
    setLoading(false)
  }
  
  useEffect(() => { reload() }, [clinicId, branchId])
  
  if (loading) return <div className="p-6">Yuklanmoqda...</div>
  if (!branch) return <div className="p-6 text-red-600">Filial topilmadi</div>
  
  return (
    <div className="max-w-4xl mx-auto p-6">
      <Link
        href={`/admin/super/clinics/${clinicId}?tab=branches`}
        className="text-sm text-blue-600 hover:underline mb-4 inline-block"
      >
        ← Klinikaga qaytish
      </Link>
      
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{branch.name}</h1>
        <p className="text-gray-500">📍 {branch.address}</p>
        {!branch.isActive && (
          <span className="inline-block mt-2 px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">
            Nofaol filial
          </span>
        )}
      </div>
      
      <div className="border-b mb-6">
        <div className="flex gap-1">
          <button
            onClick={() => setTab('info')}
            className={`px-4 py-2 border-b-2 ${
              tab === 'info' ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent'
            }`}
          >
            Ma'lumotlar
          </button>
          <button
            onClick={() => setTab('admins')}
            className={`px-4 py-2 border-b-2 ${
              tab === 'admins' ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent'
            }`}
          >
            Adminlar
          </button>
        </div>
      </div>
      
      {tab === 'info' && <BranchInfoTab branch={branch} clinicId={clinicId} onUpdate={reload} />}
      {tab === 'admins' && <BranchAdminsTab clinicId={clinicId} branchId={branchId} />}
    </div>
  )
}
```

**`BranchInfoTab.tsx`:**

**Fayl:** `app/(panel)/admin/super/clinics/[id]/branches/[branchId]/BranchInfoTab.tsx` (YANGI)

```tsx
'use client'

import { useState } from 'react'

type Branch = any // BranchDetailPage'dan keladi

export function BranchInfoTab({ branch, clinicId, onUpdate }: {
  branch: Branch
  clinicId: string
  onUpdate: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: branch.name,
    address: branch.address,
    phone: branch.phone ?? '',
    workingHours: branch.workingHours ?? '',
    nearbyMetro: branch.nearbyMetro ?? '',
    latitude: branch.latitude?.toString() ?? '',
    longitude: branch.longitude?.toString() ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const handleSave = async () => {
    setSaving(true)
    setError(null)
    
    const payload: any = {
      name: form.name,
      address: form.address,
      phone: form.phone || null,
      workingHours: form.workingHours || null,
      nearbyMetro: form.nearbyMetro || null,
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
    }
    
    const res = await fetch(`/api/admin/clinics/${clinicId}/branches/${branch.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    
    const data = await res.json()
    setSaving(false)
    
    if (!res.ok) {
      setError(data.error || 'Xato')
      return
    }
    setEditing(false)
    onUpdate()
  }
  
  if (!editing) {
    return (
      <div>
        <div className="space-y-3 mb-6">
          <Row label="Nomi" value={branch.name} />
          <Row label="Manzil" value={branch.address} />
          <Row label="Telefon" value={branch.phone || '—'} />
          <Row label="Ish vaqti" value={branch.workingHours || '—'} />
          <Row label="Yaqin metro" value={branch.nearbyMetro || '—'} />
          <Row label="Koordinatalar" 
            value={branch.latitude && branch.longitude 
              ? `${branch.latitude}, ${branch.longitude}` 
              : '—'} />
        </div>
        <button
          onClick={() => setEditing(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Tahrirlash
        </button>
      </div>
    )
  }
  
  return (
    <div className="space-y-3">
      <Field label="Nomi" value={form.name} onChange={v => setForm({...form, name: v})} />
      <Field label="Manzil" value={form.address} onChange={v => setForm({...form, address: v})} />
      <Field label="Telefon" value={form.phone} onChange={v => setForm({...form, phone: v})} />
      <Field label="Ish vaqti" value={form.workingHours} onChange={v => setForm({...form, workingHours: v})} />
      <Field label="Yaqin metro" value={form.nearbyMetro} onChange={v => setForm({...form, nearbyMetro: v})} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Latitude" value={form.latitude} onChange={v => setForm({...form, latitude: v})} />
        <Field label="Longitude" value={form.longitude} onChange={v => setForm({...form, longitude: v})} />
      </div>
      
      {error && <div className="p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}
      
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
        >
          {saving ? 'Saqlanmoqda...' : 'Saqlash'}
        </button>
        <button
          onClick={() => setEditing(false)}
          className="px-4 py-2 border rounded-lg"
        >
          Bekor
        </button>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex">
      <div className="w-40 text-gray-500">{label}:</div>
      <div className="flex-1 font-medium">{value}</div>
    </div>
  )
}

function Field({ label, value, onChange }: any) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border rounded-lg"
      />
    </div>
  )
}
```

**`BranchAdminsTab.tsx`:**

**Fayl:** `app/(panel)/admin/super/clinics/[id]/branches/[branchId]/BranchAdminsTab.tsx` (YANGI)

Faza 2'dagi `AdminsTab.tsx`'ga juda o'xshash. Asosiy farqlar:
- API URL: `/api/admin/clinics/${clinicId}/branches/${branchId}/admins`
- Username prefix UI'da: `tib_badmin_xxxxxx`
- Sarlavha: "Filial adminlari"

```tsx
'use client'

import { useState, useEffect } from 'react'
import { CreateBranchAdminModal } from './CreateBranchAdminModal'
import { ResetPasswordModal } from './ResetPasswordModal'

type Admin = {
  id: string
  username: string | null
  firstName: string
  lastName: string | null
  phone: string | null
  isActive: boolean
  createdAt: string
}

export function BranchAdminsTab({ clinicId, branchId }: {
  clinicId: string; branchId: string
}) {
  const [admins, setAdmins] = useState<Admin[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [resetTarget, setResetTarget] = useState<Admin | null>(null)
  
  const apiUrl = `/api/admin/clinics/${clinicId}/branches/${branchId}/admins`
  
  const load = async () => {
    setLoading(true)
    const res = await fetch(apiUrl)
    const data = await res.json()
    setAdmins(data.admins || [])
    setLoading(false)
  }
  
  useEffect(() => { load() }, [clinicId, branchId])
  
  const handleToggle = async (a: Admin) => {
    if (!confirm(a.isActive ? 'Nofaollashtirasizmi?' : 'Yoqasizmi?')) return
    await fetch(`${apiUrl}/${a.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !a.isActive }),
    })
    await load()
  }
  
  const handleDelete = async (a: Admin) => {
    if (!confirm(`${a.firstName}ni o'chirasizmi?`)) return
    await fetch(`${apiUrl}/${a.id}`, { method: 'DELETE' })
    await load()
  }
  
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-lg font-semibold">Filial adminlari ({admins.length})</h2>
          <p className="text-sm text-gray-500">Faqat shu filial bo'yicha boshqaruv huquqi</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Admin qo'shish
        </button>
      </div>
      
      {loading ? <div>Yuklanmoqda...</div> : admins.length === 0 ? (
        <div className="p-8 text-center bg-gray-50 rounded-lg text-gray-500">
          Hali filial admini yo'q
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="text-left text-sm text-gray-600">
                <th className="px-4 py-2">Login</th>
                <th className="px-4 py-2">Ism</th>
                <th className="px-4 py-2">Telefon</th>
                <th className="px-4 py-2">Holat</th>
                <th className="px-4 py-2 text-right">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {admins.map(a => (
                <tr key={a.id} className="border-t">
                  <td className="px-4 py-3 font-mono text-sm">{a.username}</td>
                  <td className="px-4 py-3">{a.firstName} {a.lastName || ''}</td>
                  <td className="px-4 py-3 text-sm">{a.phone || '—'}</td>
                  <td className="px-4 py-3">
                    {a.isActive ? (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">Faol</span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">Nofaol</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    <button onClick={() => setResetTarget(a)} className="text-blue-600 hover:underline mr-3">
                      Parol
                    </button>
                    <button onClick={() => handleToggle(a)} className="text-gray-600 hover:underline mr-3">
                      {a.isActive ? 'O\'chirish' : 'Yoqish'}
                    </button>
                    <button onClick={() => handleDelete(a)} className="text-red-600 hover:underline">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {showCreate && (
        <CreateBranchAdminModal
          clinicId={clinicId}
          branchId={branchId}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load() }}
        />
      )}
      
      {resetTarget && (
        <ResetPasswordModal
          apiUrl={`${apiUrl}/${resetTarget.id}`}
          admin={resetTarget}
          onClose={() => setResetTarget(null)}
        />
      )}
    </div>
  )
}
```

**`CreateBranchAdminModal.tsx`:** Faza 2'dagi `CreateAdminModal.tsx`'ning to'liq nusxasi, faqat:
- API URL: `/api/admin/clinics/${clinicId}/branches/${branchId}/admins`
- UI hint: `tib_badmin_xxxxxx`
- Props'ga `branchId` qo'shilgan

**`ResetPasswordModal.tsx`:** Faza 2'dagi modal generikroq qilinib `apiUrl` propini qabul qilsin (Faza 2'dagi alohida `clinicId+adminId` o'rniga). Bu refactor:

```tsx
// Yangi signatura
type Props = {
  apiUrl: string  // ← clinicId/adminId o'rniga
  admin: { id: string; username: string | null; firstName: string }
  onClose: () => void
}

// Ichida:
const res = await fetch(apiUrl, {
  method: 'PATCH',
  // ...
})
```

Va Faza 2'dagi `AdminsTab.tsx`'da:
```tsx
<ResetPasswordModal
  apiUrl={`/api/admin/super/clinics/${clinicId}/admins/${resetTarget.id}`}
  admin={resetTarget}
  onClose={() => setResetTarget(null)}
/>
```

---

### Vazifa 3.8 — Test, build, deploy

#### A) Manual test ssenariy

1. **Migratsiya:**
   ```bash
   npx prisma migrate dev --name add_branch_admin_role_and_user_branchid
   npx prisma generate
   npm run build
   npm run dev
   ```

2. **Super admin sifatida:**
   - `/admin/super/clinics/[id]` → "Filiallar" tab
   - "+ Filial qo'shish" → name, address kirit → yaratish
   - Yaratilgan filial ro'yxatda ko'rinsin
   - "Boshqarish" → filial detail sahifa
   - "Ma'lumotlar" tab → "Tahrirlash" → field'lar o'zgartir → saqlash
   - "Adminlar" tab → "+ Admin qo'shish" → ism + auto password
   - Yaratilgan credentials ko'rsatilsin, login + parol nusxa ol
   - Logout → yangi credentials bilan login → admin panel

3. **`clinic_admin` sifatida:**
   - Faza 2'da yaratilgan `clinic_admin` bilan login
   - `/admin/clinics/[oz-id]/branches` ga kirish mumkin bo'lsin
   - Filial yarata olsin
   - **Boshqa klinika** filiallari ga kirish 403

4. **`branch_admin` sifatida:**
   - Yangi `branch_admin` bilan login
   - **Faqat o'z filiali** ma'lumotlarini ko'rsin (Faza 4+'da to'liq UI bo'ladi)
   - `GET /api/admin/clinics/[X]/branches/[boshqa]` → 403

5. **Edge case:**
   - Bo'sh `name` → 400
   - Bo'sh `address` → 400
   - Latitude > 90 → 400
   - Filial DELETE → uning admin'lari ham `isActive=false` (DB tekshir)
   - Telefon duplikat → 409

#### B) Database tekshirish

```sql
-- Yangi enum value
SELECT enum_range(NULL::"UserRole");

-- branchId column
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'branchId';

-- Branch adminlar
SELECT username, firstName, branchId, isActive 
FROM users 
WHERE role = 'branch_admin' 
ORDER BY createdAt DESC;

-- Filial o'chirilganda admin'lar ham nofaol
SELECT b.name, b.isActive, COUNT(u.id) as inactive_admins
FROM branches b
LEFT JOIN users u ON u.branchId = b.id AND u.isActive = false
WHERE b.isActive = false
GROUP BY b.id, b.name, b.isActive;

-- Audit log
SELECT action, payload, createdAt 
FROM audit_logs 
WHERE action LIKE 'branch%' 
ORDER BY createdAt DESC LIMIT 20;
```

#### C) Commit

```bash
git add .
git commit -m "feat(branches): branch CRUD + branch_admin role with username/password auth

- Schema: UserRole.branch_admin enum + User.branchId field
- Permission helper: lib/permissions.ts (canManageClinic/Branch, canCreate*)
- API: /api/admin/clinics/[clinicId]/branches (GET, POST)
- API: /api/admin/clinics/[clinicId]/branches/[branchId] (GET, PATCH, DELETE)
- API: /api/admin/clinics/[clinicId]/branches/[branchId]/admins (GET, POST)
- API: /api/admin/clinics/[clinicId]/branches/[branchId]/admins/[adminId] (PATCH, DELETE)
- Username: tib_badmin_xxxxxx (URL-safe random) via generateBranchAdminUsername
- UI: BranchesTab in clinic detail page (replaces Faza 2 placeholder)
- UI: Branch detail page with Info/Admins tabs
- UI: CreateBranch/CreateBranchAdmin modals + reused ResetPasswordModal (refactored to apiUrl prop)
- Soft delete: branch.delete cascades to branch admins (isActive=false in transaction)
- Audit log: branch.create/update/delete, branch_admin.create/update/reset_password/delete
- Permission matrix:
  - super_admin: all clinics, all branches
  - clinic_admin: own clinic + its branches/admins
  - branch_admin: own branch only"

git push origin main
```

---

## ✅ Acceptance Criteria

- [ ] `UserRole` enum'ga `branch_admin` qo'shildi (DB'da tasdiqlandi)
- [ ] `users.branchId` column qo'shildi (nullable, indexed, FK to branches)
- [ ] Migratsiya muvaffaqiyatli, `prisma generate` yangi types yaratildi
- [ ] `lib/permissions.ts` reusable helper yaratildi
- [ ] `generateBranchAdminUsername()` `tib_badmin_xxxxxx` format'da ishlaydi
- [ ] `GET /api/admin/clinics/[id]/branches` → filiallar ro'yxati
- [ ] `POST /api/admin/clinics/[id]/branches` → yangi filial yaratish (super_admin va clinic_admin)
- [ ] `PATCH /api/admin/clinics/[id]/branches/[bid]` → filial yangilash
- [ ] `DELETE` → soft delete + branch admin'lar ham nofaol (transaction)
- [ ] `POST /api/admin/clinics/[id]/branches/[bid]/admins` → branch admin yaratish + credentials qaytarish
- [ ] `PATCH .../admins/[aid]` → tahrirlash + parol reset
- [ ] `DELETE .../admins/[aid]` → soft delete
- [ ] Permission'lar to'g'ri ishlaydi (403 javoblari)
- [ ] Klinika detail sahifasidagi "Filiallar" tab placeholder o'rniga `BranchesTab`
- [ ] Branch detail sahifa: Ma'lumotlar + Adminlar tab
- [ ] CreateBranch / CreateBranchAdmin / Reset modal'lar ishlaydi
- [ ] `ResetPasswordModal` refactored to accept `apiUrl` prop (Faza 2 ham yangilangan)
- [ ] Branch admin login qila oladi va admin panelga kiradi
- [ ] Audit log barcha branch va branch_admin amallari uchun yoziladi
- [ ] `npm run build` xatosiz
- [ ] Vercel deploy READY

---

## 🚫 Bu fazada qilmaymiz

- ❌ Webapp'da klinika tanlash (Faza 4)
- ❌ Doctors/services'ni branchId bilan bog'lash (bu Faza 0'da yoki keyingi sprintda)
- ❌ Branch admin uchun alohida limited dashboard UI (faqat backend permission)
- ❌ `user_clinics` M2M (Faza 5)
- ❌ Bot'da filial tanlash UI (allaqachon bor)
- ❌ Branch logo (faqat clinic'da bor)

---

## 📁 Yangi/o'zgaradigan fayllar

```
prisma/
  schema.prisma                                                              ← UserRole + User.branchId
  migrations/
    [ts]_add_branch_admin_role_and_user_branchid/migration.sql              ← AVTO

lib/
  permissions.ts                                                             ← YANGI
  admin-username.ts                                                          ← KENGAYTIRILDI (generateBranchAdminUsername)

app/api/admin/clinics/[clinicId]/
  branches/
    route.ts                                                                 ← YANGI (GET, POST)
    [branchId]/
      route.ts                                                               ← YANGI (GET, PATCH, DELETE)
      admins/
        route.ts                                                             ← YANGI (GET, POST)
        [adminId]/
          route.ts                                                           ← YANGI (PATCH, DELETE)

app/(panel)/admin/super/clinics/[id]/
  page.tsx                                                                   ← BranchesTab import
  BranchesTab.tsx                                                            ← YANGI (placeholder o'rniga)
  CreateBranchModal.tsx                                                      ← YANGI
  branches/
    [branchId]/
      page.tsx                                                               ← YANGI (detail)
      BranchInfoTab.tsx                                                      ← YANGI
      BranchAdminsTab.tsx                                                    ← YANGI
      CreateBranchAdminModal.tsx                                             ← YANGI

# Faza 2 refactor
app/(panel)/admin/super/clinics/[id]/
  ResetPasswordModal.tsx                                                     ← apiUrl prop
  AdminsTab.tsx                                                              ← ResetPasswordModal call update
```

---

## ⚠️ Diqqat va xatoliklarni oldini olish

1. **Migratsiya nomi:** `add_branch_admin_role_and_user_branchid` — aynan shu.
2. **Enum migratsiyasi Postgres'da:** Prisma `enum` qo'shganda `ALTER TYPE` ishlatadi — bu odatda muvaffaqiyatli. Agar xato bo'lsa, qo'lda SQL:
   ```sql
   ALTER TYPE "UserRole" ADD VALUE 'branch_admin';
   ```
3. **`User.branch` relation:** `Branch` modelida `admins User[]` reverse relation bo'lishi shart. Aks holda Prisma error.
4. **`include._count.admins`:** Bu ishlashi uchun `Branch` modelida `admins` relation nomi to'g'ri bo'lishi kerak. Agar boshqacha nom (masalan `users`) bo'lsa, moslashtir.
5. **Route folder nomi:** `[clinicId]` ishlatildi. Agar loyihada `[id]` ishlatilgan bo'lsa, mosroq qil. Hozirgi MD `[clinicId]/branches/[branchId]` ishlatadi — agar Faza 2 `[id]` ishlatgan bo'lsa, ikkala route alohida bo'ladi (super namespace'da `[id]`, clinics nested'da `[clinicId]`). Variant: hammasini `[clinicId]` ga ko'chir, lekin Faza 2'ni buzma — yangi yo'l ishlatib turaver.
6. **`clinic_admin` clinicId-nested API'larga kirish:** Faza 2 super-only edi. Bu fazada `clinic_admin` ham kira oladi (lekin `super/clinics/...` emas, `clinics/[clinicId]/...`). Aniqlik uchun:
   - `app/api/admin/super/clinics/...` — faqat super_admin
   - `app/api/admin/clinics/...` — super_admin + clinic_admin (permission check ichida)
7. **Permission xatosi:** Har endpoint'da MAJBURIY `getSession()` + role check. `forbidden()` helper'dan foydalan.
8. **TypeScript types:** `prisma generate` keyin `UserRole.branch_admin` mavjud bo'ladi. Agar IDE ko'rsatmasa, TS server restart kerak.
9. **Session schema:** Faza 2'dagi sessionga `branchId` qo'shilishi kerakmi? **HA** — `createSession()` da `branchId: user.branchId` qo'sh. Login response'iga ham qo'sh.
10. **`branch_admin` login redirect:** Login endpoint'da:
    ```typescript
    if (user.role === 'branch_admin') redirect = `/admin/branch`
    ```
    Bu fazada `/admin/branch` sahifasi kerak emas — qisqartirilgan `/admin` redirect ham mumkin. To'liq branch UI keyingi sprintda.
11. **Audit log actor:** `actorId` har doim `session.user.id`. Bot/cron'lar uchun emas — bu fazada faqat admin actions.
12. **`branches.sortOrder`:** Bu allaqachon mavjud column. Agar `0` default bo'lmasa, NULL bo'lishi mumkin — qo'lda `ORDER BY sortOrder NULLS LAST` qo'shilishi mumkin.
13. **Image / fayl upload yo'q:** Filialga logo qo'shilmaydi (faqat klinika logo'si).
14. **Bot integration:** Bot allaqachon filial tanlatishni biladi (Faza 0). DB'da yangi filial paydo bo'lsa, bot avtomatik ko'radi (real-time emas, cache TTL bo'lishi mumkin — agar muammo bo'lsa, bot cache invalidate qil).
15. **Cascade delete:** Hard delete YO'Q. `branch.delete` → faqat `isActive=false`. Filialga tegishli appointmentslar saqlanadi (tarix uchun). branch_admin'lar `isActive=false`.

---

## 🎯 VS Code Claude'ga ko'rsatma

Shu MD faylni VS Code Claude'ga bering va ayting:

> "Tibtaqvim Faza 3 ni boshla. Avval `prisma/schema.prisma`, `lib/auth.ts`, `lib/admin-username.ts`, `lib/password.ts` fayllarini o'qib loyiha holatini tushun (Faza 2 tugagan deb hisobla). Keyin Vazifa 3.1 → 3.8 tartibida bajar. **Migratsiya birinchi va majburiy.** `ResetPasswordModal` refactor'ini ham Faza 2'dagi joydan boshla (apiUrl prop'iga o'tkazib). Har vazifa tugagandan keyin keyingisiga o't. Yakunda **bitta commit** + `git push`. Vercel deploy READY ekanini tasdiqla. Permission helper'dagi mantiq qat'iy: super_admin → barchasi, clinic_admin → o'z klinikasi, branch_admin → o'z filiali."

Omad! 🚀
