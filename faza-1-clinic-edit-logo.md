# Tibtaqvim — Faza 1: Klinika Edit Bug Fix + Logo URL

> **Loyiha:** Tibtaqvim (Next.js + Prisma + Supabase + Vercel + Telegram bot)
> **Repo:** `oqiljonplay-ctrl/tibtaqvim`
> **Branch:** `main`
> **Oldingi commit:** `f0fbc27` (multi-clinic foundation)
> **Stack:** Next.js (App Router), Prisma, Supabase (Postgres 17), TypeScript

---

## 🎯 Bu fazaning maqsadi

1. **Bug fix:** Super admin hozirda yaratilgan va ishlab turgan klinika ma'lumotlarini tahrirlay olmayapti — buni tuzatish.
2. **Yangi feature:** Klinika logosi (URL bilan) qo'shish va hamma joyda 96px yumaloq render qilish.

---

## 📋 Vazifa ro'yxati (tartib bilan)

### Vazifa 1.1 — Klinika edit API endpoint'ini tekshir va tuzat

**Maqsad:** `PATCH /api/admin/clinics/[id]` va `PUT /api/admin/clinics/[id]` (yoki shu loyihada ishlatilgan nomi) endpoint super_admin uchun ishlasin.

**Qadamlar:**

1. Loyihada quyidagi fayllarni topib o'qi:
   - `app/api/admin/clinics/[id]/route.ts` (yoki shunga o'xshash)
   - `app/api/admin/super/clinics/route.ts`
   - `app/api/admin/super/clinics/[id]/route.ts` (agar bor bo'lsa)
   - Auth middleware: `middleware.ts`, `lib/auth.ts`, `lib/session.ts` (qaysi bo'lsa)

2. Hozirgi muammoni aniqla:
   - `clinic_admin` faqat o'z `clinicId`siga tegishli klinikani edit qila olishi kerak
   - `super_admin` **istalgan** klinikani edit qila olishi kerak (clinicId filtersiz)
   - Aniqlash: hozirgi kodda super_admin uchun bypass bormi yoki yo'qmi

3. Endpoint logikasi shunday bo'lishi kerak:
   ```typescript
   // app/api/admin/super/clinics/[id]/route.ts (yangi yoki mavjud)
   
   import { NextRequest, NextResponse } from 'next/server'
   import { prisma } from '@/lib/prisma'
   import { getSession } from '@/lib/auth' // yoki shu loyihadagi auth helper
   
   export async function PATCH(
     req: NextRequest,
     { params }: { params: { id: string } }
   ) {
     const session = await getSession()
     
     // Faqat super_admin ruxsat etiladi
     if (!session || session.user.role !== 'super_admin') {
       return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
     }
     
     const body = await req.json()
     
     // Validatsiya
     const allowedFields = [
       'name', 'phone', 'address', 'city', 'description', 
       'workingHours', 'logoUrl', 'isActive', 'rating'
     ]
     const data: Record<string, any> = {}
     for (const key of allowedFields) {
       if (key in body) data[key] = body[key]
     }
     
     // logoUrl validatsiyasi (agar berilgan bo'lsa)
     if (data.logoUrl) {
       const isValid = /^https?:\/\/.+\.(jpg|jpeg|png|webp|svg|gif)(\?.*)?$/i.test(data.logoUrl)
       if (!isValid) {
         return NextResponse.json(
           { error: 'logoUrl noto\'g\'ri formatda. https:// bilan boshlanishi va .jpg/.png/.webp bo\'lishi kerak' },
           { status: 400 }
         )
       }
     }
     
     data.updatedAt = new Date()
     
     try {
       const updated = await prisma.clinic.update({
         where: { id: params.id },
         data,
       })
       
       // Audit log
       await prisma.auditLog.create({
         data: {
           actorId: session.user.id,
           clinicId: params.id,
           action: 'clinic.update',
           payload: { changes: data },
         },
       })
       
       return NextResponse.json(updated)
     } catch (e: any) {
       return NextResponse.json(
         { error: 'Klinika topilmadi yoki tahrirlashda xato' },
         { status: 404 }
       )
     }
   }
   
   export async function GET(
     req: NextRequest,
     { params }: { params: { id: string } }
   ) {
     const session = await getSession()
     if (!session || session.user.role !== 'super_admin') {
       return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
     }
     
     const clinic = await prisma.clinic.findUnique({
       where: { id: params.id },
       include: {
         branches: { where: { isActive: true } },
         _count: { 
           select: { 
             doctors: true, 
             services: true, 
             appointments: true,
             users: true,
           } 
         },
       },
     })
     
     if (!clinic) {
       return NextResponse.json({ error: 'Not found' }, { status: 404 })
     }
     
     return NextResponse.json(clinic)
   }
   ```

4. Agar loyihada `clinic_admin` ham o'z klinikasini edit qilishi kerak bo'lsa, alohida endpoint `app/api/admin/clinics/[id]/route.ts` mavjud bo'lsa, **u yerdagi auth check'ni saqlab qol**, faqat super_admin uchun bypass qo'sh:
   ```typescript
   const isSuperAdmin = session.user.role === 'super_admin'
   const isOwnClinic = session.user.clinicId === params.id
   
   if (!isSuperAdmin && !isOwnClinic) {
     return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
   }
   ```

---

### Vazifa 1.2 — Super admin klinika edit sahifasi (UI)

**Fayl:** `app/(panel)/admin/super/clinics/[id]/edit/page.tsx` (yoki mavjud joyiga mos)

**Talab:**

- Klinika ma'lumotlarini ko'rsatish va tahrirlash formasi
- Maydonlar: name, phone, address, city, description, workingHours, **logoUrl**, isActive
- Logo preview (96px yumaloq) — URL kiritilgandan keyin darrov ko'rinsin
- "Saqlash" tugmasi → PATCH so'rov
- Loading state, error state, success toast

**Kod misoli:**

```tsx
'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Image from 'next/image'

type Clinic = {
  id: string
  name: string
  phone: string | null
  address: string | null
  city: string | null
  description: string | null
  workingHours: string | null
  logoUrl: string | null
  isActive: boolean
}

export default function EditClinicPage() {
  const router = useRouter()
  const params = useParams()
  const clinicId = params.id as string
  
  const [clinic, setClinic] = useState<Clinic | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  
  useEffect(() => {
    fetch(`/api/admin/super/clinics/${clinicId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setClinic(data)
      })
      .finally(() => setLoading(false))
  }, [clinicId])
  
  const handleSave = async () => {
    if (!clinic) return
    setSaving(true)
    setError(null)
    setSuccess(false)
    
    try {
      const res = await fetch(`/api/admin/super/clinics/${clinicId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: clinic.name,
          phone: clinic.phone,
          address: clinic.address,
          city: clinic.city,
          description: clinic.description,
          workingHours: clinic.workingHours,
          logoUrl: clinic.logoUrl,
          isActive: clinic.isActive,
        }),
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        setError(data.error || 'Xato yuz berdi')
        return
      }
      
      setSuccess(true)
      setTimeout(() => router.push('/admin/super/clinics'), 1500)
    } catch (e) {
      setError('Tarmoq xatosi')
    } finally {
      setSaving(false)
    }
  }
  
  if (loading) return <div className="p-6">Yuklanmoqda...</div>
  if (!clinic) return <div className="p-6 text-red-600">Klinika topilmadi</div>
  
  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Klinikani tahrirlash</h1>
      
      {/* Logo preview */}
      <div className="mb-6 flex items-center gap-4">
        <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 border-2 border-gray-200 flex items-center justify-center">
          {clinic.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img 
              src={clinic.logoUrl} 
              alt={clinic.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          ) : (
            <span className="text-3xl text-gray-400">🏥</span>
          )}
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1">Logo URL (96px yumaloq)</label>
          <input
            type="url"
            value={clinic.logoUrl ?? ''}
            onChange={(e) => setClinic({ ...clinic, logoUrl: e.target.value || null })}
            placeholder="https://example.com/logo.png"
            className="w-full px-3 py-2 border rounded-lg"
          />
          <p className="text-xs text-gray-500 mt-1">
            .jpg, .png, .webp, .svg kabi rasmlarni qo'llab-quvvatlaymiz
          </p>
        </div>
      </div>
      
      {/* Asosiy maydonlar */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Klinika nomi *</label>
          <input
            value={clinic.name}
            onChange={(e) => setClinic({ ...clinic, name: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Telefon</label>
            <input
              value={clinic.phone ?? ''}
              onChange={(e) => setClinic({ ...clinic, phone: e.target.value || null })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Shahar</label>
            <input
              value={clinic.city ?? ''}
              onChange={(e) => setClinic({ ...clinic, city: e.target.value || null })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Manzil</label>
          <input
            value={clinic.address ?? ''}
            onChange={(e) => setClinic({ ...clinic, address: e.target.value || null })}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Tavsif</label>
          <textarea
            value={clinic.description ?? ''}
            onChange={(e) => setClinic({ ...clinic, description: e.target.value || null })}
            rows={3}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Ish vaqti</label>
          <input
            value={clinic.workingHours ?? ''}
            onChange={(e) => setClinic({ ...clinic, workingHours: e.target.value || null })}
            placeholder="09:00 - 18:00"
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isActive"
            checked={clinic.isActive}
            onChange={(e) => setClinic({ ...clinic, isActive: e.target.checked })}
          />
          <label htmlFor="isActive" className="text-sm">Faol</label>
        </div>
      </div>
      
      {/* Xato/Muvaffaqiyat */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">
          ✓ Saqlandi! Qaytmoqda...
        </div>
      )}
      
      {/* Action buttons */}
      <div className="mt-6 flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saqlanmoqda...' : 'Saqlash'}
        </button>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 border rounded-lg hover:bg-gray-50"
        >
          Bekor qilish
        </button>
      </div>
    </div>
  )
}
```

---

### Vazifa 1.3 — Reusable `ClinicLogo` komponenti

**Maqsad:** Logo har joyda bir xil ko'rinsin (yumaloq, fallback emoji, error handling).

**Fayl:** `components/ClinicLogo.tsx`

```tsx
import { cn } from '@/lib/utils' // yoki classnames

type Props = {
  src: string | null | undefined
  name: string
  size?: number  // px
  className?: string
}

export function ClinicLogo({ src, name, size = 96, className }: Props) {
  return (
    <div
      className={cn(
        'rounded-full overflow-hidden bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center flex-shrink-0',
        className
      )}
      style={{ width: size, height: size }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          className="w-full h-full object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement
            target.style.display = 'none'
            target.parentElement!.innerHTML = `<span style="font-size: ${size * 0.4}px">🏥</span>`
          }}
        />
      ) : (
        <span style={{ fontSize: size * 0.4 }}>🏥</span>
      )}
    </div>
  )
}
```

**Ishlatish:**

```tsx
// Admin clinic list
<ClinicLogo src={clinic.logoUrl} name={clinic.name} size={96} />

// Webapp clinic select
<ClinicLogo src={clinic.logoUrl} name={clinic.name} size={96} />

// Profil sahifasi (kichik)
<ClinicLogo src={clinic.logoUrl} name={clinic.name} size={40} />

// Bot bilan webapp ichidagi header
<ClinicLogo src={clinic.logoUrl} name={clinic.name} size={32} />
```

---

### Vazifa 1.4 — Logo render qilish kerakli joylar

Quyidagi fayllarni topib, ularda klinika nomi yonida `<ClinicLogo>` qo'sh:

1. **Super admin klinika ro'yxati:** `app/(panel)/admin/super/clinics/page.tsx`
   - Har klinika kartasida 96px logo + edit tugmasi
   - Card UI:
   ```tsx
   <div className="flex items-center gap-4 p-4 border rounded-lg">
     <ClinicLogo src={clinic.logoUrl} name={clinic.name} size={96} />
     <div className="flex-1">
       <h3 className="font-semibold">{clinic.name}</h3>
       <p className="text-sm text-gray-500">{clinic.city} • {clinic.phone}</p>
     </div>
     <Link href={`/admin/super/clinics/${clinic.id}/edit`} className="px-3 py-1 border rounded">
       Tahrirlash
     </Link>
   </div>
   ```

2. **Webapp klinika tanlash sahifasi:** `app/(webapp)/select-clinic/page.tsx` (yoki shu loyihadagi nomi)
   - Har klinika kartasida 96px logo

3. **Admin dashboard tepasi:** `app/(panel)/admin/layout.tsx` yoki `Sidebar.tsx`
   - Joriy klinika nomi yonida 40px logo

4. **Public API'ga `logoUrl` qo'shilganini tasdiqla:**
   - `app/api/clinics/route.ts` (public, webapp uchun) — `select` da `logoUrl: true` borligini tekshir

---

### Vazifa 1.5 — Test va deploy

1. **Lokal test:**
   ```bash
   npm run dev
   # super_admin sifatida login
   # /admin/super/clinics ga kir
   # Klinika tanla → "Tahrirlash" → name, logoUrl o'zgartir → Saqlash
   # Logo preview darrov ko'rinsinmi tekshir
   # Klinika ro'yxatiga qaytib, yangi logo ko'rinsinmi
   ```

2. **Edge case test:**
   - Bo'sh logoUrl (null) → 🏥 emoji fallback ko'rinsin
   - Noto'g'ri URL (`abc`) → 400 error qaytsin
   - Mavjud bo'lmagan URL (`https://example.com/yoq.jpg`) → onError fallback ishlasin
   - Klinika `isActive=false` qilinsa → webapp public API'da chiqmasin

3. **Git commit:**
   ```bash
   git add .
   git commit -m "feat(super-admin): clinic edit fix + logo URL support
   
   - PATCH /api/admin/super/clinics/[id] super_admin uchun ishlaydi
   - Edit sahifasi: name, phone, address, city, description, workingHours, logoUrl
   - ClinicLogo reusable komponent (96px yumaloq, fallback emoji)
   - Super admin clinic list'da logo, edit tugmasi
   - Webapp clinic select'da logo
   - Audit log: clinic.update action"
   ```

4. **Deploy:** main'ga push qiling, Vercel avtomatik deploy qiladi.

---

## ✅ Acceptance Criteria (yakuniy tekshiruv)

- [ ] Super admin har qanday klinikani tahrirlay oladi (name, phone, address, va h.k.)
- [ ] Klinikaga logo URL kiritish mumkin
- [ ] Logo 96px yumaloq formatda super admin klinika ro'yxatida ko'rinadi
- [ ] Logo edit sahifasida URL kiritilganda darrov preview ko'rinadi
- [ ] Logo URL bo'sh bo'lsa, fallback emoji (🏥) ko'rinadi
- [ ] Noto'g'ri rasm URL bo'lsa, onError'da fallback ishlaydi
- [ ] Noto'g'ri formatdagi URL (validatsiya) 400 error qaytaradi
- [ ] `clinic_admin` o'zining klinikasinigina tahrirlay oladi (super_admin emas)
- [ ] Audit log'da `clinic.update` yoziladi
- [ ] Webapp `/api/clinics` endpoint'i `logoUrl` qaytaradi
- [ ] `ClinicLogo` komponenti reusable va boshqa joylarda ishlatilmoqda
- [ ] Vercel deploy READY holatda

---

## 🚫 Bu fazada qilmaymiz

- ❌ Admin qo'shish (Faza 2)
- ❌ Filial qo'shish (Faza 3)
- ❌ Webapp klinika switcher (Faza 4)
- ❌ Tarix sahifasi (Faza 5)
- ❌ Schema migratsiya (Faza 5'da bo'ladi)
- ❌ Supabase Storage (URL bilan boshlaymiz)

---

## 📁 O'zgaradigan/yangi fayllar (taxminan)

```
app/
  api/
    admin/
      super/
        clinics/
          [id]/
            route.ts          ← YANGI yoki MAVJUDNI YANGILASH (GET, PATCH)
    clinics/
      route.ts                ← TEKSHIRISH (logoUrl select'da bormi)
  (panel)/
    admin/
      super/
        clinics/
          page.tsx            ← YANGILASH (logo + edit tugmasi)
          [id]/
            edit/
              page.tsx        ← YANGI

components/
  ClinicLogo.tsx              ← YANGI

lib/
  auth.ts                     ← TEKSHIRISH (super_admin role check)
```

---

## ⚠️ Diqqat

1. **Schema migratsiya kerak emas** — `clinics.logoUrl` allaqachon `nullable text` sifatida mavjud (Faza 0).
2. **Eski `app/api/admin/clinics/[id]/route.ts` borligini tekshir** — bo'lsa, super_admin bypass qo'shilsin, lekin yangi `super/` namespace'da edit qilish afzal.
3. **Auth helper'ni loyihaga moslashtir** — `getSession()`, `auth()`, yoki `getServerSession()` qaysi bo'lsa shuni ishlat.
4. **Tailwind class'lar** — agar `cn` helper bo'lmasa, oddiy `className` ishlat. shadcn/ui bo'lsa, `cn` import path'i `@/lib/utils`'dan.
5. **Image domains** — agar `next/image` ishlatilsa, `next.config.js`'da `images.domains` ga ishlatilayotgan rasm domain'lari qo'shilishi kerak. Hozir oddiy `<img>` ishlatamiz, shu sababli muammo yo'q.
6. **Audit log** — `prisma.auditLog.create` schema'da mavjud (`audit_logs` table — 1322 rows).

---

## 🎯 Boshlash buyrug'i

VS Code Claude'ga shu MD faylni ko'rsatib, quyidagini ayt:

> "Tibtaqvim loyihasida Faza 1 ni boshla. Birinchi loyiha tuzilmasini o'rgan (`app/` papkasini ko'r), keyin Vazifa 1.1'dan 1.5'gacha tartib bilan bajar. Har qadamdan keyin commit'siz, yakunda bitta commit qil."

Yaxshi ishlasin! 🚀
