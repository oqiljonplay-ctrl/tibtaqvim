# 🎯 VAZIFA: Admin Doctor formasidagi 4 ta jiddiy bug'ni tuzatish

## LOYIHA KONTEKSTI
Repo: oqiljonplay-ctrl/tibtaqvim  
Stack: Next.js 14 (App Router) + Prisma + Supabase + Vercel  
Production: https://tibtaqvim.vercel.app

Hozirgi holat: QueueMode tizimi (Bosqich 1) tugagan, admin paneli shifokor sahifasida har xizmat uchun rejim tugmalari bor. Lekin shifokor yaratish formasida jiddiy bug'lar topildi.

## ⚠️ TASHXIS — TOPILGAN MUAMMOLAR

### MUAMMO 1 — Race condition (saqlash tugmasi)
Holat: Admin yangi shifokor formasini to'ldirib, "Saqlash" tugmasini tezda 3 marta bosgan. Sistema 3 ta dublikat yozuv yaratdi:
cmp79s1kn0003kz042h0uko3w | Farrux Shukurov | Pulmonolog
cmp79s18w0001kz04nudlpb29 | Farrux Shukurov | Pulmonolog
cmp79s17i0001l504b2w5qu73 | Farrux Shukurov | Pulmonolog
Hammasi bir xil. Bu kritik bug — concurrent submit himoyasi yo'q.

### MUAMMO 2 — branchId to'ldirilmaydi
Holat: Yangi shifokorlarda branchId = NULL:
- Sayfiyev (Stomatolog) — branchId null
- Qilichev (Dietolog) — branchId null
- Amonov (Ortoped) — branchId null
- 3 ta Pulmonolog — branchId null

Eski seed shifokorlar (doc-1, doc-2, doc-3) da branchId = 'branch-main' bor. Demak form yangi shifokor yaratishda branch ni o'rnatmaydi.

### MUAMMO 3 — Asosiy filial yozuvi UI da ko'rinmaydi
Holat: Shifokorlar sahifasida (/admin/doctors):
- Toshmatov, Yusupova kartochkalarida "Asosiy filial" yozuvi ko'rinadi
- Rahimov (Nevropatolog) kartochkasida YO'Q, lekin DB'da branchId = 'branch-main' bor!
- Sayfiyev (Stomatolog) kartochkasida ham YO'Q (DB'da null, normal)

Demak frontend doctor'ning branch ma'lumotini ba'zi joylarda chiqarmaydi. Ehtimol GET API include: { branch: true } yo'q yoki Prisma query da branch ni chaqirmaydi.

### MUAMMO 4 — Shifokor yaratganda service biriktirish ixtiyoriy
Holat: Admin yangi shifokor yaratadi, lekin biror xizmatga biriktirmasdan saqlasa, shifokor:
- DB'da paydo bo'ladi
- Admin paneli kartochkasida "Navbat rejimlari" bo'limi YO'Q ko'rinadi (chunki service_doctors bo'sh)
- Bot va Web ro'yxatida ko'rinmaydi (chunki xizmatga biriktirilmagan)

Bu mantiqiy bug emas, lekin UX bug — admin chalkashadi.

## STRATEGIK QARORLAR (user tasdiqlagan)

1. Submit tugmasi loading/disabled holatga o'tishi — race condition oldini olish
2. branchId majburiy yoki avtomatik — yangi doctor uchun branch tanlash kerak; bitta branch bor bo'lsa avtomatik to'ldirish
3. Asosiy filial UI'da har doim ko'rinishi — API doctor.branch ni qaytarishi, kartochka ko'rsatishi
4. Service biriktirish kerakligini ogohlantirish — agar shifokor xizmatga biriktirilmasa, admin'ga uyqotuvchi xabar ko'rsatish, lekin saqlashga ruxsat berish

## ⚠️ MUHIM — DUBLIKAT TOZALASH

3 ta dublikat Pulmonolog avval o'chirilishi kerak. Foydalanuvchi bu vazifani qo'shimcha tanladi.

DB'da quyidagi 3 ta yozuv mavjud:
- cmp79s1kn0003kz042h0uko3w
- cmp79s18w0001kz04nudlpb29
- cmp79s17i0001l504b2w5qu73

Hammasi bir xil ma'lumotda (Farrux Shukurov, Pulmonolog, services_count=0). Bittasini saqlash kerak, 2 tasini o'chirish.

Tavsiya: Eng birinchi yaratilganini (cmp79s17i... — ID alifbo tartibida birinchi keladi) saqlash, qolgan 2 tasini o'chirish. Yoki uchchalasini ham o'chirish (chunki services biriktirilmagan, foydasiz).

