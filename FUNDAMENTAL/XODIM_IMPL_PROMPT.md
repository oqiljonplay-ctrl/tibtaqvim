# Qabulxona Xodimlar Boshqaruvi — To'liq Implementatsiya Malumotnomasi

> **Kim uchun:** GitHub'ga ulanmagan, faqat lokal fayllarga kirishga ega Claude.
> **Maqsad:** Admin panelga qabulxona xodimlar (receptionist) boshqaruvini qo'shish — shifokor UI darajasida mukammal profil bilan.
> **Muhim:** Hech narsani o'chirma, faqat qo'sh. Mavjud `doctors` sahifasi va `/api/admin/staff` route'lariga tegilmaydi.

---

## 1. LOYIHA KONTEKSTI

### Texnologiyalar
- **Next.js 14** App Router + TypeScript + Tailwind
- **Prisma 6.x** ORM + **PostgreSQL** (Supabase, eu-west-1)
- **JWT** auth (HttpOnly cookie `auth_token`)
- **Supabase Project ID:** `lxqimithjjabhnldcugc`
- **Production URL:** https://tibtaqvim.vercel.app

### Rollar tizimi (`UserRole` enum, DB'da bor)
```
super_admin | clinic_admin | branch_admin | doctor | receptionist | patient
```

### Autentifikatsiya pattern
```typescript
// src/lib/auth.ts dan
import { requireAuth } from "@/lib/auth";
const auth = requireAuth(req);
if (!auth) return unauthorized();
// auth.role, auth.userId, auth.clinicId, auth.branchId
```

### API response pattern
```typescript
import { ok, created, error, unauthorized, forbidden, notFound, serverError } from "@/lib/api-response";
return ok({ ... });        // { success: true, data: ... }
return error("msg", 400);  // { success: false, error: { code, message } }
return created({ ... });   // 201 + { success: true, data: ... }
```

### Branch scope pattern
```typescript
import { getBranchScope, canManageResources } from "@/lib/branch-scope";
// super_admin → hamma, clinic_admin → o'z klinikasi, branch_admin → o'z filiali
const scope = getBranchScope(auth, explicitClinicId);
```

---

## 2. HOZIRGI HOLAT TAHLILI

### Mavjud backend (TEGILMAYDI)

| Route | Metod | Holat | Izoh |
|---|---|---|---|
| `/api/admin/staff` | POST | ✅ BOZR | receptionist + user atomik yaratish |
| `/api/admin/staff` | GET | ✅ BOR | barcha staff ro'yxati |
| `/api/admin/staff/[id]/reset-password` | POST | ✅ BOR | parol tiklash |

**POST /api/admin/staff mavjud body parametrlari:**
```json
{ "firstName": "", "lastName": "", "phone": "+998901234567",
  "role": "receptionist", "branchId": "...", "clinicId": "..." }
```
**Javob:** `{ success: true, data: { id, firstName, phone, role, clinicId, branchId, generatedPassword } }`

**POST /api/admin/staff/[id]/reset-password javob:**
```json
{ "success": true, "data": { "newPassword": "...", "userId": "...", "name": "...", "phone": "..." } }
```

### Yetishmayotgan backend (YANGI YOZILADI)

| Route | Metod | Nima qiladi |
|---|---|---|
| `/api/admin/staff/[id]` | GET | Bitta xodim ma'lumoti |
| `/api/admin/staff/[id]` | PATCH | firstName, lastName, phone, photoUrl, branchId yangilash |
| `/api/admin/staff/[id]` | DELETE | Soft delete (isActive=false) |

### DB hozirgi holat

**`staff` jadvali ustunlari (Supabase da tekshirildi):**
```
id TEXT NOT NULL
clinicId TEXT NOT NULL
branchId TEXT nullable
userId TEXT nullable UNIQUE
firstName TEXT NOT NULL
lastName TEXT NOT NULL
role UserRole DEFAULT 'receptionist'
phone TEXT nullable
isActive BOOLEAN DEFAULT true
createdAt TIMESTAMP DEFAULT NOW()
updatedAt TIMESTAMP
```
⚠️ `photoUrl` USTUNI YO'Q — migration bilan qo'shiladi.

**`users` jadvali ustunlari (Supabase da tekshirildi):**
```
id, clinicId, branchId, telegramId, tibId, phone (UNIQUE),
firstName, lastName, fatherName, region, district,
role, passwordHash, isActive, username (UNIQUE),
createdAt, updatedAt
```
`users` da `photoUrl` yo'q — faqat `staff` va `doctors` alohida jadvallarda saqlaydi.

