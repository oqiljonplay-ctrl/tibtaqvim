# IMPL: Onboarding + Booking Oqimi — Ishchi Reja
> Sana: 2026-05-30 | Asosi: DIAGNOSTIKA_HISOBOT.md + 5 savol + DB/RLS tekshiruv
> **Bu faylni o'qigan Claude shu faylning o'zi bo'yicha ishni bajaradi.**
> KOD YOZISH RUXSAT — bu fayl implementation uchun.

---

## QARORLAR (S1–S5 yopildi) + 3 TUZATMA

| # | Savol | Qaror |
|---|-------|-------|
| S1 | Region gate uchun majburiy? | **IXTIYORIY** — gate: faqat `!phone \|\| firstName==="Foydalanuvchi"` |
| S2 | Doctor qaysi flow'ga? | **IKKALA FLOW** — Flow 1 (page.tsx) va Flow 2 (branches/[branchId]) |
| S3 | DoctorPicker alohida? | **HA** — `src/components/webapp/DoctorPicker.tsx` |
| S4 | requestContact first_name? | **HA** — forma pre-fill sifatida (majburiy emas) |
| S5 | normalizePhone formati? | **TASDIQLANDI** — `"998901234567" → "+998901234567"` ishlaydi |

---

## TUZATMALAR (DB to'g'ridan tekshirildi — 2026-05-30)

### T1 — RLS D21 NOTO'G'RI EDI → TO'G'RISI:
```
DIAGNOSTIKA_HISOBOT.md D21: "Supabase RLS umuman yo'q" — XATO.
HAQIQAT (pg_tables so'rovi bilan tasdiqlandi):
  30/30 jadval rowsecurity = true ✅

Lekin 5 jadval RLS yoqilgan, POLICY yo'q → bu jadvallar
anon/authenticated uchun BUTUNLAY BLOKLANGAN:
  ❌ clinic_promotions     — policy yo'q
  ❌ doctor_directions     — policy yo'q
  ❌ doctor_experiences    — policy yo'q
  ❌ doctor_specialties    — policy yo'q
  ❌ doctor_workplaces     — policy yo'q

AMMO: Prisma DATABASE_URL = postgres (service_role) → RLS BYPASS
→ Barcha API route'lar bu jadvallarni bemalol o'qiydi ✅
→ Frontend'dan to'g'ridan Supabase client ishlatilmaydi → muammo yo'q

DoctorPicker shifokor ma'lumotlarini API orqali oladi → XAVFSIZ ✅
```

### T2 — ClinicGuard + Yangi user oqimi TASDIQLANDI:
```
Bot DOIM ?clinic=xxx&tgid=yyy yuboradi →
  ClinicProvider → /api/clinics/xxx → clinic yuklanadi →
  ClinicGuard passes → page.tsx dashboard → ProfileFlipCard ko'rinadi ✅

Browser to'g'ridan (/webapp, clinic yo'q):
  ClinicGuard → /webapp/clinics (klinikalar ro'yxati) →
  user tanlaydi → page.tsx dashboard → ProfileFlipCard ✅

XULOSA: Onboarding (telefon + FIO) page.tsx dashboard'da ko'rinadi.
        ClinicGuard to'siq emas — bot har doim clinic URL'da.
```

### T3 — Navbat raqami (D18) — QAROR:
```
HAQIQAT (DB dan):
  2 doctorli xizmat 1: "Mskt" (Oqil + Fariz) → ikkisi ham queueMode=live
    → queueNumber=null (kassada beriladi) → service-level muammo yo'q
  2 doctorli xizmat 2: "Nevropatolog Neyroxirurg" (Nodir + Bahodir)
    → Nodir: queueMode=online  → raqam beriladi
    → Bahodir: queueMode=live → raqam null
    → Amalda conflict yo'q (turli mode)

QAROR: booking.service.ts O'ZGARMAYDI.
  Hozir navbat service-level. Amalda 2+ online doctorli xizmat yo'q.
  Kelajakda kerak bo'lsa — alohida task.
```

---

## DB STATISTIKA (real — 2026-05-30)