Bu tozalashni Claude Code SUPABASE MCP orqali yoki SQL editor orqali emas, balki **prisma/cleanup-dups.ts** scripti yozib hal qilsin (idempotent).

---

# 📋 ISH BOSQICHLARI

## BOSQICH 1 — DUBLIKAT TOZALASH

### Fayl: prisma/cleanup-dups.ts (yangi, bir martalik)

`typescript
/**
 * One-time cleanup script for duplicate doctors.
 * 
 * Sabab: Form submit himoyasiz bo'lgan paytda yaratilgan dublikatlar.
 * 
 * Usage: npx tsx prisma/cleanup-dups.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DUPLICATE_DOCTOR_IDS = [
  'cmp79s1kn0003kz042h0uko3w',
  'cmp79s18w0001kz04nudlpb29',
  'cmp79s17i0001l504b2w5qu73',
];
async function main() {
  console.log('🧹 Cleaning up duplicate doctors...\n');

  // Avval har birini tekshir — services biriktirilganmi va appointment'i bormi
  for (const id of DUPLICATE_DOCTOR_IDS) {
    const doctor = await prisma.doctor.findUnique({
      where: { id },
      include: {
        _count: { 
          select: { 
            services: true,
            appointments: true,
          }
        }
      }
    });

    if (!doctor) {
      console.log(   ⚠️ ${id} — topilmadi, skip);
      continue;
    }

    console.log(   📋 ${doctor.firstName} ${doctor.lastName} (${doctor.specialty}));
    console.log(      services: ${doctor._count.services}, appointments: ${doctor._count.appointments});

    if (doctor._count.appointments > 0) {
      console.log(      ⚠️ Appointments mavjud — skip (xavfsizlik uchun));
      continue;
    }

    // Service-doctor biriktirishlarni avval o'chirish (CASCADE bo'lsa avtomatik)
    await prisma.serviceDoctor.deleteMany({
      where: { doctorId: id }
    });

    // Doctor o'chirish
    await prisma.doctor.delete({
      where: { id }
    });

    console.log(      ✓ O'chirildi);
  }

  // Yakuniy hisobot
  const remaining = await prisma.doctor.findMany({
    where: { firstName: 'Farrux', lastName: 'Shukurov' }
  });
  console.log(\n📊 Qoldi: ${remaining.length} ta Farrux Shukurov);

  if (remaining.length === 0) {
    console.log(⚠️ Hech qaysi Pulmonolog qolmadi. Admin paneldan qayta yaratish kerak.);
  } else if (remaining.length === 1) {
    console.log(✅ Bittasi qoldi — to'g'ri holat);
  }

  console.log('\n✅ Cleanup completed!');
}

main()
  .catch(e => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

### package.json ga:
json
{
  "scripts": {
    "cleanup:dups": "tsx prisma/cleanup-dups.ts"
  }
}

### Ishga tushirish:
bash
npm run cleanup:dups

**Verifikatsiyadan keyin foydalanuvchidan tasdiq so'ra:** "3 ta dublikat o'chirildi. Bosqich 2 (form bug tuzatish) ga o'tamizmi?"

---

## BOSQICH 2 — RACE CONDITION + LOADING STATE

### Fayl topish
`src/app/admin/doctors/` papkasida shifokor yaratish/tahrirlash formasi qaerda bo'lsa, topish kerak. Ehtimoliy:
- `src/app/admin/doctors/new/page.tsx`
- `src/app/admin/doctors/[id]/edit/page.tsx`
- `src/app/admin/doctors/page.tsx` (modal sifatida)

### Tuzatish

**Mavjud submit handler taxminan shunday:**
tsx
const handleSubmit = async (e) => {
  e.preventDefault();
  const res = await fetch('/api/admin/doctors', { 
    method: 'POST', 
    body: JSON.stringify(formData),
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  });
  // ...
}

**Yangi versiya — race condition himoyasi bilan:**
tsx
const [submitting, setSubmitting] = useState(false);

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  // ⚠️ Race condition oldini olish
  if (submitting) return;
  setSubmitting(true);

  try {
    const res = await fetch('/api/admin/doctors', { 
      method: 'POST', 
      body: JSON.stringify(formData),
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const json = await res.json();
    if (!json.success) {
      alert(json.error?.message || "Saqlashda xato");
      return;
    }
    
    // Muvaffaqiyatli — redirect yoki state yangilash
    router.push('/admin/doctors');
  } catch (err) {
    alert("Server bilan bog'lanishda xato");
  } finally {
    setSubmitting(false);
  }
};

// Submit tugmasi:
<button
  type="submit"
  disabled={submitting}
  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
>
  {submitting ? (
    <span className="flex items-center gap-2">
      <span className="inline-block animate-spin">⏳</span>
      Saqlanmoqda...
    </span>
  ) : (
    "Saqlash"
  )}
</button>
`
### MUHIM — buni Edit formasida ham qo'llang
Tahrirlash sahifasi (/admin/doctors/[id]/edit) da ham xuddi shu race condition bo'lishi mumkin. Submit handler'ni xuddi shunday tuzating.

