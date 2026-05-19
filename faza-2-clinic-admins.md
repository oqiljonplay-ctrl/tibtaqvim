# Tibtaqvim — Faza 2: Super Admin → Klinikaga Admin Qo'shish

> **Loyiha:** Tibtaqvim (Next.js App Router + Prisma + Supabase Postgres 17 + Vercel)
> **Repo:** `oqiljonplay-ctrl/tibtaqvim` | **Branch:** `main`
> **Oldingi faza:** Faza 1 (clinic edit + logoUrl) — TUGADI
> **Stack:** TypeScript, Next.js (App Router), Prisma, bcrypt, Telegram bot

---

## 🎯 Bu fazaning maqsadi

Super admin har bir klinikaga **bir nechta `clinic_admin` rolidagi foydalanuvchi** yarata olishi kerak. Har admin **URL'dagi random username + parol** bilan login qiladi. Yaratilgan admin keyin o'z klinikasi ichida doctor/service/branch/staff CRUD qila oladi.

**Asosiy talablar:**
1. Schema'ga `username` field qo'shish (`users.username` — unique, nullable)
2. Username — **server tomonidan auto-generate** (URL-safe random, masalan `tib_admin_x7k2m9`)
3. Parol — admin yaratayotgan super_admin tomonidan kiritiladi (yoki avtomatik yaratiladi va ko'rsatiladi)
4. Klinika detail sahifasida "Adminlar" bo'limi: ro'yxat + qo'shish + tahrirlash + o'chirish + parol reset
5. Bitta klinikaga **cheksiz** admin (lekin UI'da counter ko'rsatish)
6. Audit log barcha amallar uchun
7. Login flow `username + password` ishlasin (mavjud auth'ga moslash)

---

## ⚠️ MUHIM KOIDALAR (CHALG'IMASLIK UCHUN)

1. **Faqat Vazifa 2.1 → 2.7 tartibida bajar.** Hech narsani o'tkazib yuborma.
2. **Schema migratsiya — birinchi qadam.** Migratsiya ishlamasa, qolgan kod ishlamaydi.
3. **Bcrypt salt rounds = 12.** Boshqa son ishlatma.
4. **Username regex:** `/^tib_admin_[a-z0-9]{6,8}$/` — pattern shu, o'zgartirma.
5. **clinic_admin yaratganda `clinicId` MAJBURIY.** super_admin'da `clinicId = null`.
6. **Parol minimum 8 belgi, kamida 1 raqam, 1 harf.** Validatsiya server tomonida.
7. **Mavjud `passwordHash` columnini ishlat** — schema'da allaqachon bor.
8. **TypeScript strict mode.** `any` ishlatma, agar zarur bo'lsa `unknown` + type guard.
9. **Har API route'da:**
   - `getSession()` (yoki loyihadagi auth helper) chaqir
   - `session.user.role === 'super_admin'` tekshir
   - Error response: `{ error: string }` JSON formati
10. **Audit log payload'iga `passwordHash` YOZMA.** Faqat metadata.
11. **Bu fazada filial admin YO'Q.** Faqat clinic-level admin. Filial — Faza 3.
12. **Bu fazada login UI O'ZGARTIRMA.** Mavjud login formaga `username` field qo'shish kifoya.

---

## 📋 Vazifalar (tartib bilan)

### Vazifa 2.1 — Prisma schema migratsiyasi

**Fayl:** `prisma/schema.prisma`

**O'zgartirish:** `User` modeliga `username` field qo'shish.

```prisma
model User {
  id           String   @id @default(cuid())
  clinicId     String?
  telegramId   String?  @unique
  tibId        String?  @unique
  phone        String?  @unique
  username     String?  @unique   // ← YANGI
  firstName    String
  lastName     String?
  role         UserRole @default(patient)
  passwordHash String?
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  
  clinic       Clinic?  @relation(fields: [clinicId], references: [id])
  // ... boshqa relations o'zgarmaydi
  
  @@index([username])
  @@map("users")
}
```

**Buyruqlar:**
```bash
npx prisma migrate dev --name add_username_to_users
npx prisma generate
```

**Tekshirish:**
```bash
# Migratsiya muvaffaqiyatli bo'lganini tasdiqlash
npx prisma db pull
# users table'da username column borligini ko'r
```

---

### Vazifa 2.2 — Username generator utility

**Fayl:** `lib/admin-username.ts` (YANGI)

```typescript
import { prisma } from './prisma'

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789' // o, l, 0, 1 yo'q (chalg'itadi)

/**
 * Random URL-safe username yaratadi: tib_admin_x7k2m9
 * Unique bo'lguncha qayta urinadi (max 10 marta)
 */
export async function generateAdminUsername(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    let suffix = ''
    for (let i = 0; i < 7; i++) {
      suffix += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
    }
    const username = `tib_admin_${suffix}`
    
    const exists = await prisma.user.findUnique({ where: { username } })
    if (!exists) return username
  }
  
  throw new Error('Username generatsiya qilishda muammo (10 urinishda topilmadi)')
}

/**
 * Username formatini tekshiradi
 */
export function isValidUsername(username: string): boolean {
  return /^tib_admin_[a-z0-9]{6,8}$/.test(username)
}
```

---

### Vazifa 2.3 — Parol validatsiya utility

**Fayl:** `lib/password.ts` (YANGI, agar mavjud bo'lsa kengaytirish)

```typescript
import bcrypt from 'bcrypt'

const SALT_ROUNDS = 12

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

/**
 * Minimum 8 belgi, kamida 1 raqam, 1 harf
 */
export function validatePasswordStrength(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return { valid: false, error: 'Parol kamida 8 belgi bo\'lishi kerak' }
  }
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, error: 'Parol kamida 1 ta harf bo\'lishi kerak' }
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Parol kamida 1 ta raqam bo\'lishi kerak' }
  }
  return { valid: true }
}

/**
 * Server tomonida random parol yaratish (optional, agar admin kiritmasa)
 */
export function generateRandomPassword(length = 12): string {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  // Kamida 1 raqam kafolatlash
  if (!/[0-9]/.test(result)) {
    result = result.slice(0, -1) + '7'
  }
  return result
}
```

**Eslatma:** `bcrypt` paket o'rnatilganini tekshir:
```bash
npm list bcrypt
# yo'q bo'lsa:
npm install bcrypt
npm install -D @types/bcrypt
```

---

### Vazifa 2.4 — API endpoints

#### A) `GET` va `POST /api/admin/super/clinics/[id]/admins`

**Fayl:** `app/api/admin/super/clinics/[id]/admins/route.ts` (YANGI)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth' // loyihadagi auth helper
import { generateAdminUsername } from '@/lib/admin-username'
import { hashPassword, validatePasswordStrength, generateRandomPassword } from '@/lib/password'

// GET — klinikaning adminlar ro'yxati
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession()
  if (!session || session.user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  
  const clinic = await prisma.clinic.findUnique({ where: { id: params.id } })
  if (!clinic) {
    return NextResponse.json({ error: 'Klinika topilmadi' }, { status: 404 })
  }
  
  const admins = await prisma.user.findMany({
    where: {
      clinicId: params.id,
      role: 'clinic_admin',
    },
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      phone: true,
      isActive: true,
      createdAt: true,
      // passwordHash QAYTARILMAYDI
    },
    orderBy: { createdAt: 'desc' },
  })
  
  return NextResponse.json({ admins, total: admins.length })
}

// POST — yangi admin yaratish
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession()
  if (!session || session.user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  
  // Klinika mavjudligini tekshir
  const clinic = await prisma.clinic.findUnique({ where: { id: params.id } })
  if (!clinic) {
    return NextResponse.json({ error: 'Klinika topilmadi' }, { status: 404 })
  }
  
  const body = await req.json()
  const { firstName, lastName, phone, password, autoPassword } = body
  
  // Validatsiya
  if (!firstName || typeof firstName !== 'string' || firstName.trim().length < 2) {
    return NextResponse.json({ error: 'Ism kamida 2 belgi bo\'lishi kerak' }, { status: 400 })
  }
  
  if (phone && typeof phone === 'string') {
    // O'zbek telefon format: +998 yoki 998 yoki 9 raqam
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length < 9 || cleaned.length > 12) {
      return NextResponse.json({ error: 'Telefon raqami noto\'g\'ri' }, { status: 400 })
    }
  }
  
  // Parol: yo admin kiritadi, yo avtomatik generatsiya
  let finalPassword: string
  if (autoPassword) {
    finalPassword = generateRandomPassword(12)
  } else {
    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Parol kerak' }, { status: 400 })
    }
    const check = validatePasswordStrength(password)
    if (!check.valid) {
      return NextResponse.json({ error: check.error }, { status: 400 })
    }
    finalPassword = password
  }
  
  // Telefon unique tekshirish (agar berilgan bo'lsa)
  if (phone) {
    const existing = await prisma.user.findUnique({ where: { phone } })
    if (existing) {
      return NextResponse.json(
        { error: 'Bu telefon raqami allaqachon ro\'yxatdan o\'tgan' },
        { status: 409 }
      )
    }
  }
  
  // Username generatsiya
  const username = await generateAdminUsername()
  const passwordHash = await hashPassword(finalPassword)
  
  // Yaratish
  const newAdmin = await prisma.user.create({
    data: {
      clinicId: params.id,
      username,
      firstName: firstName.trim(),
      lastName: lastName?.trim() || null,
      phone: phone || null,
      passwordHash,
      role: 'clinic_admin',
      isActive: true,
    },
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      phone: true,
      isActive: true,
      createdAt: true,
    },
  })
  
  // Audit log (parol YOZILMAYDI)
  await prisma.auditLog.create({
    data: {
      actorId: session.user.id,
      clinicId: params.id,
      action: 'admin.create',
      payload: {
        adminId: newAdmin.id,
        username: newAdmin.username,
        autoGeneratedPassword: !!autoPassword,
      },
    },
  })
  
  // Javobda parol QAYTARILADI (faqat shu safar — super_admin ko'radi va saqlab oladi)
  return NextResponse.json({
    admin: newAdmin,
    credentials: {
      username,
      password: finalPassword, // FAQAT shu response'da
    },
  }, { status: 201 })
}
```

#### B) `PATCH` va `DELETE /api/admin/super/clinics/[id]/admins/[adminId]`

**Fayl:** `app/api/admin/super/clinics/[id]/admins/[adminId]/route.ts` (YANGI)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { hashPassword, validatePasswordStrength, generateRandomPassword } from '@/lib/password'

// PATCH — admin ma'lumotlarini yangilash yoki parol reset
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; adminId: string } }
) {
  const session = await getSession()
  if (!session || session.user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  
  // Admin shu klinikaga tegishliligini tekshir
  const admin = await prisma.user.findFirst({
    where: {
      id: params.adminId,
      clinicId: params.id,
      role: 'clinic_admin',
    },
  })
  
  if (!admin) {
    return NextResponse.json({ error: 'Admin topilmadi' }, { status: 404 })
  }
  
  const body = await req.json()
  const { firstName, lastName, phone, isActive, resetPassword, newPassword } = body
  
  const data: any = {}
  
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
      if (existing) {
        return NextResponse.json({ error: 'Telefon raqami band' }, { status: 409 })
      }
    }
    data.phone = phone || null
  }
  
  if (isActive !== undefined) {
    data.isActive = Boolean(isActive)
  }
  
  // Parol reset
  let returnedPassword: string | null = null
  if (resetPassword) {
    const pwd = newPassword || generateRandomPassword(12)
    if (newPassword) {
      const check = validatePasswordStrength(newPassword)
      if (!check.valid) {
        return NextResponse.json({ error: check.error }, { status: 400 })
      }
    }
    data.passwordHash = await hashPassword(pwd)
    returnedPassword = pwd
  }
  
  const updated = await prisma.user.update({
    where: { id: params.adminId },
    data,
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      phone: true,
      isActive: true,
      updatedAt: true,
    },
  })
  
  // Audit log
  await prisma.auditLog.create({
    data: {
      actorId: session.user.id,
      clinicId: params.id,
      action: resetPassword ? 'admin.reset_password' : 'admin.update',
      payload: {
        adminId: params.adminId,
        changes: Object.keys(data).filter(k => k !== 'passwordHash'),
      },
    },
  })
  
  return NextResponse.json({
    admin: updated,
    ...(returnedPassword ? { newPassword: returnedPassword } : {}),
  })
}

// DELETE — admin soft delete (isActive = false)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; adminId: string } }
) {
  const session = await getSession()
  if (!session || session.user.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  
  const admin = await prisma.user.findFirst({
    where: {
      id: params.adminId,
      clinicId: params.id,
      role: 'clinic_admin',
    },
  })
  
  if (!admin) {
    return NextResponse.json({ error: 'Admin topilmadi' }, { status: 404 })
  }
  
  // Soft delete
  await prisma.user.update({
    where: { id: params.adminId },
    data: { isActive: false },
  })
  
  await prisma.auditLog.create({
    data: {
      actorId: session.user.id,
      clinicId: params.id,
      action: 'admin.delete',
      payload: { adminId: params.adminId, username: admin.username },
    },
  })
  
  return NextResponse.json({ success: true })
}
```