```
Klinikalar: 3
  BUYUK TABIB (clinic-demo): 2 filial, 14 xizmat, 11 shifokor, 76 bron — ASOSIY
  Test klinika: 3 filial, 3 xizmat, 1 shifokor, 4 bron
  MOLEKULA: 1 filial, xizmat yo'q, shifokor yo'q

Foydalanuvchilar: 30
  phone bor:   29 (97%) ← faqat 1 ta yo'q
  region bor:   2 (7%)  ← 28 ta yo'q → S1 ixtiyoriy TASDIQLANDI!

Bronlar: 80 (56 booked, 18 arrived, 3 missed, 3 cancelled)
  doctorId=null: 36 (45%) ← doctor qadam kerakligi TASDIQLANDI

2+ doctorli xizmatlar:
  Mskt: Oqil Sayfiyev (live) + Fariz Abdullayev (live)
  Nevropatolog Neyroxirurg: Nodir Rahimov (online) + Bahodir Sodiqov (live)

Shifokorlar flip-card holati (12 dan):
  To'ldirilgan: 2 (Madamin Elchjiyev, Ibrat O'ktamov)
  Bo'sh profil: 10 (specialties=0, directions=0, bio=null)

Vercel cron: 
  /api/reminders?type=day_before → har kun 03:00 UTC
  /api/cron/ad-broadcast         → har kun 08:00 UTC
GitHub: oqiljonplay-ctrl/tibtaqvim (main branch)
```

---

## ARXITEKTURA XULOSA (ishdan oldin o'qi)

```
/webapp kirish → middleware (public) → layout → ClinicProvider → ClinicGuard
  ↳ clinic yo'q → /webapp/clinics (klinikalar ro'yxati)
  ↳ clinic bor → page.tsx (appMode: loading|dashboard|booking)

Dashboard bottom bar:
  "Yangi bron" → /webapp/clinics/${cId} → clinics/[id]/page.tsx
    ↳ 1 filial → auto redirect → branches/[branchId]/page.tsx  ← ASOSIY FLOW
  "Klinikalar" → /webapp/my-clinics
  "Tarix" → /webapp/history

IKKALA BOOKING FLOW:
  Flow 2: branches/[branchId]/page.tsx — to'liq (dependent, patient, progress bar)
           ← Asosiy. Doctor shu yerga birinchi qo'shiladi.
  Flow 1: page.tsx ichida (mode=booking) — fallback/legacy
           ← Doctor bu yerga ham qo'shiladi (S2 qaror)

activeClinic context: { id, name, city, logoUrl, address, phone }
  ← clinic.name allaqachon bor, migration kerak emas
```

---

## YARATILADI / O'ZGARTIRILADI — ro'yxat

```
YANGI:
  src/components/webapp/DoctorPicker.tsx          ← yangi komponent

O'ZGARADI:
  src/components/webapp/ProfileFlipCard.tsx        ← phone ulashish
  src/app/api/webapp/profile/route.ts              ← phone field qo'shish
  src/app/webapp/clinics/[id]/branches/[branchId]/page.tsx  ← doctor qadam (Flow 2)
  src/app/webapp/page.tsx                          ← doctor qadam (Flow 1) + gate + done

O'ZGARMAYDI (tasdiqlangan):
  prisma/schema.prisma       — migration yo'q, barcha field bor
  src/app/api/book/route.ts  — doctorId allaqachon qabul qiladi
  src/lib/services/booking.service.ts — doctorId null-safe, cross-clinic check bor
  src/lib/validators/booking.ts      — doctorId?: string allaqachon bor
  src/app/api/services/route.ts      — doctors[] allaqachon qaytaradi
  src/middleware.ts                  — /webapp PUBLIC_PATH
```

---

## BOSQICH 1 — `DoctorPicker.tsx` yaratish

**Fayl:** `src/components/webapp/DoctorPicker.tsx` (yangi)

