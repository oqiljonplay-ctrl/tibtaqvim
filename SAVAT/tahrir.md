# 🎯 VAZIFA: Webapp ism input bug'ini ASLIY hal qilish + Admin doctor CRUD tugmalari

## LOYIHA KONTEKSTI

Stack: Next.js 14 (App Router) + Prisma + Supabase + Vercel + Telegram WebApp SDK
Repo: oqiljonplay-ctrl/tibtaqvim
Production: https://tibtaqvim.vercel.app

Hozirgi holat (oxirgi 2 ta deploy):
- Service-Doctor M2M ishlamoqda ✅
- DoctorCard webapp'da md size (96px) — vizual yaxshi ✅
- Admin paneldagi doctor kartochkalari mavjud, lekin tahrirlash va o'chirish tugmalari YO'Q ⚠️
- Webapp'da ism input — avvalgi tuzatish to'liq ishlamadi:
  - Eski bug: 1 harfdan keyin bloklanardi
  - Tuzatishdan keyin: 2 harfdan keyin bloklanmoqda
  - Demak qisman ishladi, lekin asoliy ildizi topilmagan

## 🔴 MUAMMO #1 — Webapp ism input ASLIY tashxis

### Aniq xulq-atvor
1. Foydalanuvchi webapp ochadi
2. "Yangi bron qilish" bosadi
3. Xizmat tanlaydi
4. Sana tanlaydi
5. Telefon kiritadi → "Davom etish"
6. Ism kiritish sahifasi ochiladi
7. Input field'da default qiymat: Telegram first_name (masalan "Oqiljon")
8. User Backspace bilan o'chiradi yoki ustiga yozadi
9. 2-3 harf yozgach klaviatura input qabul qilmay qo'yadi
10. Tasdiqlash sahifasiga o'tilganda faqat 2-3 harf saqlanadi

### EHTIMOLIY SABABLAR — har birini tekshir

#### Sabab A — useEffect dependency'da user borligidan har gal qaytaradi
// ❌ XATO:
useEffect(() => {
  setPatientName(user?.firstName || '');
}, [user]); // ← user obyekt har render'da yangi reference bo'lishi mumkin
Diagnostika: Webapp'da useEffect qaerda setPatientName chaqiriladi — bog'liqliklarini ko'r.

#### Sabab B — Telegram WebApp BackButton yoki MainButton rerender qildirayapti
// ❌ XATO:
useEffect(() => {
  WebApp.MainButton.onClick(() => {...});
}, [patientName]); // ← har keypress'da rebind, ehtimol focus loss
Diagnostika: WebApp.MainButton, WebApp.BackButton, WebApp.HapticFeedback qaerda chaqiriladi — dependency array tekshir.

#### Sabab C — Form onSubmit enter'siz ham triggerlanadi
Mobile klaviaturada Done/Enter bossa form submit bo'lib, validation fail bo'lib, qayta initial state'ga qaytarish bo'lishi mumkin.

#### Sabab D — Zustand/Context global store har keypress'da local state'ni override qiladi
// ❌ XATO:
const { name } = useStore();
const [localName, setLocalName] = useState(name);
useEffect(() => {
  setLocalName(name); // ← har gal store o'zgarsa, local'ga ko'chiriladi
}, [name]);
#### Sabab E — value controlled lekin parent component har render'da yangi value beradi
// ❌ XATO:
<NameInput value={user?.firstName} onChange={...} /> // ← har render
#### Sabab F — maxLength atributi noto'g'ri o'rnatilgan
// ❌ XATO:
<input maxLength={2} ... /> // ← shu sababli 2 harf bloklayapti!
Bu eng katta ehtimol — chunki ilgari "1 harf" edi (maxLength=1?), endi 2 harf bo'ldi (maxLength=2?). Avvalgi tuzatishda minLength={2} qo'shilgan bo'lsa, ehtimol maxLength={2} deb noto'g'ri yozilgan.

### QAT'IY TARTIB — Diagnostika va Tuzatish

1-qadam: src/app/webapp/ papkasini to'liq o'rgan. Ism input bo'lgan faylni top.