---

### Vazifa 2.5 — Login flow'ga `username` qo'shish

**Maqsad:** Mavjud login formaga `username` field qo'shish. Login endpoint `phone` OR `username` qabul qilsin.

**Fayl 1:** `app/api/auth/login/route.ts` (yoki loyihadagi login endpoint)

**O'zgartirish:**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/password'
import { createSession } from '@/lib/auth' // loyihadagi helper

export async function POST(req: NextRequest) {
  const { identifier, password } = await req.json()
  // identifier = username yoki phone
  
  if (!identifier || !password) {
    return NextResponse.json({ error: 'Login va parol kerak' }, { status: 400 })
  }
  
  // Username yoki phone bo'yicha qidirish
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: identifier },
        { phone: identifier },
      ],
      isActive: true,
      passwordHash: { not: null },
    },
  })
  
  if (!user || !user.passwordHash) {
    return NextResponse.json({ error: 'Login yoki parol noto\'g\'ri' }, { status: 401 })
  }
  
  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: 'Login yoki parol noto\'g\'ri' }, { status: 401 })
  }
  
  // Session yaratish
  await createSession({
    userId: user.id,
    role: user.role,
    clinicId: user.clinicId,
  })
  
  // Redirect target
  let redirect = '/admin'
  if (user.role === 'super_admin') redirect = '/admin/super'
  else if (user.role === 'clinic_admin') redirect = '/admin'
  
  return NextResponse.json({
    success: true,
    redirect,
    user: {
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      role: user.role,
      clinicId: user.clinicId,
    },
  })
}
```

**Fayl 2:** Login formasi (`app/login/page.tsx` yoki shu loyihadagi nom)

**O'zgartirish:** Form field nomini `phone` → `identifier` qil. Placeholder: "Login (username yoki telefon)".

```tsx
<input
  type="text"
  value={identifier}
  onChange={(e) => setIdentifier(e.target.value)}
  placeholder="Login (tib_admin_xxxx) yoki telefon"
  autoComplete="username"
  className="..."