**Vazifasi:** xizmatga biriktirilgan shifokorlar orasidan tanlash.
- 0 shifokor → komponent render qilinmaydi (parent o'tkazib yuboradi)
- 1 shifokor → auto-banner + "Davom etish" tugmasi
- N shifokor → kartalar grid + tanlash

**Props interface:**
```typescript
export interface PickerDoctor {
  id: string
  firstName: string
  lastName: string
  specialty: string
  photoUrl: string | null
  queueMode?: "live" | "online" | "slot"
}

interface Props {
  doctors: PickerDoctor[]
  onSelect: (doctor: PickerDoctor) => void
  onSkip?: () => void          // 0 shifokor yoki "shifokor muhim emas" uchun
}
```

**UI tuzilma:**
```
Auto (1 shifokor):
  bg-blue-50 border-blue-200 rounded-2xl p-4
  Avatar (photoUrl || initials) | Ism, mutaxassislik
  "✅ Shu shifokorga yozilasiz" badge
  "Davom etish →" btn-primary tugmasi → onSelect(doctors[0])

N shifokor:
  "Shifokorni tanlang" sarlavha
  grid grid-cols-1 gap-3
    Har bir karta: rounded-2xl bg-white border shadow-sm p-4
      Avatar | Ism Familya | Mutaxassislik | queueMode badge
      active:scale-95 transition-all
      onClick → onSelect(doctor)
```

**Avatar helper:**
```typescript
function Avatar({ doctor }: { doctor: PickerDoctor }) {
  const initials = [doctor.firstName[0], doctor.lastName[0]].join("").toUpperCase()
  if (doctor.photoUrl) return <img src={doctor.photoUrl} className="w-12 h-12 rounded-full object-cover" />
  return (
    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm">
      {initials}
    </div>
  )
}
```

**queueMode badge:**
```typescript
const queueLabels = { live: "Kunlik 💵", online: "Onlayn 🎫", slot: "Vaqtli ⏰" }
// bg-blue-50 text-blue-600 text-xs px-2 py-0.5 rounded-full
```

**Responsive:** `Container` import kerak emas — parent Container ichida bo'ladi.

---

## BOSQICH 2 — `ProfileFlipCard.tsx` — telefon ulashish

**Fayl:** `src/components/webapp/ProfileFlipCard.tsx`

### 2a. Props kengaytirish
```typescript
interface Props {
  profile: ProfileData         // o'zgarmaydi
  telegramId: string           // o'zgarmaydi
  headerDate: string           // o'zgarmaydi
  onUpdated: (updated: Partial<ProfileData>) => void  // o'zgarmaydi
  // YANGI:
  onPhoneAdded?: (phone: string) => void  // parent'ga xabar berish (ixtiyoriy)
}
```

### 2b. Yangi state (komponent ichiga)
```typescript
const [showPhoneInput, setShowPhoneInput] = useState(false)
const [phoneInput, setPhoneInput] = useState("")
const [phoneError, setPhoneError] = useState<string | null>(null)
const [phoneSaving, setPhoneSaving] = useState(false)
```

### 2c. requestContact handler (FRONT tomonga qo'shiladi)
```typescript
async function handleRequestContact() {
  const tg = (window as any).Telegram?.WebApp
  const canRequest = typeof tg?.requestContact === "function"
  
  if (canRequest) {
    tg.requestContact((result: any) => {
      if (result.status === "sent") {
        const rawPhone = result.contact?.phone_number ?? ""
        const firstName = result.contact?.first_name ?? ""
        // normalizePhone import kerak
        import("@/lib/utils/phone").then(({ normalizePhone }) => {
          const normalized = normalizePhone(rawPhone)
          savePhone(normalized, firstName)
        })
      } else {
        // Bekor qilindi → manual input ko'rsat
        setShowPhoneInput(true)
      }
    })
  } else {
    // Desktop/browser → to'g'ridan manual
    setShowPhoneInput(true)
  }
}

async function savePhone(phone: string, firstName?: string) {
  setPhoneSaving(true)
  setPhoneError(null)
  try {
    const body: Record<string, string> = { telegramId, phone }
    // S4 qaror: first_name ham yuboriladi (pre-fill uchun)
    if (firstName && firstName.length >= 2) body.firstName = firstName
    
    const res = await fetch("/api/webapp/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) {
      setPhoneError(data.error ?? "Saqlashda xato")
      return
    }
    // Muvaffaqiyat
    setShowPhoneInput(false)
    onUpdated({ phone: data.data.phone, firstName: data.data.firstName })
    onPhoneAdded?.(data.data.phone)
  } catch {
    setPhoneError("Tarmoq xatosi")
  } finally {
    setPhoneSaving(false)
  }
}
```

### 2d. FRONT TOMON o'zgarishi (146-154 qator atrofida)

Hozirgi kod:
```tsx
{profile.phone
  ? <p className="text-blue-200 text-xs mt-2">📞 {profile.phone}</p>
  : <p className="text-blue-300 text-xs mt-2 italic">Telefon raqam kiritilmagan</p>
}
```

Yangi kod:
```tsx
{profile.phone ? (
  <p className="text-blue-200 text-xs mt-2">📞 {profile.phone}</p>
) : showPhoneInput ? (
  // Manual input overlay
  <div className="mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
    <input
      type="tel"
      className="w-full bg-white/20 text-white placeholder-blue-300 rounded-xl px-3 py-2 text-sm
                 border border-white/30 focus:outline-none focus:border-white/60"
      placeholder="+998 90 123 45 67"
      value={phoneInput}
      onChange={(e) => setPhoneInput(e.target.value)}
      autoFocus
    />
    {phoneError && <p className="text-red-300 text-xs">{phoneError}</p>}
    <div className="flex gap-2">
      <button
        onClick={() => savePhone(normalizePhone(phoneInput))}
        disabled={phoneSaving || phoneInput.length < 9}
        className="flex-1 bg-white text-blue-700 font-semibold text-xs py-2 rounded-xl
                   disabled:opacity-50 active:scale-95 transition-all"
      >
        {phoneSaving ? "Saqlanmoqda..." : "Saqlash"}
      </button>
      <button
        onClick={() => { setShowPhoneInput(false); setPhoneError(null) }}
        className="px-3 py-2 text-blue-200 text-xs rounded-xl bg-white/10"
      >
        Bekor
      </button>
    </div>
  </div>
) : (
  // requestContact tugmasi
  <button
    onClick={(e) => { e.stopPropagation(); handleRequestContact() }}
    className="mt-2 flex items-center gap-1.5 text-xs bg-white/20 hover:bg-white/30
               text-white px-3 py-1.5 rounded-full active:scale-95 transition-all"
  >
    📞 Telefon ulash
  </button>
)}
```

**Import qo'shish:** `import { normalizePhone } from "@/lib/utils/phone"`

---

## BOSQICH 3 — `PATCH /api/webapp/profile` — phone qabul qilish

**Fayl:** `src/app/api/webapp/profile/route.ts`

### 3a. Body parsing (11-qator atrofida)
```typescript
// HOZIR:
const { telegramId, firstName, lastName, fatherName, region, district } = body ?? {}

// YANGI:
const { telegramId, firstName, lastName, fatherName, region, district, phone } = body ?? {}
```

### 3b. Phone validatsiya (firstName tekshiruvidan keyin)
```typescript
// firstName tekshiruvidan keyin, user.findUnique'dan oldin:
let normalizedPhone: string | undefined = undefined
if (phone !== undefined && phone !== null) {
  if (typeof phone !== "string" || phone.trim().length === 0) {
    return error("Telefon format noto'g'ri", 400)
  }
  // normalizePhone import: import { normalizePhone } from "@/lib/utils/phone"
  normalizedPhone = normalizePhone(phone.trim())
  if (!/^\+998\d{9}$/.test(normalizedPhone)) {
    return error("Telefon +998XXXXXXXXX formatida bo'lishi kerak", 400)
  }
}
```

### 3c. prisma.user.update (32-qator atrofida)
```typescript
// HOZIR:
data: {
  firstName: newFirstName,
  lastName: newLastName,
  fatherName: newFatherName,
  region: newRegion,
  district: newDistrict,
},

// YANGI:
data: {
  firstName: newFirstName,
  lastName: newLastName,
  fatherName: newFatherName,
  region: newRegion,
  district: newDistrict,
  ...(normalizedPhone !== undefined ? { phone: normalizedPhone } : {}),
},
```

### 3d. P2002 unique constraint (try/catch blokiga)
```typescript
// HOZIR:
} catch {
  return error("Server xatosi", 500)
}

// YANGI:
} catch (err: any) {
  if (err?.code === "P2002" && err?.meta?.target?.includes("phone")) {
    return error("Bu telefon raqami boshqa hisobda ro'yxatdan o'tgan", 409)
  }
  return error("Server xatosi", 500)
}
```

### 3e. select'ga phone qo'shish (allaqachon bor — tekshirish)
```typescript
// select: { ..., phone: true, tibId: true } — allaqachon bor, o'zgarmaydi
```

---

## BOSQICH 4 — Flow 2 Doctor qadami (`branches/[branchId]/page.tsx`)

**Fayl:** `src/app/webapp/clinics/[id]/branches/[branchId]/page.tsx`

### 4a. Import qo'shish (fayl boshiga)
```typescript
import { DoctorPicker, type PickerDoctor } from "@/components/webapp/DoctorPicker"
```

### 4b. BookingStep type (13-qator)
```typescript
// HOZIR:
type BookingStep = "services" | "date" | "slots" | "patient" | "form" | "confirm" | "done"

// YANGI:
type BookingStep = "services" | "doctor" | "date" | "slots" | "patient" | "form" | "confirm" | "done"
```

### 4c. Yangi state (50-55 qator atrofida)
```typescript
const [selDoctor, setSelDoctor] = useState<PickerDoctor | null>(null)
```

### 4d. selectService logikasi (258-qator) — ASOSIY O'ZGARISH
```typescript
// HOZIR:
onSelect={(s) => { setSelSvc(s); setSelDate(""); setSelSlot(""); setStep("date"); }}

// YANGI:
onSelect={(s) => {
  setSelSvc(s)
  setSelDate("")
  setSelSlot("")
  setSelDoctor(null)
  if (s.doctors.length === 0) {
    setStep("date")                         // 0 shifokor → o'tkazib
  } else if (s.doctors.length === 1) {
    setSelDoctor(s.doctors[0] as PickerDoctor)
    setStep("date")                         // 1 shifokor → auto, date'ga
  } else {
    setStep("doctor")                       // N shifokor → tanlash
  }
}}
```

### 4e. handleBook payload (200-qator atrofida)
```typescript
// HOZIR:
const payload = {
  clinicId, branchId, serviceId: selSvc.id, date: selDate,
  patientName: finalName, patientPhone: finalPhone, source: "webapp",
  ...(resolvedUserId ? { userId: resolvedUserId } : {}),
  ...(patient.dependentId ? { dependentId: patient.dependentId } : {}),
}

// YANGI: selDoctor qo'shish
const payload = {
  clinicId, branchId, serviceId: selSvc.id, date: selDate,
  patientName: finalName, patientPhone: finalPhone, source: "webapp",
  ...(resolvedUserId ? { userId: resolvedUserId } : {}),
  ...(patient.dependentId ? { dependentId: patient.dependentId } : {}),
  ...(selDoctor ? { doctorId: selDoctor.id } : {}),   // ← YANGI
}
```

### 4f. Doctor step JSX (services step'dan keyin, date step'dan oldin)
```tsx
{/* ── Doctor ── */}
{step === "doctor" && selSvc && (
  <div>
    <button onClick={() => setStep("services")} className="text-blue-600 text-sm mb-4">
      ← Orqaga
    </button>
    {/* Tanlangan xizmat reminder */}
    <div className="bg-blue-50 rounded-xl p-3 mb-4 flex items-center gap-3">
      <span className="text-xl">{typeEmojis[selSvc.type]}</span>
      <div>
        <div className="text-sm font-semibold text-blue-900">{selSvc.name}</div>
        <div className="text-xs text-blue-600">{Number(selSvc.price).toLocaleString()} so'm</div>
      </div>
    </div>
    <DoctorPicker
      doctors={selSvc.doctors as PickerDoctor[]}
      onSelect={(doc) => { setSelDoctor(doc); setStep("date") }}
    />
  </div>
)}
```

### 4g. Auto-doctor banner (date step ichida)
```tsx
{/* date step boshiga qo'shish — selDoctor bor va 1 shifokor edi */}
{step === "date" && selDoctor && selSvc?.doctors.length === 1 && (
  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4 flex items-center gap-3">
    <div className="w-9 h-9 rounded-full bg-blue-200 text-blue-700 font-bold flex items-center
                    justify-center text-xs shrink-0">
      {selDoctor.firstName[0]}{selDoctor.lastName?.[0] ?? ""}
    </div>
    <div>
      <div className="text-xs text-blue-500">Shifokor</div>
      <div className="text-sm font-semibold text-blue-900">
        {selDoctor.firstName} {selDoctor.lastName}
      </div>
    </div>
    <span className="ml-auto text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
      ✅ Tanlangan
    </span>
  </div>
)}
```

### 4h. Progress bar hisoblash (237-241 qator) — doctor step'ga mos
```typescript
// HOZIR:
style={{ width: `${step === "confirm" ? 85 : step === "form" || step === "patient" ? 70 :
         step === "slots" ? 55 : 35}%` }}

// YANGI:
style={{ width: `${step === "confirm" ? 88 : step === "form" || step === "patient" ? 72 :
         step === "slots" ? 58 : step === "doctor" ? 42 : step === "date" ? 55 : 28}%` }}
```

### 4i. done step — klinika nomi (clinic name allaqachon URL'da, header'da)
```tsx
// done step'dagi kvitansiya kartasiga qo'shish:
// result.service → xizmat nomi bor
// Clinic name uchun: URLdagi clinicId → context yoki sessionStorage
// Oddiy: sessionStorage.getItem("selectedClinicId") bor → clinic name fetch kerak
// YA OXIRGI USUL: header <h1> ga klinika nomini qo'shish (bitta fetch)

// Yetarli yechim — header o'zgartirish (minimal risk):
// <h1 className="font-bold text-lg">🏥 {clinicName || "Qabulga yozilish"}</h1>
// clinicName: useEffect da GET /api/clinics/${clinicId} → json.data.name
```

---

## BOSQICH 5 — Flow 1 Doctor qadami (`page.tsx`)

**Fayl:** `src/app/webapp/page.tsx`

### 5a. Import
```typescript
import { DoctorPicker, type PickerDoctor } from "@/components/webapp/DoctorPicker"
```

### 5b. BookingStep type (20-qator)
```typescript
// HOZIR:
type BookingStep = "services" | "date" | "slots" | "form" | "confirm" | "done"

// YANGI:
type BookingStep = "services" | "doctor" | "date" | "slots" | "form" | "confirm" | "done"
```

### 5c. Yangi state (150-qator atrofida, boshqa state'lar yoniga)
```typescript
const [selectedDoctor, setSelectedDoctor] = useState<PickerDoctor | null>(null)
```

### 5d. selectService funksiyasi (434-438-qator)
```typescript
// HOZIR:
function selectService(s: Service) {
  setSelectedService(s)
  setSelectedDate("")
  setSelectedSlot("")
  setStep("date")
}

// YANGI:
function selectService(s: Service) {
  setSelectedService(s)
  setSelectedDate("")
  setSelectedSlot("")
  setSelectedDoctor(null)
  if (s.doctors.length === 0) {
    setStep("date")
  } else if (s.doctors.length === 1) {
    setSelectedDoctor(s.doctors[0] as PickerDoctor)
    setStep("date")
  } else {
    setStep("doctor")
  }
}
```

### 5e. handleBook payload (510-519-qator)
```typescript
// YANGI QATOR QO'SHISH:
if (selectedDoctor) payload.doctorId = selectedDoctor.id
```

### 5f. Doctor step JSX (services step JSX (791) dan keyin, date step (806) dan oldin)
```tsx
{/* ── Doctor ── */}
{step === "doctor" && selectedService && (
  <div>
    <button onClick={() => setStep("services")} className="text-blue-600 text-sm mb-4 flex items-center gap-1">
      ← Orqaga
    </button>
    <div className="bg-blue-50 rounded-xl p-3 mb-4 flex items-center gap-3">
      <span className="text-xl">{typeEmojis[selectedService.type]}</span>
      <div>
        <div className="text-sm font-semibold text-blue-900">{selectedService.name}</div>
        <div className="text-xs text-blue-600">{selectedService.price.toLocaleString()} so'm</div>
      </div>
    </div>
    <DoctorPicker
      doctors={selectedService.doctors as PickerDoctor[]}
      onSelect={(doc) => { setSelectedDoctor(doc); setStep("date") }}
    />
  </div>
)}
```

### 5g. Done step — klinika nomi (990-1047 qator, SummaryRow'lar yoniga)
```tsx
// bookingTibId SummaryRow dan keyin, "Xizmat" SummaryRow'dan oldin:
{activeClinic?.name && (
  <SummaryRow label="Klinika" value={activeClinic.name} />
)}
```

### 5h. "Yangi bron" tugmasi — onboarding gate + pulse animatsiya (693-706 qator)

**isProfileComplete helper (useEffect dan oldin, komponent ichiga):**
```typescript
const isProfileComplete = !!(
  tgUser?.phone &&
  tgUser?.firstName &&
  tgUser.firstName !== "Foydalanuvchi"
)
```

**Tugma o'zgarishi:**
```tsx
{/* HOZIR: oddiy tugma */}
<button
  onClick={() => {
    const cId = clinicIdRef.current
    if (cId) window.location.href = `/webapp/clinics/${cId}`
    else window.location.href = `/webapp?mode=booking`
  }}
  className="flex-1 py-3.5 rounded-2xl bg-blue-600 text-white font-semibold text-sm
             shadow-lg shadow-blue-200 active:scale-95 transition-all"
>
  ➕ Yangi bron
</button>

{/* YANGI: gate + pulse */}
<div className="flex-1 relative">
  {/* Pulse halqa — faqat profil to'liq bo'lmaganda */}
  {!isProfileComplete && (
    <span className="absolute -top-1 -right-1 flex h-3 w-3">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
    </span>
  )}
  <button
    onClick={() => {
      if (!isProfileComplete) {
        setShowOnboardingHint(true)
        return
      }
      const cId = clinicIdRef.current
      if (cId) window.location.href = `/webapp/clinics/${cId}`
      else window.location.href = `/webapp?mode=booking`
    }}
    className="w-full py-3.5 rounded-2xl bg-blue-600 text-white font-semibold text-sm
               shadow-lg shadow-blue-200 active:scale-95 transition-all"
  >
    ➕ Yangi bron
  </button>
</div>
```

### 5i. Onboarding hint state va JSX

**State:**
```typescript
const [showOnboardingHint, setShowOnboardingHint] = useState(false)
```

**JSX (bottom bar'dan OLDIN, yoki ProfileFlipCard'dan keyin):**
```tsx
{/* Onboarding Hint Modal */}
{showOnboardingHint && (
  <div
    className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center px-4
               pb-[calc(100px+env(safe-area-inset-bottom))]"
    onClick={() => setShowOnboardingHint(false)}
  >
    <div
      className="bg-white w-full max-w-sm rounded-2xl p-5 shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="text-center mb-4">
        <div className="text-3xl mb-2">📋</div>
        <h3 className="font-bold text-gray-900">Bron qilishdan oldin</h3>
        <p className="text-sm text-gray-500 mt-1">Quyidagi qadamlarni bajaring</p>
      </div>
      <div className="space-y-3 mb-5">
        {!tgUser?.phone && (
          <div
            className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl cursor-pointer
                       active:scale-[0.98] transition-all"
            onClick={() => {
              setShowOnboardingHint(false)
              // ProfileFlipCard'ni front tomonga scroll qilish — ref kerak
              // Yoki: window.scrollTo({ top: 0 }) va setFlipped hint
              window.scrollTo({ top: 0, behavior: "smooth" })
            }}
          >
            <span className="text-xl">📞</span>
            <div>
              <div className="text-sm font-semibold text-gray-900">Telefon ulash</div>
              <div className="text-xs text-gray-500">Profilingizda "Telefon ulash" tugmasini bosing</div>
            </div>
            <span className="ml-auto text-blue-500">→</span>
          </div>
        )}
        {(!tgUser?.firstName || tgUser.firstName === "Foydalanuvchi") && (
          <div
            className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl cursor-pointer
                       active:scale-[0.98] transition-all"
            onClick={() => {
              setShowOnboardingHint(false)
              window.scrollTo({ top: 0, behavior: "smooth" })
              // ProfileFlipCard flip hint — onFlipRequest prop qo'shish mumkin
            }}
          >
            <span className="text-xl">✏️</span>
            <div>
              <div className="text-sm font-semibold text-gray-900">Ismingizni kiriting</div>
              <div className="text-xs text-gray-500">✏️ tugmasini bosib ismingizni to'ldiring</div>
            </div>
            <span className="ml-auto text-blue-500">→</span>
          </div>
        )}
      </div>
      <button
        onClick={() => setShowOnboardingHint(false)}
        className="w-full py-3 rounded-xl text-gray-500 text-sm border border-gray-200"
      >
        Keyinroq
      </button>
    </div>
  </div>
)}
```

---

## BOSQICH 6 — Kvitansiya klinika nomi (Flow 2 — `branches/[branchId]/page.tsx`)

**Fayl:** `src/app/webapp/clinics/[id]/branches/[branchId]/page.tsx`

### 6a. State qo'shish
```typescript
const [clinicName, setClinicName] = useState<string>("")
```

### 6b. useEffect ichida clinic name fetch (services yuklash bilan birga)
```typescript
// Mavjud useEffect ichida (84-116):
// services fetch bilan birga:
fetch(`/api/clinics/${clinicId}`)
  .then(r => r.json())
  .then(j => { if (j.success) setClinicName(j.data.name ?? "") })
  .catch(() => {})
```

### 6c. Done step kvitansiyasiga qo'shish
```tsx
{/* done step ichida, tibId dan keyin: */}
{clinicName && (
  <div className="flex justify-between items-center pb-3 border-b border-gray-100">
    <span className="text-sm text-gray-500">Klinika</span>
    <span className="text-sm font-semibold text-gray-900">🏥 {clinicName}</span>
  </div>
)}
```

---

## TEKSHIRISH RO'YXATI (har bosqich tugagach)

### Bosqich 1 (DoctorPicker):
- [ ] 0 shifokor → komponent render bo'lmaydi (parent o'tkazib yuboradi)
- [ ] 1 shifokor → banner + "Davom etish" → date'ga o'tadi, selDoctor set
- [ ] N shifokor → kartalar ko'rinadi → bitta tanlansa → date'ga o'tadi
- [ ] Avatar: foto bor bo'lsa img, yo'q bo'lsa initials