### Mavjud frontend (TEGILMAYDI)

- `src/app/admin/(panel)/doctors/page.tsx` — shifokorlar sahifasi (receptionist ham yaratadi, lekin faqat shifokorlar ro'yxatda ko'rinadi)
- `src/components/DoctorCard.tsx` — doctor avatar + specialty + isim komponenti
- `src/components/ui/AdminSidebar.tsx` — sidebar (yangilanadi)

### Yetishmayotgan frontend (YANGI YOZILADI)

- `src/app/admin/(panel)/staff/page.tsx` — qabulxona xodimlar ro'yxati + qo'shish
- `src/app/admin/staff/[id]/edit/page.tsx` — xodim tahrirlash sahifasi
- `src/components/StaffCard.tsx` — xodim avatar + lavozim + isim komponenti

---

## 3. PRISMA SCHEMA (mavjud, faqat o'qib tushun)

```prisma
// prisma/schema.prisma — TEGILMAYDI, faqat ma'lumot uchun

model Staff {
  id         String   @id @default(cuid())
  clinicId   String
  branchId   String?
  userId     String?  @unique
  firstName  String
  lastName   String
  role       UserRole @default(receptionist)
  phone      String?
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  clinic               Clinic        @relation(fields: [clinicId], references: [id], onDelete: Cascade)
  branch               Branch?       @relation(fields: [branchId], references: [id])
  user                 User?         @relation(fields: [userId], references: [id])
  assignedAppointments Appointment[] @relation("AssignedStaff")

  @@index([clinicId])
  @@map("staff")
}

model User {
  id           String   @id @default(cuid())
  clinicId     String?
  branchId     String?
  phone        String?  @unique
  username     String?  @unique
  firstName    String
  lastName     String?
  fatherName   String?
  role         UserRole @default(patient)
  passwordHash String?
  isActive     Boolean  @default(true)
  // ... boshqa maydonlar
  staff        Staff?
  @@map("users")
}
```

---

## 4. SUPABASE MIGRATION — `staff.photoUrl` qo'shish

**Supabase MCP orqali bajariladigan migration. `prisma migrate` ISHLATMA — to'g'ridan Supabase'ga apply qil.**

```sql
-- Migration nomi: add_staff_photo_url
ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;
COMMENT ON COLUMN "staff"."photoUrl" IS 'Xodim profil rasm URL (ixtiyoriy)';
```

**Supabase MCP tool:** `mcp__claude_ai_Supabase__apply_migration`
```json
{
  "project_id": "lxqimithjjabhnldcugc",
  "name": "add_staff_photo_url",
  "query": "ALTER TABLE \"staff\" ADD COLUMN IF NOT EXISTS \"photoUrl\" TEXT;"
}
```