/>
```

**Eslatma:** Agar loyihada login endpoint butunlay boshqacha bo'lsa (masalan, NextAuth bilan), shu logikani o'sha provider'ga moslab joriy qil. Asosiy talab: `username` orqali login ishlasin.

---

### Vazifa 2.6 — UI: Klinika detail sahifasi + adminlar bo'limi

#### A) Klinika detail sahifasi (Tabs bilan)

**Fayl:** `app/(panel)/admin/super/clinics/[id]/page.tsx` (YANGI yoki yangilash)

```tsx
'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ClinicLogo } from '@/components/ClinicLogo'
import { AdminsTab } from './AdminsTab'
// import { BranchesTab } from './BranchesTab' // Faza 3'da

type Clinic = {
  id: string
  name: string
  city: string | null
  phone: string | null
  logoUrl: string | null
  isActive: boolean
  _count?: {
    doctors: number
    services: number
    appointments: number
    users: number
  }
}

export default function ClinicDetailPage() {
  const params = useParams()
  const clinicId = params.id as string
  
  const [clinic, setClinic] = useState<Clinic | null>(null)
  const [tab, setTab] = useState<'info' | 'admins' | 'branches'>('info')
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    fetch(`/api/admin/super/clinics/${clinicId}`)
      .then(r => r.json())
      .then(setClinic)
      .finally(() => setLoading(false))
  }, [clinicId])
  
  if (loading) return <div className="p-6">Yuklanmoqda...</div>
  if (!clinic) return <div className="p-6 text-red-600">Klinika topilmadi</div>
  
  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <ClinicLogo src={clinic.logoUrl} name={clinic.name} size={96} />
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{clinic.name}</h1>
          <p className="text-gray-500">{clinic.city} • {clinic.phone}</p>
          {!clinic.isActive && (
            <span className="inline-block mt-1 px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">
              Nofaol
            </span>
          )}
        </div>
        <Link
          href={`/admin/super/clinics/${clinicId}/edit`}
          className="px-4 py-2 border rounded-lg hover:bg-gray-50"
        >
          Tahrirlash
        </Link>
      </div>
      
      {/* Tabs */}
      <div className="border-b mb-6">
        <div className="flex gap-1">
          <TabButton active={tab === 'info'} onClick={() => setTab('info')}>
            Ma'lumotlar
          </TabButton>
          <TabButton active={tab === 'admins'} onClick={() => setTab('admins')}>
            Adminlar
          </TabButton>
          <TabButton active={tab === 'branches'} onClick={() => setTab('branches')}>
            Filiallar
          </TabButton>
        </div>
      </div>
      
      {/* Tab content */}
      {tab === 'info' && (
        <div className="space-y-4">
          <InfoRow label="Klinika nomi" value={clinic.name} />
          <InfoRow label="Telefon" value={clinic.phone} />
          <InfoRow label="Shahar" value={clinic.city} />
          {clinic._count && (
            <div className="grid grid-cols-4 gap-4 mt-6">
              <StatCard label="Shifokorlar" value={clinic._count.doctors} />
              <StatCard label="Xizmatlar" value={clinic._count.services} />
              <StatCard label="Bronlar" value={clinic._count.appointments} />
              <StatCard label="Foydalanuvchilar" value={clinic._count.users} />
            </div>
          )}
        </div>
      )}
      
      {tab === 'admins' && <AdminsTab clinicId={clinicId} />}
      
      {tab === 'branches' && (
        <div className="text-gray-500 italic">
          Filiallar — keyingi fazada qo'shiladi
        </div>
      )}
    </div>
  )
}