### Bosqich 2 (ProfileFlipCard phone):
- [ ] phone=null → "Telefon ulash" tugmasi ko'rinadi
- [ ] Telegram'da bosilsa → requestContact dialog chiqadi
- [ ] Tasdiqlansa → normalize → PATCH → front yangilanadi
- [ ] Bekor qilsa → manual input ko'rinadi
- [ ] Browser'da (tg null) → darhol manual input
- [ ] contact.first_name → forma pre-fill (ProfileFlipCard orqa tomonda)
- [ ] Duplicate phone → "Bu raqam boshqa hisobda" xabar
- [ ] phone bor bo'lsa → tugma ko'rinmaydi

### Bosqich 3 (API phone):
- [ ] PATCH { phone: "998901234567" } → normalize → "+998901234567" saqlanadi
- [ ] PATCH { phone: "noto'g'ri" } → 400 xabar
- [ ] PATCH { phone: <boshqada_bor> } → 409 "Bu raqam boshqa hisobda"
- [ ] PATCH phone yo'q → faqat FIO saqlanadi (eski behaviour)

### Bosqich 4 (Flow 2 doctor):
- [ ] xizmat tanlash → 0 shifokor → doctor step o'tkazib → sana
- [ ] xizmat tanlash → 1 shifokor → auto banner sana step'da
- [ ] xizmat tanlash → 3 shifokor → DoctorPicker → tanla → sana
- [ ] handleBook → doctorId yuborilgan → DB'da saqlanadi
- [ ] Orqaga → doctor → services
- [ ] done step'da klinika nomi

