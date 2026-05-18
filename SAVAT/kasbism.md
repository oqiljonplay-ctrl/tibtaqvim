# 🎯 VAZIFA: Service↔️Doctor bog'lanish + Photo qo'shish

## LOYIHA KONTEKSTI

Stack: Next.js 14 (App Router) + Prisma + Supabase PostgreSQL 17 + Vercel + Telegram bot
Repo: oqiljonplay-ctrl/tibtaqvim
Production: https://tibtaqvim.vercel.app
Auth: Custom JWT (jose middleware), HttpOnly cookie (auth_token)
Supabase project_id: lxqimithjjabhnldcugc

Rollar: super_admin, clinic_admin, doctor, receptionist, patient

HOZIRGI HOLAT:
- RLS 15/15 jadvalda yoqilgan
- Audit log trigger faol (6 jadvalda)
- Telegram webhook secret token bilan himoyalangan
- Mavjud: 4 doctor, 6 service, 1 clinic, 1 branch, 35 user, 76 appointment

## MAVJUD MA'LUMOTLAR (TEGMASLIK)

### Doctors (4 ta):
- doc-1: Toshmatov Jasur — Terapevt
- doc-2: Yusupova Dilnoza — Kardiolog
- doc-3: Rahimov Nodir — Nevropatolog
- cmok59t3e0001ky047j8riktd: Sayfiyev Oqil — Stomatolog

### Services (6 ta):
- svc-queue-1: Terapevt qabuli (doctor_queue)
- svc-queue-2: Kardiolog qabuli (doctor_queue)
- cmoik6xo70001jy04xgvdywo2: Ortopedga kunlik kvota (doctor_queue)
- svc-diag-1: Qon tahlili umumiy (diagnostic)
- svc-diag-2: EKG (diagnostic)
- svc-home-1: Uyda bemor ko'rish (home_service)

### Appointments: 76 ta yozuv — TEGMASLIK
Eski bronlar doctorId = NULL bo'lib qoladi (tarixiy ma'lumot saqlanadi).

## STRATEGIK QARORLAR (USER TANLAGAN)

1. Shifokor ko'rinishi: Kasb + Ism Familiya + Narx + Foto (kichik)
   - Misol: "🫀 Kardiolog — Yusupova Dilnoza · 200 000 so'm"
   
2. Service↔️Doctor: Many-to-Many (yangi service_doctors jadval)
   - Bir xizmatni bir nechta shifokor qila oladi
   - Bir shifokor bir nechta xizmatda qatnashishi mumkin

3. diagnostic va home_service ham shifokorlarga bog'lanishi mumkin (admin tanlaydi)

4. Foto: doctors.photoUrl allaqachon bor — frontend'da ishlatish kerak

5. Eski bronlar saqlanadi — doctorId = NULL bo'lib qoladi

## ASOSIY MAQSAD

Super admin shifokor qo'shganda, kasb + ism familiya + narx + foto kiritsin. Bot va webda bemor xizmat tanlaganda, shu shifokorni kasb + ism familiya + narx + foto bilan ko'rsin. Hamma joyda bir xil ko'rinish.

---

# 📋 ISH BOSQICHLARI

## ⚠️ MUHIM QOIDALAR

1. Avval tekshir, keyin yoz — har qadamdan oldin mavjud fayl borligini tekshir
2. Mavjud kodlarni o'chirma — faqat qo'sh va o'zgartir
3. Mavjud konvensiyalarni saqla — fayl strukturasi, naming, lib/api-response patterns
4. Bir bosqich tugagach, foydalanuvchidan tasdiq so'ra — keyingiga o'tma
5. Har bosqichda commit qil — alohida commit message bilan
6. TypeScript strict — har joyda any ishlatma, tip beriishni unutma

---

## BOSQICH 1 — DATABASE SCHEMA (Prisma + Migration)

### 1.1 — Prisma schema o'zgarishi

Fayl: prisma/schema.prisma