function TabButton({ active, onClick, children }: any) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 border-b-2 transition ${
        active ? 'border-blue-600 text-blue-600 font-semibold' : 'border-transparent text-gray-600 hover:text-gray-900'
      }`}
    >
      {children}
    </button>
  )
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex">
      <div className="w-40 text-gray-500">{label}:</div>
      <div className="flex-1 font-medium">{value || '—'}</div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-4 bg-gray-50 rounded-lg text-center">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  )
}
```

#### B) `AdminsTab` komponenti

**Fayl:** `app/(panel)/admin/super/clinics/[id]/AdminsTab.tsx` (YANGI)

```tsx
'use client'

import { useState, useEffect } from 'react'
import { CreateAdminModal } from './CreateAdminModal'
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

export function AdminsTab({ clinicId }: { clinicId: string }) {
  const [admins, setAdmins] = useState<Admin[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [resetTarget, setResetTarget] = useState<Admin | null>(null)
  
  const load = async () => {
    setLoading(true)
    const res = await fetch(`/api/admin/super/clinics/${clinicId}/admins`)
    const data = await res.json()
    setAdmins(data.admins || [])
    setLoading(false)
  }
  
  useEffect(() => { load() }, [clinicId])
  
  const handleToggleActive = async (admin: Admin) => {
    if (!confirm(admin.isActive ? 'Adminni faolsizlantirmoqchimisiz?' : 'Adminni faollashtirmoqchimisiz?')) return
    
    await fetch(`/api/admin/super/clinics/${clinicId}/admins/${admin.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !admin.isActive }),
    })
    await load()
  }
  
  const handleDelete = async (admin: Admin) => {
    if (!confirm(`"${admin.firstName}" adminini o'chirmoqchimisiz? Bu amal qaytarilmaydi.`)) return
    
    await fetch(`/api/admin/super/clinics/${clinicId}/admins/${admin.id}`, {
      method: 'DELETE',
    })
    await load()
  }
  
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-lg font-semibold">Adminlar ({admins.length})</h2>
          <p className="text-sm text-gray-500">Klinikani boshqaradigan foydalanuvchilar</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Admin qo'shish
        </button>
      </div>
      
      {loading ? (
        <div>Yuklanmoqda...</div>
      ) : admins.length === 0 ? (
        <div className="p-8 text-center bg-gray-50 rounded-lg text-gray-500">
          Hali admin qo'shilmagan
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
              {admins.map(admin => (
                <tr key={admin.id} className="border-t">
                  <td className="px-4 py-3 font-mono text-sm">{admin.username}</td>
                  <td className="px-4 py-3">{admin.firstName} {admin.lastName || ''}</td>
                  <td className="px-4 py-3 text-sm">{admin.phone || '—'}</td>
                  <td className="px-4 py-3">
                    {admin.isActive ? (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">Faol</span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">Nofaol</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    <button
                      onClick={() => setResetTarget(admin)}
                      className="text-blue-600 hover:underline mr-3"
                    >
                      Parol
                    </button>
                    <button
                      onClick={() => handleToggleActive(admin)}
                      className="text-gray-600 hover:underline mr-3"
                    >
                      {admin.isActive ? 'O\'chirish' : 'Yoqish'}
                    </button>
                    <button
                      onClick={() => handleDelete(admin)}
                      className="text-red-600 hover:underline"
                    >
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
        <CreateAdminModal
          clinicId={clinicId}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load() }}
        />
      )}
      
      {resetTarget && (
        <ResetPasswordModal
          clinicId={clinicId}
          admin={resetTarget}
          onClose={() => setResetTarget(null)}
        />
      )}
    </div>
  )
}
```

#### C) `CreateAdminModal` komponenti

**Fayl:** `app/(panel)/admin/super/clinics/[id]/CreateAdminModal.tsx` (YANGI)

```tsx
'use client'

import { useState } from 'react'

type Props = {
  clinicId: string
  onClose: () => void
  onCreated: () => void
}

type Credentials = { username: string; password: string }

export function CreateAdminModal({ clinicId, onClose, onCreated }: Props) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [autoPassword, setAutoPassword] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<Credentials | null>(null)
  
  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const res = await fetch(`/api/admin/super/clinics/${clinicId}/admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName: lastName || undefined,
          phone: phone || undefined,
          autoPassword,
          password: autoPassword ? undefined : password,
        }),
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        setError(data.error || 'Xato yuz berdi')
        return
      }
      
      setCreated(data.credentials)
    } catch (e) {
      setError('Tarmoq xatosi')
    } finally {
      setLoading(false)
    }
  }
  
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
  }
  
  // Muvaffaqiyatli yaratilgandan keyin credentials ko'rsatiladi
  if (created) {
    return (
      <Modal onClose={() => { onCreated() }}>
        <h2 className="text-xl font-bold mb-4">✓ Admin yaratildi</h2>
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
          <p className="text-sm text-yellow-800 font-semibold mb-2">
            ⚠️ Bu ma'lumotlar faqat shu safar ko'rsatiladi. Saqlab oling!
          </p>
        </div>
        
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500">Login (username)</label>
            <div className="flex gap-2 mt-1">
              <code className="flex-1 px-3 py-2 bg-gray-100 rounded font-mono text-sm">
                {created.username}
              </code>
              <button
                onClick={() => handleCopy(created.username)}
                className="px-3 py-2 border rounded hover:bg-gray-50 text-sm"
              >
                Nusxa
              </button>
            </div>
          </div>
          
          <div>
            <label className="text-xs text-gray-500">Parol</label>
            <div className="flex gap-2 mt-1">
              <code className="flex-1 px-3 py-2 bg-gray-100 rounded font-mono text-sm">
                {created.password}
              </code>
              <button
                onClick={() => handleCopy(created.password)}
                className="px-3 py-2 border rounded hover:bg-gray-50 text-sm"
              >
                Nusxa
              </button>
            </div>
          </div>
          
          <button
            onClick={() => handleCopy(`Login: ${created.username}\nParol: ${created.password}`)}
            className="w-full px-3 py-2 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 text-sm"
          >
            Ikkalasini birga nusxa olish
          </button>
        </div>
        
        <button
          onClick={onCreated}
          className="mt-6 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Yopish
        </button>
      </Modal>
    )
  }
  
  return (
    <Modal onClose={onClose}>
      <h2 className="text-xl font-bold mb-4">Yangi admin qo'shish</h2>
      
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Ism *</label>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Familiya</label>
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Telefon</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+998901234567"
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        
        <div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={autoPassword}
              onChange={(e) => setAutoPassword(e.target.checked)}
            />
            <span className="text-sm">Parolni avtomatik yaratish</span>
          </label>
        </div>
        
        {!autoPassword && (
          <div>
            <label className="block text-sm font-medium mb-1">Parol *</label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Kamida 8 belgi, 1 harf, 1 raqam"
              className="w-full px-3 py-2 border rounded-lg font-mono"
            />
          </div>
        )}
        
        <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded">
          ℹ️ Username avtomatik yaratiladi: <code>tib_admin_xxxxxx</code>
        </div>
      </div>
      
      {error && (
        <div className="mt-3 p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>
      )}
      
      <div className="mt-6 flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={loading || !firstName}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Yaratilmoqda...' : 'Yaratish'}
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 border rounded-lg hover:bg-gray-50"
        >
          Bekor qilish
        </button>
      </div>
    </Modal>
  )
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
```

#### D) `ResetPasswordModal` komponenti

**Fayl:** `app/(panel)/admin/super/clinics/[id]/ResetPasswordModal.tsx` (YANGI)

```tsx
'use client'

import { useState } from 'react'

type Props = {
  clinicId: string
  admin: { id: string; username: string | null; firstName: string }
  onClose: () => void
}

export function ResetPasswordModal({ clinicId, admin, onClose }: Props) {
  const [newPassword, setNewPassword] = useState('')
  const [autoGenerate, setAutoGenerate] = useState(true)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const handleReset = async () => {
    setLoading(true)
    setError(null)
    
    const res = await fetch(`/api/admin/super/clinics/${clinicId}/admins/${admin.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resetPassword: true,
        newPassword: autoGenerate ? undefined : newPassword,
      }),
    })
    
    const data = await res.json()
    setLoading(false)
    
    if (!res.ok) {
      setError(data.error || 'Xato')
      return
    }
    
    setResult(data.newPassword)
  }
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-md w-full">
        <h2 className="text-xl font-bold mb-2">Parolni o'zgartirish</h2>
        <p className="text-sm text-gray-500 mb-4">
          Admin: <code>{admin.username}</code> ({admin.firstName})
        </p>
        
        {result ? (
          <div>
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded mb-4">
              <p className="text-sm text-yellow-800 mb-2">⚠️ Yangi parol:</p>
              <code className="block p-2 bg-white border rounded font-mono">{result}</code>
              <button
                onClick={() => navigator.clipboard.writeText(result)}
                className="mt-2 text-sm text-blue-600 hover:underline"
              >
                Nusxa olish
              </button>
            </div>
            <button onClick={onClose} className="w-full px-4 py-2 bg-blue-600 text-white rounded">
              Yopish
            </button>
          </div>
        ) : (
          <>
            <label className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                checked={autoGenerate}
                onChange={(e) => setAutoGenerate(e.target.checked)}
              />
              <span className="text-sm">Avtomatik yaratish</span>
            </label>
            
            {!autoGenerate && (
              <input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Yangi parol"
                className="w-full px-3 py-2 border rounded mb-3 font-mono"
              />
            )}
            
            {error && <div className="p-3 bg-red-50 text-red-700 rounded text-sm mb-3">{error}</div>}
            
            <div className="flex gap-3">
              <button
                onClick={handleReset}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
              >
                {loading ? 'Bajarilmoqda...' : 'Parolni almashtir'}
              </button>
              <button onClick={onClose} className="px-4 py-2 border rounded">
                Bekor
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
```

---

### Vazifa 2.7 — Test, build, deploy

#### A) Lokal test ssenariy

```bash
# 1. Migratsiyani qo'llash
npx prisma migrate dev --name add_username_to_users
npx prisma generate

# 2. Build tekshirish (TypeScript errors uchun)
npm run build

# 3. Dev serverni ishga tushir
npm run dev
```

**Manual test:**

1. Super admin sifatida login
2. `/admin/super/clinics` ga kir
3. Klinika tanla → detail sahifa ochilsin (3 tab: Ma'lumotlar, Adminlar, Filiallar)
4. "Adminlar" tab → "Admin qo'shish" tugmasi → modal ochilsin
5. **Test 1 (auto password):** Ism: "Test", auto checkbox bor — "Yaratish" → username + parol ko'rsatilsin
6. **Test 2 (manual password):** Ism: "Test2", auto off, parol: "abc" → 400 error ("kamida 8 belgi")
7. **Test 3 (manual password OK):** Parol: "test1234" → admin yaratilsin
8. **Test 4 (login):** Logout qil → login formaga username + parol kirit → admin panelga o'tsin
9. **Test 5 (parol reset):** Adminlar ro'yxatida "Parol" tugmasi → reset → yangi parol ko'rsatilsin
10. **Test 6 (faollik):** "O'chirish" → admin nofaol bo'lsin → u bilan login bo'lmasin (401)
11. **Test 7 (telefon duplikat):** Bir xil telefon bilan 2-marta yaratish → 409 error
12. **Test 8 (clinic_admin permission):** Boshqa klinika clinic_admin sifatida login qil → `/api/admin/super/clinics/X/admins` → 403

#### B) Database tekshirish (Supabase SQL editor)

```sql
-- Username column borligini tekshir
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'username';

-- Yaratilgan adminlar
SELECT id, username, firstName, role, clinicId, isActive 
FROM users 
WHERE role = 'clinic_admin' 
ORDER BY createdAt DESC;

-- Audit logs
SELECT action, payload, createdAt 
FROM audit_logs 
WHERE action LIKE 'admin.%' 
ORDER BY createdAt DESC 
LIMIT 20;
```

#### C) Commit va deploy

```bash
git add .
git commit -m "feat(super-admin): clinic admins CRUD with auto-generated username + password

- Schema: users.username (unique, nullable) for admin login
- API: GET/POST /api/admin/super/clinics/[id]/admins
- API: PATCH/DELETE /api/admin/super/clinics/[id]/admins/[adminId]
- Username auto-generation: tib_admin_xxxxxx (URL-safe random)
- Password: 8+ chars with letter+digit, bcrypt salt 12
- Login flow: accepts username OR phone as identifier
- UI: clinic detail page with tabs (Info/Admins/Branches)
- UI: Create/Reset password modals with credentials display
- Audit logs: admin.create, admin.update, admin.reset_password, admin.delete
- Soft delete via isActive=false"

git push origin main
```

Vercel avtomatik deploy qiladi. Deploy READY bo'lishini kuting.

---

## ✅ Acceptance Criteria (yakuniy checklist)

- [ ] `users.username` column qo'shilgan (unique, nullable), migratsiya muvaffaqiyatli
- [ ] `GET /api/admin/super/clinics/[id]/admins` → adminlar ro'yxati (passwordHash YO'Q)
- [ ] `POST /api/admin/super/clinics/[id]/admins` → yangi admin yaratish, credentials qaytarish
- [ ] `PATCH /api/admin/super/clinics/[id]/admins/[adminId]` → tahrirlash + parol reset
- [ ] `DELETE /api/admin/super/clinics/[id]/admins/[adminId]` → soft delete
- [ ] Faqat super_admin'ga ruxsat (boshqa rollar 403)
- [ ] Username format: `tib_admin_xxxxxx`, unique
- [ ] Parol validatsiya: 8+ belgi, 1 harf, 1 raqam, bcrypt salt 12
- [ ] Login formasi `username` yoki `phone` qabul qiladi
- [ ] Yaratilgan parol **faqat 1 marta** ko'rsatiladi (qaytarish yo'q)
- [ ] Audit log: `admin.create`, `admin.update`, `admin.reset_password`, `admin.delete`
- [ ] Klinika detail sahifasi tablar bilan (Ma'lumotlar / Adminlar / Filiallar placeholder)
- [ ] Modal'larda copy-to-clipboard tugmalari ishlaydi
- [ ] Bir klinikada bir nechta admin yaratish mumkin
- [ ] Telefon duplikat → 409 error
- [ ] `isActive=false` admin login bo'lmaydi
- [ ] TypeScript build xatosiz (`npm run build`)
- [ ] Vercel deploy READY

---

## 🚫 Bu fazada qilmaymiz

- ❌ Filial admin (Faza 3'da)
- ❌ Webapp clinic switcher (Faza 4'da)
- ❌ Tarix sahifasi (Faza 5'da)
- ❌ Schema'da `user_clinics` M2M (Faza 5'da)
- ❌ Email orqali parolni yuborish
- ❌ 2FA, OTP
- ❌ Super admin yaratish (faqat seed orqali, kolda)

---

## 📁 Yangi/o'zgaradigan fayllar

```
prisma/
  schema.prisma                                              ← User.username qo'shish
  migrations/
    [timestamp]_add_username_to_users/migration.sql         ← AVTO

lib/
  admin-username.ts                                          ← YANGI
  password.ts                                                ← YANGI (yoki kengaytirish)
  auth.ts                                                    ← TEKSHIR (session helper)

app/
  api/
    admin/
      super/
        clinics/
          [id]/
            admins/
              route.ts                                       ← YANGI (GET, POST)
              [adminId]/
                route.ts                                     ← YANGI (PATCH, DELETE)
    auth/
      login/
        route.ts                                             ← O'ZGARTIRISH (username support)
  
  (panel)/
    admin/
      super/
        clinics/
          [id]/
            page.tsx                                         ← YANGI yoki yangilash
            AdminsTab.tsx                                    ← YANGI
            CreateAdminModal.tsx                             ← YANGI
            ResetPasswordModal.tsx                           ← YANGI

  login/
    page.tsx                                                 ← input nomi: identifier
```

---

## ⚠️ Diqqat va xatoliklarni oldini olish

1. **Migratsiya nomidan adashma:** `add_username_to_users` — aynan shu.
2. **Username unique constraint** — Prisma `@unique` orqali bo'ladi, qo'shimcha SQL kerak emas.
3. **bcrypt vs bcryptjs:** Loyihada qaysi biri ishlatilgan tekshir. Vercel serverless'da `bcrypt` (native) ham, `bcryptjs` (pure JS) ham ishlaydi. Tavsiya: `bcrypt` (tezroq).
4. **Auth helper:** Loyihada `getSession()`, `auth()`, `getServerSession()` qaysi bo'lsa shuni ishlat. Bu MD'da `getSession` deb yozilgan — sening loyihadagi nomga o'zgartir.
5. **Session schema:** `session.user.role`, `session.user.id`, `session.user.clinicId` — bu uchtasi yetadi. Agar boshqacha bo'lsa, moslashtir.
6. **Telefon format:** Hozir oddiy raqam tekshiruv. To'liq O'zbek formati keyingi fazada (regex `^\+?998[0-9]{9}$`).
7. **Modal accessibility:** Hozircha oddiy. ESC bilan yopish va focus trap keyingi sprintda.
8. **Server Components vs Client:** Modal'lar va interactive UI — `'use client'`. API route — server (default).
9. **CSRF/rate limit:** Bu fazada qo'shilmaydi. Login endpoint'da agar mavjud bo'lsa, buzma.
10. **Password leak xavfi:** Parol faqat:
    - POST response'da (yaratilgan paytda)
    - PATCH response'da (reset paytida)
    Boshqa endpoint'larda **HECH QACHON** qaytmasligi kerak. Audit log'ga ham yozilmaydi.

11. **TypeScript `any` ishlatilgan joylar:** `data: any` ba'zi joylarda mavjud (PATCH builder). Kerak bo'lsa, Prisma `Prisma.UserUpdateInput` type'iga almashtir.

12. **`prisma.user.update` xatosi:** Agar `username` field Prisma client'ga ulanmagan bo'lsa, `npx prisma generate` qayta ishga tushir.

---

## 🎯 VS Code Claude'ga ko'rsatma

Shu MD faylni VS Code Claude'ga bering va ayting:

> "Tibtaqvim Faza 2 ni boshla. Avval `prisma/schema.prisma` va `lib/auth.ts` fayllarini o'qib, loyiha tuzilmasini tushun. Keyin Vazifa 2.1 → 2.7 tartibida bajar. **Hech qaysi vazifani o'tkazib yuborma, tartibni o'zgartirma.** Schema migratsiyasi birinchi va majburiy. Har vazifa tugagandan keyin shu vazifaga tegishli fayllarni saqlab, keyingisiga o't. Yakunda **bitta commit** qil va `git push` qil. Vercel deploy READY bo'lganini tasdiqla."

Omad! 🚀