### Bosqich 5 (Flow 1 doctor + gate):
- [ ] page.tsx bookingStep type: "doctor" qo'shildi
- [ ] selectService → doctor logikasi Flow 2 ga o'xshash ishlaydi
- [ ] handleBook payload'da doctorId
- [ ] done step: activeClinic.name ko'rinadi
- [ ] phone yo'q → "Yangi bron" pulse halqa
- [ ] "Yangi bron" → gate → modal → "Telefon ulash" → ProfileFlipCard scroll
- [ ] isProfileComplete → gate o'tadi

### Barcha bosqichlar:
- [ ] `npx tsc --noEmit` xato yo'q
- [ ] Eski user (phone bor, region yo'q) → to'g'ridan dashboard
- [ ] Eski user (phone bor, region yo'q) → "Yangi bron" gate o'tadi
- [ ] Browser'da (Telegram yo'q) → bron qila oladi (fallback ishlaydi)

---

## MUHIM ESLATMALAR

1. **DB migration kerak emas** — barcha field bor.
2. **`/api/book` o'zgarmaydi** — allaqachon doctorId qabul qiladi.
3. **`booking.service.ts` o'zgarmaydi** — doctorId null-safe.
4. **`normalizePhone`** `"998901234567"` formatni to'g'ri qayta ishlaydi.
5. **`activeClinic.name`** context'da bor — Flow 1 uchun migration/fetch kerak emas.
6. **S1 qaror:** region gate uchun TEKSHIRILMAYDI — eski userlar buzilmaydi.
7. **Pulse animatsiya** — `animate-ping` Tailwind built-in, config o'zgarmaydi.
8. **`eslint: ignoreDuringBuilds: true`** — build o'tadi, lekin `npx tsc --noEmit` majburiy.

---
> Yaratildi: 2026-05-30 | Asosi: DIAGNOSTIKA_HISOBOT.md + 5 savol
> Ishga tayyor. Bosqich tartibida amalga oshirish tavsiya qilinadi.