Service modeliga qo'shish (mavjud maydonlardan keyin):
model Service {
  // ... mavjud maydonlar ...
  
  // YANGI MAYDONLAR:
  requiresPrePayment Boolean @default(false)
  prePaymentAmount   Decimal? @db.Decimal(12, 2)
  
  // YANGI RELATION:
  doctors ServiceDoctor[]
}
`Doctor modeliga qo'shish:
``prisma
model Doctor {
  // ... mavjud maydonlar ...
  
  // YANGI MAYDONLAR (allaqachon bo'lishi mumkin — tekshir):
  // photoUrl allaqachon bor — qo'shma
  
  // YANGI RELATION:
  services ServiceDoctor[]
}

**Yangi model qo'shish:**
prisma
model ServiceDoctor {
  serviceId String
  doctorId  String
  createdAt DateTime @default(now())
  
  service Service @relation(fields: [serviceId], references: [id], onDelete: Cascade)
  doctor  Doctor  @relation(fields: [doctorId], references: [id], onDelete: Cascade)
  
  @@id([serviceId, doctorId])
  @@index([doctorId])
  @@map("service_doctors")
}

### 1.2 — Migration yaratish

Terminal:
bash
npx prisma migrate dev --name add_service_doctor_relation_and_prepayment
`

Bu avtomatik:
- `service_doctors` jadvalini yaratadi
- `services.requiresPrePayment` va `services.prePaymentAmount` ustunlarini qo'shadi
- Prisma Client'ni qayta generatsiya qiladi

### 1.3 — RLS yoqish yangi jadvalga
Migration tugagach, Supabase MCP orqali (yoki SQL editor):
ALTER TABLE public.service_doctors ENABLE ROW LEVEL SECURITY;

-- Audit log trigger yangi jadvalga
DROP TRIGGER IF EXISTS audit_service_doctors ON public.service_doctors;
CREATE TRIGGER audit_service_doctors
  AFTER INSERT OR UPDATE OR DELETE ON public.service_doctors
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();
Kim qiladi: Foydalanuvchi MCP orqali yoki Supabase Dashboard SQL Editor'da bajaradi.

### 1.4 — Verifikatsiya

- prisma/schema.prisma to'g'ri yangilanganmi?
- npx prisma format ishga tushir
- npx prisma validate xatosiz bajariladimi?
- Schema o'zgarishlari TypeScript types'da paydo bo'ldimi?

### 1.5 — Bosqich 1 tugadi

Commit:
git add prisma/
git commit -m "feat(schema): service-doctor M2M relation + prePayment fields"
Foydalanuvchidan SO'RA: "Bosqich 1 (schema) tugadi. Bosqich 2 (Backend API) ga o'tish uchun ruxsat?"

---

## BOSQICH 2 — BACKEND API

### 2.1 — Service yaratish/yangilash API