**Prisma schema yangilanishi** (`prisma/schema.prisma` dagi `Staff` modeliga qo'shish):
```prisma
model Staff {
  // ... mavjud maydonlar ...
  phone      String?
  photoUrl   String?   // ← QO'SHILADI (bu qator qo'shiladi)
  isActive   Boolean   @default(true)
```

Keyin `npx prisma generate` ishga tushiriladi (migrate emas, faqat client yangilash).

---

## 5. YANGI BACKEND: `/api/admin/staff/[id]/route.ts`

**Fayl yo'li:** `src/app/api/admin/staff/[id]/route.ts`

```typescript
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound, serverError } from "@/lib/api-response";
import { canManageResources } from "@/lib/branch-scope";
import { normalizePhone } from "@/lib/utils/phone";

type Params = { params: { id: string } };

// GET /api/admin/staff/[id] — bitta xodim ma'lumoti
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (!canManageResources(auth)) return forbidden();

    const staff = await prisma.staff.findUnique({
      where: { id: params.id },
      include: { branch: { select: { name: true } } },
    });

    if (!staff || !staff.isActive) return notFound("Xodim topilmadi");
    if (auth.role !== "super_admin" && staff.clinicId !== auth.clinicId) return forbidden();
    if (auth.role === "branch_admin" && staff.branchId !== auth.branchId) return forbidden();

    return ok(staff);
  } catch {
    return serverError();
  }
}

// PATCH /api/admin/staff/[id] — xodim ma'lumotlarini yangilash
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (!canManageResources(auth)) return forbidden();

    const staff = await prisma.staff.findUnique({ where: { id: params.id } });
    if (!staff || !staff.isActive) return notFound("Xodim topilmadi");
    if (auth.role !== "super_admin" && staff.clinicId !== auth.clinicId) return forbidden();
    if (auth.role === "branch_admin" && staff.branchId !== auth.branchId) return forbidden();

    const body = await req.json();
    const { firstName, lastName, phone: rawPhone, photoUrl, branchId } = body;

    if (!firstName) return error("firstName majburiy");

    // clinic_admin faqat o'z klinikasining filialini belgilashi mumkin
    if (branchId !== undefined && branchId !== null && auth.role === "clinic_admin") {
      const branch = await prisma.branch.findFirst({
        where: { id: branchId, isActive: true },
        select: { clinicId: true },
      });
      if (!branch || branch.clinicId !== auth.clinicId) return forbidden();
    }

    const phone = rawPhone ? normalizePhone(rawPhone) : undefined;

    // phone o'zgarsa — users jadvalida ham yangilash kerak
    const updated = await prisma.$transaction(async (tx) => {
      const updatedStaff = await tx.staff.update({
        where: { id: params.id },
        data: {
          firstName: firstName.trim(),
          lastName: (lastName ?? "").trim(),
          ...(phone !== undefined && { phone }),
          ...(photoUrl !== undefined && { photoUrl: photoUrl || null }),
          ...(branchId !== undefined && { branchId: branchId || null }),
        },
        include: { branch: { select: { name: true } } },
      });

      // users jadvalini ham sinxronlash
      if (updatedStaff.userId) {
        await tx.user.update({
          where: { id: updatedStaff.userId },
          data: {
            firstName: firstName.trim(),
            lastName: (lastName ?? "").trim() || null,
            ...(phone !== undefined && { phone }),
            ...(branchId !== undefined && { branchId: branchId || null }),
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: auth.userId,
          clinicId: auth.clinicId ?? staff.clinicId,
          action: "staff.update",
          payload: { staffId: params.id, changes: { firstName, lastName, phone: phone ?? null, photoUrl: photoUrl ?? null, branchId: branchId ?? null } },
        },
      });

      return updatedStaff;
    });

    return ok(updated);
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "P2002") return error("Bu telefon raqam allaqachon band", 409);
    return serverError();
  }
}

// DELETE /api/admin/staff/[id] — soft delete
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (!canManageResources(auth)) return forbidden();

    const staff = await prisma.staff.findUnique({ where: { id: params.id } });
    if (!staff) return notFound("Xodim topilmadi");
    if (auth.role !== "super_admin" && staff.clinicId !== auth.clinicId) return forbidden();
    if (auth.role === "branch_admin" && staff.branchId !== auth.branchId) return forbidden();

    await prisma.$transaction(async (tx) => {
      await tx.staff.update({ where: { id: params.id }, data: { isActive: false } });
      if (staff.userId) {
        await tx.user.update({ where: { id: staff.userId }, data: { isActive: false } });
      }
      await tx.auditLog.create({
        data: {
          actorId: auth.userId,
          clinicId: auth.clinicId ?? staff.clinicId,
          action: "staff.delete",
          payload: { staffId: params.id, firstName: staff.firstName, lastName: staff.lastName },
        },
      });
    });

    return ok({ deletedId: params.id });
  } catch {
    return serverError();
  }
}
```

---

## 6. YANGI KOMPONENT: `src/components/StaffCard.tsx`

Shifokor `DoctorCard` ga o'xshash, lekin `specialty` o'rniga `role` badge ko'rsatadi.

```typescript
interface StaffCardProps {
  staff: {
    firstName: string;
    lastName: string;
    role?: string;
    photoUrl?: string | null;
  };
  size?: "sm" | "md" | "lg";
}

const ROLE_LABELS: Record<string, string> = {
  receptionist: "Qabulxona xodimi",
  clinic_admin:  "Klinika admini",
  branch_admin:  "Filial admini",
  doctor:        "Shifokor",
};

export function StaffCard({ staff, size = "md" }: StaffCardProps) {
  const sizeClasses = {
    sm: { img: "w-8 h-8",   text: "text-sm",  sub: "text-xs" },
    md: { img: "w-12 h-12", text: "text-base", sub: "text-sm" },
    lg: { img: "w-16 h-16", text: "text-lg",  sub: "text-sm" },
  };
  const s = sizeClasses[size];
  const roleLabel = ROLE_LABELS[staff.role ?? "receptionist"] ?? staff.role;

  return (
    <div className="flex items-center gap-3">
      {staff.photoUrl ? (
        <img
          src={staff.photoUrl}
          alt={staff.firstName}
          className={`${s.img} rounded-full object-cover flex-shrink-0`}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      ) : (
        <div className={`${s.img} rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center flex-shrink-0`}>
          <span className="text-white font-medium text-xs">
            {staff.firstName[0]}{staff.lastName?.[0] ?? ""}
          </span>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className={`${s.text} font-medium text-gray-900 leading-tight`}>{roleLabel}</p>
        <p className={`${s.sub} text-gray-500`}>{staff.lastName} {staff.firstName}</p>
      </div>
    </div>
  );
}
```

---

## 7. YANGI SAHIFA: `src/app/admin/(panel)/staff/page.tsx`

Bu sahifa shifokorlar sahifasi (`/admin/(panel)/doctors/page.tsx`) bilan bir xil strukturada, lekin:
- Faqat `role: "receptionist"` xodimlarni ko'rsatadi
- Specialty, xizmatlar, queue modes YO'Q
- `StaffCard` komponenti ishlatiladi (DoctorCard emas)
- Reset password: `/api/admin/staff/[id]/reset-password` endpoint'i (MAVJUD)
- Edit: `/admin/staff/[id]/edit` sahifasiga o'tadi
- Delete: `/api/admin/staff/[id]` DELETE (YANGI)

```typescript
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StaffCard } from "@/components/StaffCard";

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  photoUrl: string | null;
  role: string;
  branch: { name: string } | null;
  isActive: boolean;
}

interface Credentials {
  phone: string | null;
  password: string;
  name: string;
}

interface Branch {
  id: string;
  name: string;
}

const emptyForm = {
  firstName: "", lastName: "", phone: "", photoUrl: "", branchId: "",
};

export default function AdminStaffPage() {
  const router = useRouter();
  const [staffList, setStaffList]     = useState<StaffMember[]>([]);
  const [branches, setBranches]       = useState<Branch[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [form, setForm]               = useState(emptyForm);
  const [submitting, setSubmitting]   = useState(false);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting]       = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [isBranchAdmin, setIsBranchAdmin] = useState(false);

  useEffect(() => {
    fetchStaff();
    fetchBranches();
  }, []);

  async function fetchStaff() {
    setLoading(true);
    const clinicId = localStorage.getItem("clinicId") || "";
    const res = await fetch(`/api/admin/staff${clinicId ? `?clinicId=${clinicId}` : ""}`, {
      credentials: "include",
    });
    const json = await res.json();
    if (json.success) {
      // Faqat receptionist rolini ko'rsat
      setStaffList((json.data as StaffMember[]).filter((s) => s.role === "receptionist"));
    }
    setLoading(false);
  }

  async function fetchBranches() {
    const role = localStorage.getItem("user_role");
    const myBranchId = localStorage.getItem("branchId");
    if (role === "branch_admin" && myBranchId) {
      setIsBranchAdmin(true);
      setForm((prev) => ({ ...prev, branchId: myBranchId }));
      return;
    }
    const res = await fetch("/api/admin/branches", { credentials: "include" });
    const json = await res.json();
    if (json.success) {
      setBranches(json.data);
      if (json.data.length === 1) {
        setForm((prev) => ({ ...prev, branchId: json.data[0].id }));
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      if (!form.branchId && !isBranchAdmin) {
        alert("Filialni tanlang");
        return;
      }

      const res = await fetch("/api/admin/staff", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName:  form.lastName,
          phone:     form.phone,
          photoUrl:  form.photoUrl || null,
          role:      "receptionist",
          branchId:  form.branchId || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowForm(false);
        const defaultBranchId = isBranchAdmin
          ? (localStorage.getItem("branchId") || "")
          : branches.length === 1 ? branches[0].id : "";
        setForm({ ...emptyForm, branchId: defaultBranchId });
        setCredentials({
          phone:    json.data.phone,
          password: json.data.generatedPassword,
          name:     `${form.firstName} ${form.lastName}`.trim(),
        });
        fetchStaff();
      } else {
        alert(json.error?.message || "Saqlashda xatolik");
      }
    } catch {
      alert("Server bilan bog'lanishda xatolik");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword(staffId: string, staffName: string) {
    setResettingId(staffId);
    try {
      const res = await fetch(`/api/admin/staff/${staffId}/reset-password`, {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json();
      if (json.success) {
        setCredentials({
          phone:    json.data.phone,
          password: json.data.newPassword,
          name:     json.data.name || staffName,
        });
      } else {
        alert(json.error?.message || "Parolni tiklashda xatolik");
      }
    } catch {
      alert("Server bilan bog'lanishda xatolik");
    } finally {
      setResettingId(null);
    }
  }

  async function handleDelete(staffId: string) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/staff/${staffId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json();
      if (json.success) {
        setStaffList((prev) => prev.filter((s) => s.id !== staffId));
      } else {
        alert(json.error?.message || "O'chirishda xatolik");
      }
    } catch {
      alert("Server bilan bog'lanishda xatolik");
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Qabulxona xodimlari</h1>
        <button
          onClick={() => {
            const defaultBranchId = isBranchAdmin
              ? (localStorage.getItem("branchId") || "")
              : branches.length === 1 ? branches[0].id : "";
            setForm({ ...emptyForm, branchId: defaultBranchId });
            setShowForm(true);
          }}
          className="btn-primary"
        >
          + Yangi xodim
        </button>
      </div>

      {showForm && (
        <div className="card mb-6">
          <h2 className="text-lg font-semibold mb-4">Yangi qabulxona xodimi qo&apos;shish</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {!isBranchAdmin && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Filial *</label>
                <select
                  className="input"
                  value={form.branchId}
                  onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                  required
                >
                  {branches.length !== 1 && <option value="">-- Filialni tanlang --</option>}
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                {branches.length === 0 && (
                  <p className="mt-1 text-xs text-red-600">⚠️ Hali filial qo&apos;shilmagan.</p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ism *</label>
              <input
                className="input"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Familya</label>
              <input
                className="input"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefon (login) *</label>
              <input
                className="input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+998 90 000 00 00"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Foto URL (ixtiyoriy)</label>
              <input
                className="input"
                type="url"
                value={form.photoUrl}
                onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
                placeholder="https://example.com/photo.jpg"
              />
              {form.photoUrl && (
                <img
                  src={form.photoUrl}
                  alt="preview"
                  className="w-16 h-16 rounded-full object-cover mt-2 border"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              )}
            </div>

            <div className="md:col-span-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs text-blue-700">
                🔑 Login uchun parol avtomatik generatsiya qilinadi va qo&apos;shishdan so&apos;ng bir marta ko&apos;rsatiladi.
              </p>
            </div>

            <div className="md:col-span-2 flex gap-3">
              <button
                type="submit"
                disabled={submitting || (!isBranchAdmin && !form.branchId)}
                className="btn-primary disabled:opacity-50"
              >
                {submitting ? "Saqlanmoqda..." : "Qo'shish"}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                Bekor
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-gray-400 text-sm text-center py-12">Yuklanmoqda...</div>
      ) : staffList.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🏥</p>
          <p className="text-gray-500 text-sm">Hali qabulxona xodimi qo&apos;shilmagan.</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 btn-primary"
          >
            + Birinchi xodimni qo&apos;shish
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {staffList.map((s) => (
              <div key={s.id} className="card relative">
                <div className="absolute top-3 right-3 flex gap-1">
                  <button
                    onClick={() => handleResetPassword(s.id, `${s.lastName ?? ""} ${s.firstName}`)}
                    disabled={resettingId === s.id}
                    className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition disabled:opacity-40"
                    title="Parolni tiklash"
                  >
                    🔑
                  </button>
                  <button
                    onClick={() => router.push(`/admin/staff/${s.id}/edit`)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                    title="Tahrirlash"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(s.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                    title="O'chirish"
                  >
                    🗑️
                  </button>
                </div>

                <StaffCard staff={s} size="md" />
                {s.phone && (
                  <p className="text-xs text-gray-400 mt-2 ml-15">{s.phone}</p>
                )}
                {s.branch ? (
                  <p className="text-xs text-gray-500 mt-1">🏥 {s.branch.name}</p>
                ) : (
                  <p className="text-xs text-amber-600 mt-1">⚠️ Filial belgilanmagan</p>
                )}
              </div>
            ))}
          </div>

          {confirmDeleteId && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-xl">
                <h3 className="font-semibold text-lg mb-2">Xodimni o&apos;chirish</h3>
                <p className="text-gray-600 text-sm mb-4">
                  {(() => {
                    const found = staffList.find((x) => x.id === confirmDeleteId);
                    return found ? `${found.lastName ?? ""} ${found.firstName}` : "";
                  })()}
                  &nbsp;ni o&apos;chirmoqchimisiz? Bu amal akkauntni bloklaydi.
                </p>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    disabled={deleting}
                    className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
                  >
                    Bekor qilish
                  </button>
                  <button
                    onClick={() => handleDelete(confirmDeleteId)}
                    disabled={deleting}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
                  >
                    {deleting ? "O'chirilmoqda..." : "Ha, o'chirish"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {credentials && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-xl">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">🔑</span>
              <h3 className="font-semibold text-lg">
                {credentials.phone ? "Xodim qo'shildi" : "Parol tiklandi"}
              </h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">{credentials.name}</p>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 font-mono text-sm mb-3 select-all">
              {credentials.phone && (
                <div className="mb-1">Login: <span className="font-bold text-gray-900">{credentials.phone}</span></div>
              )}
              <div>Parol: <span className="font-bold text-gray-900">{credentials.password}</span></div>
            </div>
            <div className="flex items-start gap-2 mb-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <span className="flex-shrink-0">⚠️</span>
              <p className="text-amber-800 text-xs">Bu parol qayta ko&apos;rsatilmaydi. Hoziroq saqlab qo&apos;ying.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const text = credentials.phone
                    ? `Login: ${credentials.phone}\nParol: ${credentials.password}`
                    : `Parol: ${credentials.password}`;
                  navigator.clipboard.writeText(text);
                }}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              >
                Nusxalash
              </button>
              <button
                onClick={() => setCredentials(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## 8. YANGI SAHIFA: `src/app/admin/staff/[id]/edit/page.tsx`

Shifokor edit sahifasi (`/admin/doctors/[id]/edit/page.tsx`) ga o'xshash, lekin:
- `DoctorProfileFields` YO'Q
- `DoctorBlockedDatesManager` YO'Q
- Xizmatlar/queueModes YO'Q
- Faqat: ism, familya, telefon, foto URL, filial

```typescript
"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

interface Branch { id: string; name: string }

const emptyForm = { firstName: "", lastName: "", phone: "", photoUrl: "", branchId: "" };

export default function EditStaffPage() {
  const router   = useRouter();
  const params   = useParams();
  const staffId  = params.id as string;

  const [form, setForm]         = useState(emptyForm);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/staff/${staffId}`, { credentials: "include" }).then((r) => r.json()),
      fetch("/api/admin/branches",          { credentials: "include" }).then((r) => r.json()),
    ]).then(([staffJson, brJson]) => {
      if (staffJson.success && staffJson.data) {
        const d = staffJson.data;
        setForm({
          firstName: d.firstName ?? "",
          lastName:  d.lastName  ?? "",
          phone:     d.phone     ?? "",
          photoUrl:  d.photoUrl  ?? "",
          branchId:  d.branchId  ?? "",
        });
      } else {
        setErrorMsg(staffJson.error?.message ?? "Xodim topilmadi");
      }
      if (brJson.success) setBranches(brJson.data ?? []);
    }).catch(() => setErrorMsg("Ma'lumotlarni yuklashda xatolik"))
      .finally(() => setLoading(false));
  }, [staffId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setErrorMsg(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/staff/${staffId}`, {
        method:  "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName:  form.lastName,
          phone:     form.phone     || null,
          photoUrl:  form.photoUrl  || null,
          branchId:  form.branchId  || null,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setErrorMsg(json.error?.message ?? "Saqlashda xatolik");
        return;
      }
      setSaved(true);
      setTimeout(() => { setSaved(false); router.push("/admin/staff"); }, 1500);
    } catch {
      setErrorMsg("Server bilan bog'lanishda xatolik");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-gray-400 text-sm text-center py-12">Yuklanmoqda...</div>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push("/admin/staff")} className="text-gray-500 hover:text-gray-700 text-sm">
          ← Orqaga
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Xodimni tahrirlash</h1>
      </div>

      {saved && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-700 text-sm">
          ✅ Ma&apos;lumotlar saqlandi
        </div>
      )}
      {errorMsg && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
          ⚠️ {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Asosiy ma&apos;lumotlar</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ism *</label>
              <input
                className="input"
                required
                value={form.firstName}
                onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Familya</label>
              <input
                className="input"
                value={form.lastName}
                onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefon (login)</label>
              <input
                className="input"
                value={form.phone}
                placeholder="+998 90 000 00 00"
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Filial</label>
              <select
                className="input"
                value={form.branchId}
                onChange={(e) => setForm((p) => ({ ...p, branchId: e.target.value }))}
              >
                <option value="">-- Filial yo&apos;q --</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Foto URL (ixtiyoriy)</label>
              <input
                className="input"
                type="url"
                value={form.photoUrl}
                placeholder="https://example.com/photo.jpg"
                onChange={(e) => setForm((p) => ({ ...p, photoUrl: e.target.value }))}
              />
              {form.photoUrl && (
                <img
                  src={form.photoUrl}
                  alt="preview"
                  className="w-20 h-20 rounded-full object-cover mt-3 border-2 border-gray-200"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3 pb-4">
          <button type="submit" disabled={saving || saved} className="btn-primary disabled:opacity-50">
            {saving ? "Saqlanmoqda..." : saved ? "✓ Saqlandi" : "Saqlash"}
          </button>
          <button type="button" className="btn-secondary" onClick={() => router.push("/admin/staff")}>
            Bekor
          </button>
        </div>
      </form>
    </div>
  );
}
```

---

## 9. ADMIN SIDEBAR YANGILASH

**Fayl:** `src/components/ui/AdminSidebar.tsx`

`ALL_ADMIN_ITEMS` arrayiga quyidagi qatorni qo'sh — "Shifokorlar" dan keyin:

```typescript
const ALL_ADMIN_ITEMS: SidebarItem[] = [
  { href: "/admin",              label: "Dashboard" },
  { href: "/admin/services",     label: "Xizmatlar" },
  { href: "/admin/doctors",      label: "Shifokorlar" },
  { href: "/admin/staff",        label: "Xodimlar" },          // ← QO'SHILADI
  { href: "/admin/branches",     label: "Filiallar",       roles: ["super_admin", "clinic_admin"] },
  // ... qolgan itemlar o'zgarmaydi
];
```

---

## 10. PRISMA SCHEMA YANGILASH

**Fayl:** `prisma/schema.prisma` — faqat `Staff` modeliga `photoUrl` qo'shish:

```prisma
model Staff {
  id         String   @id @default(cuid())
  clinicId   String
  branchId   String?
  userId     String?  @unique
  firstName  String
  lastName   String
  role       UserRole @default(receptionist)
  phone      String?
  photoUrl   String?   // ← QO'SHILADI
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  // ... relatsiyalar o'zgarmaydi
}
```

---

## 11. GET /api/admin/staff MAVJUD ROUTE KICHIK YANGILASH

**Fayl:** `src/app/api/admin/staff/route.ts` — GET handler'da select'ga `photoUrl` va `branch` qo'shish kerak (hozir yo'q).

Mavjud GET (line 154-164):
```typescript
const staff = await prisma.user.findMany({
  where: { ...scope, role: { not: "patient" }, isActive: true },
  select: { id: true, firstName: true, lastName: true, phone: true, role: true, branchId: true, createdAt: true },
  orderBy: { createdAt: "desc" },
});
```

Bu `users` jadvalidan o'qiydi — lekin `photoUrl` `staff` jadvalida. Shuning uchun bu route'ni emas, alohida staff-specific route yozamiz.

**YO'L 2 (TO'G'RI):** `staff/page.tsx` frontend'i hozirgi `GET /api/admin/staff` o'rniga to'g'ridan `staff` jadvalidan o'quvchi yangi endpoint ishlatadi. Yoki mavjud endpoint'ni almashtirish.

**Eng toza yechim:** `GET /api/admin/staff` ni `staff` jadvalidan o'qib, `branch` include qiluvchi, `photoUrl` qaytaruvchi qilib yangilash:

```typescript
// GET handler — to'liq almashtirish (staff route.ts da, line 146-169)
export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (!["super_admin", "clinic_admin", "branch_admin"].includes(auth.role)) return forbidden();

    const explicitClinicId = new URL(req.url).searchParams.get("clinicId");
    const scope = getBranchScope(auth, explicitClinicId);

    const staff = await prisma.staff.findMany({
      where: { ...scope, isActive: true },
      include: { branch: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });

    return ok(staff);
  } catch {
    return error("Server xatosi", 500);
  }
}
```

---

## 12. BAJARILADIGAN TARTIB

Quyidagi tartibda bajaring (har qadamdan so'ng tekshiring):

### Qadam 1: Supabase migration
```
Supabase MCP → apply_migration
project_id: lxqimithjjabhnldcugc
name: add_staff_photo_url
query: ALTER TABLE "staff" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;
```

### Qadam 2: prisma/schema.prisma yangilash
`Staff` modeliga `photoUrl String?` qo'shish.

### Qadam 3: prisma generate
```bash
npx prisma generate
```

### Qadam 4: Backend route yaratish
`src/app/api/admin/staff/[id]/route.ts` — YANGI fayl (§5 dagi to'liq kod).

### Qadam 5: GET /api/admin/staff yangilash
`src/app/api/admin/staff/route.ts` — GET handler'ni `prisma.staff.findMany` bilan almashtirish (§11).

### Qadam 6: StaffCard komponenti
`src/components/StaffCard.tsx` — YANGI fayl (§6 dagi to'liq kod).

### Qadam 7: Staff list sahifasi
`src/app/admin/(panel)/staff/page.tsx` — YANGI fayl (§7 dagi to'liq kod).

### Qadam 8: Staff edit sahifasi
`src/app/admin/staff/[id]/edit/page.tsx` — YANGI fayl (§8 dagi to'liq kod).

### Qadam 9: AdminSidebar yangilash
`src/components/ui/AdminSidebar.tsx` — "Xodimlar" elementi qo'shish (§9).

### Qadam 10: TypeScript tekshiruvi
```bash
npx tsc --noEmit
```

### Qadam 11: Build
```bash
npm run build
```

### Qadam 12: Deploy
```bash
npx vercel --prod --yes
```

---

## 13. SHIFOKORGA XOS — RECEPTIONIST'DA BO'LMAYDIGAN QISMLAR

Quyidagi kod bloklari faqat shifokorlar sahifasida — receptionist sahifasida BUTUNLAY YO'Q:

| Komponent/Route | Fayl | Receptionist'ga kerakmi? |
|---|---|---|
| `DoctorProfileFields` | `src/components/DoctorProfileFields.tsx` | ❌ YO'Q |
| `DoctorBlockedDatesManager` | `src/components/DoctorBlockedDatesManager.tsx` | ❌ YO'Q |
| `QueueModeSelector` | `/admin/(panel)/doctors/page.tsx:46-97` | ❌ YO'Q |
| `DoctorQueueModes` | `/admin/(panel)/doctors/page.tsx:99-174` | ❌ YO'Q |
| `specialty` maydoni | Forma + DB | ❌ YO'Q |
| `serviceIds` biriktirilish | POST + PATCH | ❌ YO'Q |
| `/api/admin/doctors/[id]/profile` | profile route | ❌ YO'Q |
| `doctor_specialties/directions/experiences/workplaces` | DB jadvallari | ❌ YO'Q |
| `/api/doctors/[id]/blocked-dates` | block route | ❌ YO'Q |
| `FlipCard` profil | webapp | ❌ YO'Q |

**Umumiy (receptionist'da ham bor):**
- firstName, lastName, phone, photoUrl, branchId → `staff` jadvalida
- Yaratish: `POST /api/admin/staff` (MAVJUD, tegilmaydi)
- Parol tiklash: `POST /api/admin/staff/[id]/reset-password` (MAVJUD, tegilmaydi)
- Login: `/api/auth/login` → phone+password (MAVJUD, tegilmaydi)
- Soft delete: `isActive=false` → `staff` + `users` jadvali

---

## 14. TEKSHIRISH ROYHATI

Deploy'dan keyin quyidagilarni tekshiring:

- [ ] `/admin/staff` sahifasi ochiladi (sidebar'da ko'rinadi)
- [ ] "+ Yangi xodim" tugmasi forma ochadi
- [ ] Xodim qo'shilganda credentials modal chiqadi (phone + parol)
- [ ] Xodim kartasida ism, telefon, filial ko'rinadi
- [ ] ✏️ edit tugmasi `/admin/staff/[id]/edit` ga o'tadi
- [ ] Edit sahifasida ma'lumotlar yuklangan holda ko'rinadi
- [ ] Saqlash ishlaydi (PATCH endpoint)
- [ ] 🔑 tugma parol tiklaydi va credentials modal ko'rsatadi
- [ ] 🗑️ tugma confirm modal chiqaradi va o'chiradi
- [ ] O'chirilgan xodim ro'yxatdan yo'qoladi
- [ ] Foto URL kiritilganda preview ko'rinadi
- [ ] `npx tsc --noEmit` — 0 xato
- [ ] `npm run build` — 0 xato

---

## 15. XAVF VA CHEKLOVLAR

1. **`GET /api/admin/staff` o'zgarishi** — Mavjud `/admin/(panel)/doctors/page.tsx` sahifasi ham shu endpoint'ni chaqiradi (receptionist yaratish uchun). O'zgarishdan keyin u ham `staff` jadvalidan o'qiydi — bu to'g'ri, chunki receptionist `staff` jadvalida.

2. **photoUrl `users` jadvalida yo'q** — Bu normal: shifokorlar `doctors.photoUrl`, qabulxona xodimlari `staff.photoUrl` ishlatadi. `users` jadvaliga photoUrl qo'shish shart emas.

3. **Login flow** — `POST /api/auth/login` telefon yoki username bilan ishlaydi — o'zgarish kerak emas. Receptionist phone bilan login qiladi.

4. **Reception panel** — `src/app/reception/page.tsx` mavjud. Qabulxona xodimi login qilganda shu sahifaga kiradi. Bu sahifaga tegilmaydi.

5. **branch_admin** — `clinic_admin` ruxsatiga ega faqat o'z klinikasi. `branch_admin` faqat o'z filialini ko'radi. Bu pattern barcha admin route'larda bir xil.