---

## BOSQICH 3 — branchId AVTOMATIK TO'LDIRISH

### Backend: POST /api/admin/doctors

Fayl: src/app/api/admin/doctors/route.ts

POST handler'ida branchId mantiq qo'shish:

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth) return error("Unauthorized", 401);
  if (auth.role !== 'super_admin' && auth.role !== 'clinic_admin') {
    return error("Forbidden", 403);
  }

  const body = await req.json();
  const clinicId = auth.clinicId || body.clinicId;

  // ⚠️ branchId avtomatik to'ldirish
  let branchId = body.branchId;
  if (!branchId) {
    // Birinchi filialni topib avtomatik berish
    const firstBranch = await prisma.branch.findFirst({
      where: { clinicId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    branchId = firstBranch?.id;
  }

  if (!branchId) {
    return error("Filial topilmadi. Avval filial yarating.", 400);
  }

  const doctor = await prisma.doctor.create({
    data: {
      clinicId,
      branchId,  // ⚠️ majburiy
      firstName: body.firstName,
      lastName: body.lastName,
      specialty: body.specialty,
      phone: body.phone,
      photoUrl: body.photoUrl,
      isActive: body.isActive ?? true,
      // ... boshqa mavjud maydonlar
    },
    include: {
      branch: { select: { id: true, name: true } }, // ⚠️ MUHIM: branch include
    },
  });

  // Service biriktirishlar (agar berilgan bo'lsa)
  if (body.serviceIds && Array.isArray(body.serviceIds)) {
    for (const serviceId of body.serviceIds) {
      await prisma.serviceDoctor.create({
        data: { serviceId, doctorId: doctor.id }
      });
    }
  }

  return ok(doctor);
}
### Frontend: forma'ga branch tanlash (ixtiyoriy)

Agar klinikada bir nechta filial bo'lishi mumkin bo'lsa, formaga filial dropdown qo'shish. Hozir 1 ta filial bor — backend avtomatik to'ldiradi, formaga qo'shish shart emas.

Lekin — formada uy tomondan ham branchId yuborilishi mumkin (kelajakda):

const [branches, setBranches] = useState([]);
const [branchId, setBranchId] = useState('');

useEffect(() => {
  fetch('/api/admin/branches', { credentials: 'include' })
    .then(r => r.json())
    .then(json => {
      if (json.success) {
        setBranches(json.data);
        // Default — birinchi filial
        if (json.data.length > 0 && !branchId) {
          setBranchId(json.data[0].id);
        }
      }
    });
}, []);

// Forma ichida (ixtiyoriy, agar bir nechta filial bo'lsa):
{branches.length > 1 && (
  <div>
    <label>Filial *</label>
    <select 
      value={branchId} 
      onChange={e => setBranchId(e.target.value)}
      required
    >
      {branches.map(b => (
        <option key={b.id} value={b.id}>{b.name}</option>
      ))}
    </select>
  </div>
)}
⚠️ Backend baribir avtomatik to'ldiradi — frontend uchun bu fallback.

---

## BOSQICH 4 — BRANCH UI'DA HAR DOIM KO'RSATISH

### Backend: GET /api/admin/doctors

Fayl: src/app/api/admin/doctors/route.ts

GET handler'da branch include qilish:

`typescript
const doctors = await prisma.doctor.findMany({
  where: { clinicId, isActive: true },
  include: {
    branch: {  // ⚠️ QO'SHISH
      select: { id: true, name: true }
    },
    services: {
      include: {
        service: {
          select: { 
            id: true, 
            name: true, 
            type: true, 
            price: true,
            defaultQueueMode: true,
          }
        }
      }
    }
  },
  orderBy: { createdAt: 'desc' }
});

return ok(doctors.map(d => ({
  id: d.id,
  firstName: d.firstName,
  lastName: d.lastName,
  specialty: d.specialty,
  phone: d.phone,
  photoUrl: d.photoUrl,
  isActive: d.isActive,
  branch: d.branch,  // ⚠️ QO'SHISH
  services: d.services.map(sd => ({
    id: sd.service.id,
    name: sd.service.name,
    type: sd.service.type,
    price: sd.service.price,
    queueMode: sd.queueMode,
  }))
})));

### Frontend: kartochka ko'rinishi

`/admin/doctors/page.tsx` (yoki DoctorCard komponent) — kartochka ichida branch ko'rsatish mantig'ini tekshir va to'g'rilash:

tsx
// Mavjud kartochkada:
<div className="p-4">
  {doctor.photoUrl && <img src={doctor.photoUrl} className="..." />}
  <h3>{doctor.specialty}</h3>
  <p>{doctor.lastName} {doctor.firstName}</p>
  <p>{doctor.phone}</p>
  
  {/* ⚠️ BRANCH — har doim ko'rinishi shart */}
  {doctor.branch ? (
    <p className="text-xs text-gray-500 mt-1">
      🏥 {doctor.branch.name}
    </p>
  ) : (
    <p className="text-xs text-amber-600 mt-1">
      ⚠️ Filial belgilanmagan
    </p>
  )}
  
  {/* ... services va boshqalar */}
</div>

---

## BOSQICH 5 — SHIFOKOR XIZMATGA BIRIKTIRILMAGANLIGI HAQIDA OGOHLANTIRISH

### Frontend: kartochkada warning

Agar shifokor biror xizmatga biriktirilmagan bo'lsa, kartochkada **ogohlantirish** ko'rsatish:

tsx
{doctor.services.length === 0 ? (
  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded">
    <p className="text-sm text-amber-800 font-medium">
      ⚠️ Bu shifokor hali biror xizmatga biriktirilmagan
    </p>
    <p className="text-xs text-amber-700 mt-1">
      Bemorlar uchun ko'rinmaydi. Tahrirlash orqali xizmat biriktiring.
    </p>
    <button
      onClick={() => router.push(/admin/doctors/${doctor.id}/edit)}
      className="mt-2 text-xs text-amber-700 underline hover:text-amber-900"
    >
      Tahrirlash →
    </button>
  </div>
) : (
  // Mavjud xizmatlar va rejimlar bloki
  <div className="mt-3">
    {/* navbat rejimlari... */}
  </div>
)}

Bu ko'rinish admin'ga **darhol vizual** signal beradi:
- ✅ Yashil holat — barchasi yaxshi
- ⚠️ Amber/sariq — xizmat biriktirilmagan

---

## BOSQICH 6 — TAHRIRLASH FORMASIDA SERVICE BIRIKTIRISH

### Fayl: `/admin/doctors/[id]/edit/page.tsx`

Edit formasida **xizmatlar checkbox ro'yxati** mavjud bo'lishi kerak. Tekshir:

1. GET endpoint `/api/admin/doctors/[id]` shifokor ma'lumotlari bilan birga **barcha mavjud xizmatlar ro'yxatini** qaytaradimi?
2. Form'da checkbox'lar mavjudmi va doctor.services ga qarab markered'larmi?
3. Submit'da `serviceIds: string[]` yuboriladimi?

Agar barcha service'lar checkbox shaklida ko'rinmasa, qo'shish kerak:

tsx
const [allServices, setAllServices] = useState([]);
const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);

useEffect(() => {
  // Barcha xizmatlarni olib kelish
  fetch('/api/admin/services', { credentials: 'include' })
    .then(r => r.json())
    .then(json => {
      if (json.success) {
        setAllServices(json.data);
      }
    });
}, []);

useEffect(() => {
  // Doctor mavjud xizmatlarni topish
  if (doctor?.services) {
    setSelectedServiceIds(doctor.services.map(s => s.id));
  }
}, [doctor]);

// Submit body:
const body = {
  firstName, lastName, specialty, phone, photoUrl,
  serviceIds: selectedServiceIds,  // ⚠️ MUHIM
};

// Form ichida:
<div>
  <label className="block font-medium mb-2">Qatnashadigan xizmatlar:</label>
  {allServices.map(service => (
    <label key={service.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded">
      <input
        type="checkbox"
        checked={selectedServiceIds.includes(service.id)}
        onChange={e => {
          if (e.target.checked) {
            setSelectedServiceIds([...selectedServiceIds, service.id]);
          } else {
            setSelectedServiceIds(selectedServiceIds.filter(id => id !== service.id));
          }
        }}
      />
      <span>{service.name} — {Number(service.price).toLocaleString()} so'm</span>
    </label>
  ))}
</div>
`

### Backend: PATCH /api/admin/doctors/[id]

Mavjud PATCH endpoint'iga `serviceIds` qabul qilish (agar yo'q bo'lsa):
// PATCH handler ichida:
if (body.serviceIds && Array.isArray(body.serviceIds)) {
  // Mavjud bog'lanishlarni o'chir
  await prisma.serviceDoctor.deleteMany({
    where: { doctorId: params.id }
  });
  
  // Yangilarini yarat (default queueMode bilan)
  for (const serviceId of body.serviceIds) {
    await prisma.serviceDoctor.create({
      data: { 
        serviceId, 
        doctorId: params.id,
        queueMode: 'online',  // default
      }
    });
  }
}
⚠️ DIQQAT: Mavjud queueMode qiymatlari yo'qoladi! Buni saqlash uchun upsert ishlatish kerak:

if (body.serviceIds && Array.isArray(body.serviceIds)) {
  // Eski bog'lanishlarni queueMode bilan birga saqlab qol
  const oldBindings = await prisma.serviceDoctor.findMany({
    where: { doctorId: params.id }
  });
  const oldModes = Object.fromEntries(
    oldBindings.map(b => [b.serviceId, b.queueMode])
  );

  // Eski bog'lanishlarni o'chir
  await prisma.serviceDoctor.deleteMany({
    where: { doctorId: params.id }
  });
  
  // Yangilarini yarat — eski queueMode ni saqla (yoki default 'online')
  for (const serviceId of body.serviceIds) {
    await prisma.serviceDoctor.create({
      data: { 
        serviceId, 
        doctorId: params.id,
        queueMode: oldModes[serviceId] || 'online',
      }
    });
  }
}
---

## ⚠️ MUHIM QOIDALAR

1. Avval Bosqich 1 (cleanup) ni qil — keyin boshqa bosqichlarga o't. Foydalanuvchidan tasdiq olganingdan keyingina davom et.

2. Race condition tuzatish — KRITIK — har submit tugmasini disabled qiluvchi pattern qo'sh

3. **branchId validatsiya** — yangi shifokor yaratishda agar branch yo'q bo'lxato qaytarar** (400)

4. **branch ni har joyda include qil** — GET, POST, PATCH endpoint'larHech narsa o'chirma:hirma:**
   - Mavjud queueMode mantiqi saqlanadi (Bosqich 1 da qo'shilgan)
   - Photo, prePayment, M2M tizimi saqlanadi
   - Audit log saqlanTypeScript strictstrict** — any ishlatmasTest build build** — npm run build xato bermasligi shCommit'lar alohida:ohida:**
   - Bosqich 1: chore: cleanup duplicate doctors (one-time script)
   - Bosqich 2-6: fix(admin): doctor form race condition + branchId auto + branch UI + service binding

---

## 📋 BAJARISH TARTBosqich 1qich 1** — prisma/cleanup-dups.ts yarat, package.json ga script qo'sh, npm run cleanup:dups ishga tushir. Verifikatsiya qil. Foydalanuvchidan tasdBosqich 2qich 2** — Form race condition tuzatish (new va edit ikkalasiBosqich 3qich 3** — POST API'da branchId avtomatik to'ldirBosqich 4qich 4** — GET API'da branch include + UI'da ko'rsatBosqich 5qich 5** — Kartochkada ogohlantirish ("xizmatga biriktirilmagaBosqich 6qich 6** — Edit formada service checkbox + PATCH API'da queueMode saqlTest:*Test:**
   - Admin sifatida login
   - Yangi shifokor yarat (masalan, "Test Lor — Otolaringolog")
   - Submit tugmasini bir necha marta tezda bos — faqat 1 ta yozuv yaratilsin
   - Yaratilgan shifokorda "Asosiy filial" ko'rinsin
   - Xizmatga biriktirilmaganligi haqida warning ko'rinsin
   - Tahrirlash bos → service checkbox ro'yxatda kerakli xizmatni tanla → saqla
   - Endi shifokor "navbat rejimlari" bilan to'liq holaCommit + push+ pusFoydalanuvchiga xabar:xabar:**
"Bug'lar tuzatildi. Production deploy bo'lgach test qiling:
- Yangi shifokor yaratish — race condition yo'q
- Asosiy filial avtomatik to'ldiriladi va kartochkada ko'rinadi
- Xizmatga biriktirilmagan shifokorda amber ogohlantirish
- Tahrirlash orqali xizmatlar bog'lash mumkin (queueMode saqlanadi)"

---

## 🚀 BOSHLA

1. Birinchi prisma/cleanup-dups.ts ni yarat
2. npm run cleanup:dups ishga tushir va natijani ko'rsat
3. Keyin foydalanuvchidan tasdiq so'rab boshqa bosqichlarga o't