Fayl: src/app/api/admin/services/route.ts (mavjud bo'lsa kengaytir, yo'q bo'lsa yarat)

POST yangi service:
// Validation (zod yoki manual)
{
  name: string,
  type: 'doctor_queue' | 'diagnostic' | 'home_service',
  price: number,
  description?: string,
  requiresSlot: boolean,
  requiresAddress: boolean,
  requiresPrePayment: boolean,    // YANGI
  prePaymentAmount?: number,       // YANGI
  dailyLimit?: number,
  doctorIds: string[],             // YANGI — qaysi shifokorlar bog'lanadi
}
Logikasi:
1. requireAuth(req) — faqat super_admin yoki clinic_admin
2. Service yaratish
3. Agar doctorIds.length > 0 — service_doctors ga yozish (Prisma connect):
  
   await prisma.service.create({
     data: {
       ...serviceData,
       doctors: {
         create: doctorIds.map(doctorId => ({ doctorId }))
       }
     }
   });
   
4. Audit log uchun SET LOCAL app.actor_id = '<userId>' ishlat (transaction ichida)
5. Yangi service'ni doctors bilan birga qaytar (include: { doctors: { include: { doctor: true } } })

PATCH /api/admin/services/[id]:
Xuddi shu logika, lekin update. doctorIds o'zgartirilsa:
1. Eski bog'lanishlarni o'chir: await prisma.serviceDoctor.deleteMany({ where: { serviceId: id } })
2. Yangilarini yozish

### 2.2 — Doctor yaratish/yangilash API

Fayl: src/app/api/admin/doctors/route.ts

POST yangi doctor:
{
  firstName: string,
  lastName: string,
  specialty: string,
  phone?: string,
  photoUrl?: string,
  serviceIds: string[],   // YANGI — qaysi xizmatlarda qatnashadi
  isActive: boolean,
}
Logikasi:
1. requireAuth — super_admin yoki clinic_admin
2. Doctor yaratish
3. serviceIds ni service_doctors ga yozish
4. Doctor'ni services bilan birga qaytar

PATCH /api/admin/doctors/[id]:
Update + serviceIds yangilanishi.

### 2.3 — Service ro'yxati API (bemor va admin uchun)

Bemor uchun: src/app/api/services/route.ts (PUBLIC_PATHS'da)

GET — barcha aktiv xizmatlar, biriktirilgan shifokorlar bilan birga:
`typescript
const services = await prisma.service.findMany({
  where: { 
    clinicId, 
    isActive: true 
  },
  include: {
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
          }
        }
      }
    }
  },
  orderBy: { sortOrder: 'asc' }
});

// Frontend uchun moslashtirib qaytar:
return services.map(s => ({
  id: s.id,
  name: s.name,
  type: s.type,
  price: s.price,
  description: s.description,
  requiresPrePayment: s.requiresPrePayment,
  prePaymentAmount: s.prePaymentAmount,
  doctors: s.doctors.map(sd => ({id: sd.doctor.id,
    firstName: sd.doctor.firstName,
    lastName: sd.doctor.lastName,
    specialty: sd.doctor.specialty,
    photoUrl: sd.doctor.photoUrl,
    fullName: ${sd.doctor.lastName} ${sd.doctor.firstName},
    displayName: ${sd.doctor.specialty} — ${sd.doctor.lastName} ${sd.doctor.firstName},
  }))
}));

### 2.4 — Doctor ro'yxati API

**Fayl:** `src/app/api/admin/doctors/route.ts` GET

Doctor'larni `services` bilan qaytar (admin paneli uchun).

### 2.5 — Bosqich 2 tugadi

Commit:
bash
git add src/app/api/
git commit -m "feat(api): service-doctor M2M endpoints, services list with doctors"

**Foydalanuvchidan SO'RA:** "Bosqich 2 (Backend API) tugadi. Bosqich 3 (Admin panel UI) ga o'tish?"

---

## BOSQICH 3 — ADMIN PANEL UI

### 3.1 — Doctor qo'shish/tahrirlash forma

**Fayl:** `src/app/admin/doctors/page.tsx` yoki `src/app/admin/doctors/new/page.tsx`

**Mavjud forma'ga qo'shish kerak bo'lgan maydonlar:**

tsx
<form onSubmit={handleSubmit}>
  {/* Mavjud: firstName, lastName, specialty, phone */}
  
  {/* YANGI: Photo upload */}
  <div>
    <label>Foto (ixtiyoriy)</label>
    <input 
      type="url" 
      placeholder="https://example.com/photo.jpg"
      value={photoUrl}
      onChange={e => setPhotoUrl(e.target.value)}
    />
    {photoUrl && (
      <img 
        src={photoUrl} 
        alt="Doctor preview" 
        className="w-20 h-20 rounded-full object-cover mt-2"
        onError={(e) => e.currentTarget.style.display = 'none'}
      />
    )}
  </div>
  
  {/* YANGI: Xizmatlar (checkbox list) */}
  <div>
    <label>Qatnashadigan xizmatlar:</label>
    {services.map(service => (
      <label key={service.id} className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={selectedServiceIds.includes(service.id)}
          onChange={(e) => {
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
</form>

**Doctor preview kartochkasi (kasb + ism + foto):**
tsx
<div className="flex items-center gap-3 p-3 border rounded-lg">
  {doctor.photoUrl ? (
    <img 
      src={doctor.photoUrl} 
      alt={doctor.firstName} 
      className="w-12 h-12 rounded-full object-cover"
    />
  ) : (
    <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
      <span className="text-xl">👤</span>
    </div>
  )}
  <div>
    <p className="font-medium">{doctor.specialty}</p>
    <p className="text-sm text-gray-600">{doctor.lastName} {doctor.firstName}</p>
  </div>
</div>

### 3.2 — Service qo'shish/tahrirlash forma

**Fayl:** `src/app/admin/services/page.tsx`

**Yangi maydonlar:**
tsx
{/* Oldindan to'lov */}
<div>
  <label className="flex items-center gap-2">
    <input
      type="checkbox"
      checked={requiresPrePayment}
      onChange={e => setRequiresPrePayment(e.target.checked)}
    />
    <span>Oldindan to'lov talab qilinadi</span>
  </label>
  
  {requiresPrePayment && (
    <div className="mt-2">
      <label>Oldindan to'lov summasi (so'm)</label>
      <input
        type="number"
        value={prePaymentAmount}
        onChange={e => setPrePaymentAmount(Number(e.target.value))}
        placeholder="Masalan: 50000"
        min="0"
      />
      <p className="text-xs text-gray-500 mt-1">
        Agar bo'sh qoldirilsa, xizmat narxining 100% to'lash talab qilinadi
      </p>
    </div>
  )}
</div>

{/* Shifokorlar bog'lash */}
<div>
  <label>Bu xizmatni qaysi shifokorlar qila oladi:</label>
  {doctors.map(doctor => (<label key={doctor.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded">
      <input
        type="checkbox"
        checked={selectedDoctorIds.includes(doctor.id)}
        onChange={(e) => toggleDoctor(doctor.id, e.target.checked)}
      />
      {doctor.photoUrl ? (
        <img src={doctor.photoUrl} className="w-8 h-8 rounded-full" />
      ) : (
        <div className="w-8 h-8 rounded-full bg-gray-200" />
      )}
      <span>{doctor.specialty} — {doctor.lastName} {doctor.firstName}</span>
    </label>
  ))}
  
  {doctors.length === 0 && (
    <p className="text-sm text-gray-500">Avval shifokor qo'shing</p>
  )}
</div>

### 3.3 — Shared component yaratish

**Yangi fayl:** `src/components/DoctorCard.tsx`

tsx
interface DoctorCardProps {
  doctor: {
    firstName: string;
    lastName: string;
    specialty: string;
    photoUrl?: string | null;
  };
  price?: number;
  size?: 'sm' | 'md' | 'lg';
  showPrice?: boolean;
}

export function DoctorCard({ doctor, price, size = 'md', showPrice = false }: DoctorCardProps) {
  const sizeClasses = {
    sm: { img: 'w-8 h-8', text: 'text-sm' },
    md: { img: 'w-12 h-12', text: 'text-base' },
    lg: { img: 'w-16 h-16', text: 'text-lg' },
  };
  const s = sizeClasses[size];
  
  return (
    <div className="flex items-center gap-3">
      {doctor.photoUrl ? (
        <img 
          src={doctor.photoUrl} 
          alt={doctor.firstName}
          className={${s.img} rounded-full object-cover flex-shrink-0}
        />
      ) : (
        <div className={${s.img} rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center flex-shrink-0}>
          <span className="text-white font-medium">
            {doctor.firstName[0]}{doctor.lastName[0]}
          </span>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className={${s.text} font-medium text-gray-900}>{doctor.specialty}</p>
        <p className={${s.text === 'text-sm' ? 'text-xs' : 'text-sm'} text-gray-600}>
          {doctor.lastName} {doctor.firstName}
        </p>
        {showPrice && price !== undefined && (
          <p className={${s.text === 'text-sm' ? 'text-xs' : 'text-sm'} text-green-700 font-medium}>
            {Number(price).toLocaleString()} so'm
          </p>
        )}
      </div>
    </div>
  );
}

Bu component'ni admin, doctor, reception panellarda va webapp'da ishlat.

### 3.4 — Bosqich 3 tugadi

Commit:
bash
git add src/app/admin/ src/components/DoctorCard.tsx
git commit -m "feat(admin): doctor-service M2M UI, photo support, shared DoctorCard"

**Foydalanuvchidan SO'RA:** "Bosqich 3 (Admin UI) tugadi. Bosqich 4 (Bot flow) ga o'tish?"

---

## BOSQICH 4 — TELEGRAM BOT FLOW

### 4.1 — Bot flow rejasi

Joriy flow:
/start → xizmat tanlash → sana → bron

Yangi flow:
/start
  ↓
Xizmat tanlash (narx va type bilan)
  ↓
  ├─ doctor_queue → Shifokor tanlash (kasb + ism, foto kelajakda)
  ├─ diagnostic → Shifokor tanlash (agar bog'langan bo'lsa) / yoki to'g'ridan
  └─ home_service → Shifokor tanlash (agar bog'langan bo'lsa)
  ↓
Sana tanlash
  ↓
  ├─ requiresPrePayment === true → To'lov ma'lumoti ko'rsatish (haqiqiy to'lov keyingi bosqichda)
  └─ requiresPrePayment === false → To'g'ri ravishda bron
  ↓
Bron yaratilgach: tasdiq + ma'lumotlar

### 4.2 — Bot state machine

**Fayl:** `src/lib/bot/states.ts` (yoki mavjud joy)

Yangi state qo'shish:
typescript
// Mavjud: 'awaiting_service', 'awaiting_date', etc.
// YANGI: 'awaiting_doctor' — service tanlangach, doctor tanlash bosqichi

### 4.3 — Service ro'yxatini ko'rsatish

**Fayl:** Bot service handler (qaerda service tanlash bo'lsa)

typescript
// Service tugmalarini yaratish
const services = await prisma.service.findMany({
  where: { clinicId, isActive: true },
  orderBy: { sortOrder: 'asc' }
});

const keyboard = services.map(s => ([{
  text: ${s.name} — ${Number(s.price).toLocaleString()} so'm,
  callback_data: service:${s.id}
}])); await bot.sendMessage(chatId, '🩺 Qaysi xizmatga yozilmoqchisiz?', {
  reply_markup: { inline_keyboard: keyboard }
});

### 4.4 — Shifokor tanlash bosqichi

Service tanlangach (callback handler):
typescript
// service:svc-queue-2 keldi
const service = await prisma.service.findUnique({
  where: { id: serviceId },
  include: {
    doctors: {
      where: { doctor: { isActive: true } },
      include: { doctor: true }
    }
  }
});

if (service.doctors.length === 0) {
  // Shifokorga bog'lanmagan — to'g'ridan sana tanlash
  // (masalan: diagnostic xizmatlar shifokorsiz bo'lishi mumkin)
  await proceedToDateSelection(chatId, serviceId);
  return;
}

if (service.doctors.length === 1) {
  // Faqat 1 ta shifokor — avtomatik tanla
  const doctor = service.doctors[0].doctor;
  await saveBotState(chatId, { 
    step: 'awaiting_date', 
    serviceId, 
    doctorId: doctor.id 
  });
  await sendDoctorConfirmation(chatId, doctor, service);
  await proceedToDateSelection(chatId, serviceId);
  return;
}

// Bir nechta shifokor — tanlash imkoniyati
const keyboard = service.doctors.map(sd => ([{
  text: ${sd.doctor.specialty} — ${sd.doctor.lastName} ${sd.doctor.firstName},
  callback_data: doctor:${sd.doctor.id}
}]));

await bot.sendMessage(chatId, 
  👨‍⚕️ ${service.name} uchun shifokorni tanlang:\n\n💰 Narx: ${Number(service.price).toLocaleString()} so'm, 
  { reply_markup: { inline_keyboard: keyboard } }
);

### 4.5 — Doctor callback handler

typescript
// doctor:doc-2 keldi
const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });

await saveBotState(chatId, { 
  step: 'awaiting_date', 
  serviceId: state.serviceId, 
  doctorId 
});

// Doctor info card ko'rsat
let message = ✅ Tanlandi:\n\n👨‍⚕️ <b>${doctor.specialty}</b>\n${doctor.lastName} ${doctor.firstName};
if (doctor.photoUrl) {
  // Foto bilan jo'natish
  await bot.sendPhoto(chatId, doctor.photoUrl, { 
    caption: message,
    parse_mode: 'HTML'
  });
} else {
  await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
}

// Sana tanlash davom etadi
await proceedToDateSelection(chatId);

### 4.6 — Bron yaratish — doctorId bilan

**Fayl:** `src/app/api/book/route.ts` (yoki bot bron handler)

Mavjud bron yaratish kodiga `doctorId` qo'shish:
typescript
const appointment = await prisma.appointment.create({
  data: {
    clinicId,
    serviceId,
    doctorId: state.doctorId || null,  // YANGI
    userId,
    patientName,
    patientPhone,
    date,
    status: 'booked',
    // ...
  }
});

### 4.7 — Tasdiq xabari (yangi format)

Bron muvaffaqiyatli bo'lgach:
typescript
const message = 
✅ <b>Navbatingiz qabul qilindi!</b>

🩺 <b>Xizmat:</b> ${service.name}
${doctor ? 👨‍⚕️ <b>Shifokor:</b> ${doctor.specialty} — ${doctor.lastName} ${doctor.firstName}\n : ''}
📅 <b>Sana:</b> ${formatDate(date)}
🎫 <b>Navbat:</b> #${queueNumber}
💰 <b>To'lov:</b> ${Number(service.price).toLocaleString()} so'm
${service.requiresPrePayment ? '\n⚠️ <b>Diqqat:</b> Bu xizmat oldindan to\'lash talab qiladi. Tez orada to\'lov havolasi yuboriladi.' : ''}
;

### 4.8 — Bosqich 4 tugadi

Commit:
bash
git add src/app/api/book/ src/lib/bot/ src/app/api/webhook/
git commit -m "feat(bot): doctor selection step, photo support, payment info display"

**Foydalanuvchidan SO'RA:** "Bosqich 4 (Bot) tugadi. Bosqich 5 (Webapp) ga o'tish?"

---

## BOSQICH 5 — WEBAPP (Telegram Mini App)

### 5.1 — Webapp service list

**Fayl:** `src/app/webapp/page.tsx` yoki shunga o'xshash

Service ro'yxatini yangilash — har xizmatga bog'langan shifokorlarni ko'rsatish:

tsx
import { DoctorCard } from '@/components/DoctorCard';

{services.map(service => (
  <div key={service.id} className="bg-white rounded-xl p-4 mb-3 shadow-sm">
    <div className="flex items-start justify-between mb-3">   <div>
        <h3 className="font-semibold text-lg">{service.name}</h3>
        <p className="text-sm text-gray-500">{service.description}</p>
      </div>
      <div className="text-right">
        <p className="text-lg font-bold text-green-700">
          {Number(service.price).toLocaleString()} so'm
        </p>
        {service.requiresPrePayment && (
          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
            Oldindan to'lov
          </span>
        )}
      </div>
    </div>
    
    {service.doctors.length > 0 && (
      <div className="border-t pt-3 mt-3">
        <p className="text-xs text-gray-500 mb-2">Shifokorlar:</p>
        <div className="space-y-2">
          {service.doctors.map(doctor => (
            <DoctorCard 
              key={doctor.id} 
              doctor={doctor} 
              size="sm" 
            />
          ))}
        </div>
      </div>
    )}
    
    <button 
      onClick={() => bookService(service.id)}
      className="w-full mt-3 bg-blue-600 text-white py-2 rounded-lg"
    >
      Bron qilish
    </button>
  </div>
))}

### 5.2 — Bosqich 5 tugadi

Commit:
bash
git add src/app/webapp/
git commit -m "feat(webapp): service list with doctors and prepayment indicator"

---

## BOSQICH 6 — TEST VA VERIFIKATSIYA

### 6.1 — Schema test

Supabase MCP yoki SQL editor:
sql
-- Yangi jadval bormi?
SELECT * FROM information_schema.tables WHERE table_name = 'service_doctors';

-- Yangi ustunlar bormi?
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'services' AND column_name IN ('requiresPrePayment', 'prePaymentAmount');

-- RLS yoqilganmi?
SELECT rowsecurity FROM pg_tables WHERE tablename = 'service_doctors';

-- Trigger faolmi?
SELECT trigger_name FROM information_schema.triggers WHERE event_object_table = 'service_doctors';

### 6.2 — Admin panel test

1. Admin sifatida login qil (`+998900000000` / `admin123`)
2. `/admin/doctors` ga o't
3. Yangi shifokor qo'sh: photo URL + specialty + xizmatlar
4. Saqla
5. DB tekshir — `service_doctors` jadvalda yozuv paydo bo'ldimi?

### 6.3 — Service admin test

1. `/admin/services` ga o't
2. Mavjud xizmatga shifokor biriktir
3. `requiresPrePayment` ni yoqib ko'r
4. Saqla
5. DB tekshir

### 6.4 — Bot test

Telegram'da:
1. `/start`
2. Xizmat tanlang
3. Shifokor tanlash bosqichi paydo bo'ldimi?
4. Tanla → sana so'rasinmi?
5. Bron yarat
6. DB tekshir — `appointments.doctorId` to'ldirilganmi?

### 6.5 — Webapp test

1. Telegram bot orqali webapp och
2. Xizmatlar ro'yxatida shifokorlar ko'rinmoqdami?
3. Foto va kasb to'g'ri ko'rsatilganmi?

### 6.6 — Yakuniy commit

bash
git add .
git commit -m "test: verify all stages of service-doctor M2M integration"
`

---

## ⚠️ MUHIM ESLATMALAR

### A) RLS va Prisma
- Prisma `postgres` super-user'dan ulanadi → RLS ni avtomatik bypass qiladi
- Hech qanday RLS muammosi bo'lmasligi kerak

### B) Foto upload
- Hozir faqat URL kiritish — image upload kelajakda qo'shiladi
- Doctor.photoUrl mavjud — to'liq URL bo'lishi kerak (https://...)
- Fallback: agar `photoUrl` yo'q bo'lsa, kasalga initial'lar ko'rsatiladi

### C) Cookie va Auth
- Barcha API'lar `requireAuth(req)` chaqirishi kerak
- Cookie `auth_token` orqali keladi (HttpOnly)
- Kod o'zgarishi kerak emas — mavjud auth pattern saqlanadi

### D) Eski bronlar
- 76 ta mavjud bron `doctorId = NULL` qoladi
- Yangi bronlarda `doctorId` to'ldirildi (agar shifokor tanlangan bo'lsa)
- Stats sahifasida eski bronlar uchun "Shifokor: Aniqlanmagan" deb ko'rsatish kerak

### E) Audit log
- Yangi `service_doctors` jadvali avtomatik audit log'ga yoziladi
- Doctor va Service o'zgarishlari ham log'ga tushadi (mavjud trigger)

### F) Validation
- Foydalanuvchi xato kiritsa, aniq xabar ko'rsat
- `requiresPrePayment = true` bo'lsa, `prePaymentAmount` majburiy emas (default = service.price)
- `doctorIds` empty bo'lishi mumkin (xizmat shifokorsiz)
### G) Migration buzilmasligi
- Migration yaratilganda avtomatik rollback mavjud
- Production'ga deploy qilishdan oldin lokal'da test qilish
- npx prisma migrate deploy production'da ishga tushadi

### H) TypeScript types
- prisma generate har migration'dan keyin ishga tushadi
- Yangi types: Prisma.ServiceGetPayload<{...}> ishlatish mumkin

---

## 📋 BAJARILGANDAN KEYIN

Foydalanuvchi quyidagilarni tekshirishi kerak:

1. ✅ Production deploy READY
2. ✅ Admin shifokor qo'sha oladi (photo + specialty + price + services)
3. ✅ Admin xizmatga shifokor biriktirishi mumkin
4. ✅ Bot xizmat tanlangach shifokor so'raydi
5. ✅ Webapp'da xizmatlar shifokorlar bilan ko'rinadi
6. ✅ Eski 76 ta bron buzilmagan
7. ✅ Yangi bronlarda doctorId to'g'ri yoziladi
8. ✅ Audit log yangi o'zgarishlarni qayd qiladi

## 🚀 BOSHLASH

Birinchi:
1. prisma/schema.prisma ni o'qib chiq
2. Mavjud Service va Doctor modellarini ko'r
3. Bot kodi qaerda saqlanishini topish (src/app/api/webhook/telegram/ yoki src/lib/bot/)
4. Foydalanuvchiga "Schema o'zgarishlari uchun Bosqich 1 ga o'tishga ruxsat?" deb so'ra
5. Ruxsat bo'lgach, Bosqich 1 dan boshla

Hozir Bosqich 1 dan boshla.