Ehtimoliy yo'llar:
- src/app/webapp/book/page.tsx
- src/app/webapp/book/confirm/page.tsx
- src/app/webapp/book/[step]/page.tsx
- src/app/webapp/components/NameInput.tsx

2-qadam: Topilgan faylni o'qib diqqat bilan tekshir:

# Quyidagi pattern'larni qidir:
grep -n "patientName\|setPatientName\|firstName\|maxLength\|useEffect.*name" src/app/webapp/**/*.tsx
3-qadam: ALOHIDA tekshirilishi kerak:
- ✅ maxLength={...} qiymati — agar 2, 3, yoki kam bo'lsa, 40 ga oshir
- ✅ useEffect dependency array — [user] yoki [name] bo'lsa, BO'SH [] ga o'zgartir
- ✅ value={...} — controlled state'dan kelishi shart
- ✅ Telegram WebApp MainButton setup — useEffect dependency BO'SH bo'lishi
- ✅ Form onSubmit — event.preventDefault() mavjudligini tasdiqla

4-qadam: TUZATISHNI eng kafolatli pattern bilan amalga oshir:

`tsx
"use client";
import { useState, useEffect, useRef } from "react";
export default function NameInputStep({ telegramUser, onNext }) {
  const [patientName, setPatientName] = useState("");
  const initRef = useRef(false);

  // Faqat BIRINCHI render'da Telegram'dan default qo'y
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    if (telegramUser?.firstName) {
      setPatientName(telegramUser.firstName);
    }
  }, [telegramUser?.firstName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = patientName.trim();
    if (trimmed.length < 2) {
      alert("Ism kamida 2 harfdan iborat bo'lishi kerak");
      return;
    }
    if (trimmed.length > 40) {
      alert("Ism 40 harfdan oshmasligi kerak");
      return;
    }
    onNext(trimmed);
  };

  return (
    <form onSubmit={handleSubmit}>
      <label>Ism familiya *</label>
      <input
        type="text"
        value={patientName}
        onChange={(e) => setPatientName(e.target.value)}
        placeholder="Ism Familiya"
        autoComplete="name"
        minLength={2}
        maxLength={40}
        required
      />
      <button type="submit">Davom etish</button>
    </form>
  );
}

⚠️ **KRITIK**: Telegram WebApp `MainButton` ishlatilgan bo'lsa, uni quyidagicha sozla:

tsx
useEffect(() => {
  // Faqat BIR MARTA sozla
  const WebApp = (window as any).Telegram?.WebApp;
  if (!WebApp) return;

  WebApp.MainButton.setText("Davom etish");
  WebApp.MainButton.show();
  
  // onClick'ni har gal yangilash uchun useRef ishlat:
  const handler = () => handleSubmit({ preventDefault: () => {} } as any);
  WebApp.MainButton.onClick(handler);
  
  return () => {
    WebApp.MainButton.offClick(handler);
    WebApp.MainButton.hide();
  };
}, []); // ← dependency BO'SH!

Yoki yaxshiroq — `useCallback` bilan handler'ni stable qiling:

tsx
const handleNext = useCallback(() => {
  // patientName ni ref orqali olish:
  const name = nameRef.current.trim();
  if (name.length < 2 || name.length > 40) return;
  onNext(name);
}, []);

const nameRef = useRef("");
useEffect(() => {
  nameRef.current = patientName;
}, [patientName]);

**5-qadam:** Telefon input'da ham xuddi shu bug bo'lishi mumkin. Telefon input'ni ham xuddi shu pattern bilan tuzat (eski skrinshotda ham bug ko'rinardi).

---

## 🟡 MUAMMO #2 — Admin doctor kartochkasiga Tahrirlash va O'chirish tugmalari

### Hozirgi holat
- `/admin/doctors` sahifasida 5 ta shifokor kartochka ko'rinmoqda
- Har kartochka: photo + specialty + ism + telefon + filial + xizmatlar tag'lari
- ❌ **Tahrirlash** tugmasi YO'Q
- ❌ **O'chirish** tugmasi YO'Q

### Vazifa: Har kartochkaga 2 ta tugma qo'sh

**Joylashuv:** Har shifokor kartochkasining yuqori-o'ng burchagi yoki pastki qismi (oson bosish uchun).

**Tugmalar:**
1. **✏️ Tahrirlash** — `/admin/doctors/[id]/edit` sahifasiga olib boradi (yoki modal ochadi)
2. **🗑️ O'chirish** — Tasdiqlash modali + DELETE API chaqiruvi

### Implementation

#### 2.1 — Frontend: kartochka komponenti tahrir

**Fayl:** `src/app/admin/doctors/page.tsx` (yoki shunga o'xshash)

Har shifokor kartochkasiga qo'shing:

tsx
import { useState } from "react";
import { useRouter } from "next/navigation";

function DoctorCard({ doctor, onDeleted }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleEdit = () => {
    router.push(/admin/doctors/${doctor.id}/edit);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(/api/admin/doctors/${doctor.id}, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.error?.message || "O'chirishda xatolik");
        return;
      }
      onDeleted(doctor.id);
    } catch (e) {
      alert("Server bilan bog'lanishda xatolik");
    } finally {
      setDeleting(false);
      setShowConfirm(false);
    }
  };
  return (
    <div className="bg-white rounded-lg shadow p-4 relative">
      {/* Tahrirlash/O'chirish tugmalari — yuqori-o'ng burchakda */}
      <div className="absolute top-2 right-2 flex gap-1">
        <button
          onClick={handleEdit}
          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition"
          title="Tahrirlash"
        >
          ✏️
        </button>
        <button
          onClick={() => setShowConfirm(true)}
          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition"
          title="O'chirish"
        >
          🗑️
        </button>
      </div>

      {/* Mavjud kartochka mazmuni */}
      <div className="flex items-start gap-3">
        {/* photo, specialty, name, phone, filial, services... mavjud kod */}
      </div>

      {/* Tasdiqlash modali */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md mx-4">
            <h3 className="font-semibold text-lg mb-2">Shifokorni o'chirish</h3>
            <p className="text-gray-600 mb-4">
              <strong>{doctor.lastName} {doctor.firstName}</strong> ni o'chirmoqchimisiz?
              Bu amalni ortga qaytarib bo'lmaydi.
            </p>
            <p className="text-sm text-red-600 mb-4">
              ⚠️ Bog'langan xizmatlar bog'lanishlari ham o'chiriladi (M2M cascade).
              Lekin mavjud appointments tegmaydi (doctorId null bo'lib qoladi).
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Bekor qilish
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "O'chirilmoqda..." : "Ha, o'chirish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

⚠️ **Diqqat:** Mavjud kartochka kodini SAQLA. Faqat absolute pozitsiyali tugmalar va modal qo'sh.

#### 2.2 — Backend: DELETE endpoint

**Fayl:** `src/app/api/admin/doctors/[id]/route.ts`

Mavjud `GET` va `PATCH` saqlanadi. Yangi `DELETE` qo'sh:

typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, error } from "@/lib/api-response";

// Mavjud GET / PATCH ...

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireAuth(req);
  if (!auth) return error("Unauthorized", 401);
  if (auth.role !== "super_admin" && auth.role !== "clinic_admin") {
    return error("Forbidden", 403);
  }

  try {
    const doctorId = params.id;
    
    // Doctor mavjudligini tekshir
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      include: { _count: { select: { appointments: true } } },
    });
    
    if (!doctor) return error("Doctor not found", 404);
    
    // Optsiya: agar shifokorga biriktirilgan APPOINTMENT'lar bo'lsa, 
    // o'chirish yoki soft-delete tanlovi:
    if (doctor._count.appointments > 0) {
      // Variant A: soft-delete (isActive=false)
      // Variant B: hard-delete (appointments.doctorId = null bo'ladi)
      // M2M service_doctors avtomatik CASCADE bilan o'chiriladi (schema'da onDelete: Cascade)
    }
    
    // Hard-delete (cascade ServiceDoctor):
    await prisma.doctor.delete({
      where: { id: doctorId },
    });
    
    return ok({ deletedId: doctorId });
  } catch (e: any) {
    console.error("[doctors DELETE] error:", e);
    return error("Server error", 500);
  }
}
`
⚠️ Eslatma: Prisma schema'da Doctor modelida appointments relation bor. onDelete default Restrict bo'lishi mumkin — bu degani doctor'ni o'chira olmasligimiz mumkin agar appointment'lar bo'lsa. Agar shunday bo'lsa, soft-delete (isActive=false) ishlatishni tavsiya qil:

// Hard-delete o'rniga soft-delete:
await prisma.doctor.update({
  where: { id: doctorId },
  data: { isActive: false },
});
Agar `isActive field mavjud bo'lmasa (Prisma schema'ni tekshir), hard-delete ishlatish kerak.

#### 2.3 — Tahrirlash sahifasi (agar mavjud bo'lmasa)

**Fayl:** src/app/admin/doctors/[id]/edit/page.tsx

Agar bu sahifa hali yo'q bo'lsa, **yangi shifokor qo'shish** sahifasini nusxalab tahrirga aylantir:
- Default qiymatlar mavjud doctor'dan keladi (GET API)
- Submit'da PATCH ishlatiladi
- Saqlangach /admin/doctors ga redirect

Agar mavjud sahifa allaqachon bor bo'lsa — ish kerak emas.

---

## ⚠️ MUHIM QOIDALAR

1. **Aniqlik birinchi:** Avval fayllarni o'qib chiq, ehtimoliy sabablarni rad et, keyin tuzat
2. **Hech narsa o'chirma:** Faqat aniq xato pattern'ni almashtir, mavjud styling/logika saqlanadi
3. **TypeScript strict:** Tip aniq berilishi shart
4. **Mavjud konvensiyalar:** requireAuth, ok(), error() mavjud helper'lari ishlatiladi
5. **Test:** Lokal'da npm run build xato bermasligi shart

---

## 📋 BAJARISH TARTIBI

### Qadam 1 — Diagnostika (BUG #1)
``bash
# Webapp papkadagi inputlarni qidirib chiq
find src/app/webapp -name "*.tsx" -exec grep -l "patientName\|firstName\|maxLength" {} \;
Topilgan fayllarni o'qib chiq, EHTIMOLIY SABAB A-F dan qaysi biri ekanini aniqla, foydalanuvchiga xabar ber.

### Qadam 2 — BUG #1 ni tuzat
Aniqlangan sababga ko'ra tuzatish qo'lla. **`maxLength={40}`** o'rnat. `useEffect` dependency'larini tekshir.

### Qadam 3 — Admin DELETE endpoint
`src/app/api/admin/doctors/[id]/route.ts` ga DELETE qo'sh.

### Qadam 4 — Frontend tugmalar
`src/app/admin/doctors/page.tsx` (yoki tegishli fayl) — tahrirlash/o'chirish tugmalari + tasdiqlash modali.

### Qadam 5 — Edit sahifasini tekshir
`src/app/admin/doctors/[id]/edit/page.tsx` mavjudmi? Yo'q bo'lsa yarat. Bor bo'lsa — ko'rib chiqib router.push ishlashini tasdiqla.

### Qadam 6 — Test va commit
bash
npm run build  # TypeScript xatosi yo'qmi
git add .
git commit -m "fix(webapp): name input maxLength 40 + dep array | feat(admin): doctor edit/delete buttons"
git push
`

### Qadam 7 — Foydalanuvchiga xabar
"Tuzatildi. Deploy bo'lgach test qiling:
1. Webapp'da ism kiritish — 40 belgi gacha yozilishi kerak
2. Admin /admin/doctors — har shifokor uchun ✏️🗑️ tugmalari ko'rinadi
3. Tahrirlash → edit sahifaga olib boradi
4. O'chirish → tasdiqlash modali → DB'dan o'chadi"

---

## 🚀 BOSHLA

1. `src/app/webapp/` papkadagi ism inputni topib bug ASLIY SABABINI aniqla (eng katta ehtimol — `maxLength` yoki `useEffect` dependency)
2. Tuzat
3. Admin paneliga edit/delete tugmalari qo'sh
4. DELETE API endpoint yarat