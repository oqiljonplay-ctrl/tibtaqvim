# 🎯 VAZIFA: Navbat rejimi tizimi — Bosqich 1 (Live + Online + Slot Disabled)

## STRATEGIK KONTEKST

### Loyiha
- Repo: oqiljonplay-ctrl/tibtaqvim
- Stack: Next.js 14 (App Router) + Prisma + Supabase PG17 + Vercel + Telegram WebApp/Bot
- Production: https://tibtaqvim.vercel.app
- Supabase project: lxqimithjjabhnldcugc

### Hozirgi holat
- Service-Doctor M2M tizimi ishlamoqda
- 6 ta xizmat, 6 ta doctor, 6 ta service-doctor binding
- Webapp + Bot + Admin paneli ishlamoqda
- RLS yoqilgan, audit log faol
- DB toza (4 ta yangi test bron, eski 78 tasi o'chirilgan)

### Maqsad
Har service-doctor bog'lanishi uchun 3 xil navbat rejimi:
1. **live** — Kunlik ro'yxatga kirish (zaxira + kassadan jonli navbat)
2. **online** — Masofaviy jonli navbat (bot/web orqali raslot**slot** — Aniq vaqt slot (Bosqich 2 da — hozir disabled)

## ⚠️ ARXITEKTURA QARORLARI (foydalanuvchi tasdiqlagDoctor-Service level level** rejim (M2M jadvalda)
   - Sabab: Yusupova Kardiologda online, EKG da slot bo'lishi mumkin
   - service_doctors.queueMode ustuni qo'shiladiService fallbackllback** — shifokorsiz xizmatlar uchun
   - services.defaultQueueMode ustuni qo'shiladi
   - Service-doctor binding yo'q bo'lsa fallbRadio behaviorhavior** — har bog'lanishda faqat 1 rejim faol
   - Toggle ko'rinishi, lekin mantiq radio (birini yoqsa boshqasi o'chadi)
   - Database darajasida queueMode bitta qiymat saqlaSlot rejim Bosqich 2 dah 2 da** — hozir disabled
   - UI da ko'rinadi, lekin "Tez orada" deb yozadi
   - DB da 'slot' qiymat saqlanishi mumkin, lekin Bot/Web hozir handle qilmaDefault qiymatqiymat** — 'online'
   - Eng zamonaviy, mavjud xulq-atvorga to'g'ri keladi
   - Migration paytida hammasi online bo'lLive rejimda oldindan to'lovto'lov** — majburiy
   - requiresPrePayment allaqachon bor schema'da
   - Live rejim bilan birga ishlaydi

---

# 📋 ISH BOSQICHLARI

## BOSQICH 1.1 — DATABASE SCHEMA

### Fayl: prisma/schema.prisma

**1. Yangi enum:**
enum QueueMode {
  live    // Kunlik ro'yxatga kirish (kassadan navbat)
  online  // Masofaviy jonli navbat (bot/web raqami)
  slot    // Aniq vaqt slot (Bosqich 2)
}
**2. `Service modeliga qo'shish:**
``prisma
model Service {
  // ... mavjud maydonlar ...
  
  // YANGI:
  defaultQueueMode QueueMode @default(online)
}

**3. `ServiceDoctor` modelini yangilash:**
prisma
model ServiceDoctor {
  serviceId String
  doctorId  String
  queueMode QueueMode @default(online)  // YANGI
  createdAt DateTime  @default(now())
  
  // ... mavjud relations ...
}

**4. Migration yaratish:**
bash
npx prisma migrate dev --name add_queue_mode_system

Bu avtomatik:
- `QueueMode` enum yaratiladi
- `services.defaultQueueMode` qo'shiladi (default: `online`)
- `service_doctors.queueMode` qo'shiladi (default: `online`)

### Verifikatsiya:
sql
-- Yangi enum
SELECT enum_range(NULL::"QueueMode");
-- Natija: {live,online,slot}

-- Yangi ustunlar
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name IN ('services', 'service_doctors') 
  AND column_name LIKE '%QueueMode%';

### Verifikatsiya tugagach commit qil:
bash
git add prisma/
git commit -m "feat(schema): queue mode system (live/online/slot) on service-doctor M2M"

---

## BOSQICH 1.2 — BACKEND API

### Fayl: `src/app/api/admin/doctors/route.ts` (GET — kengaytirish)

Doctor list endpoint'i `serviceDoctors` ma'lumotini `queueMode` bilan qaytarishi kerak:

typescript
const doctors = await prisma.doctor.findMany({
  where: { clinicId, isActive: true },
  include: {
    services: {  // ServiceDoctor relation
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
// Format:
return doctors.map(doctor => ({
  // ... mavjud maydonlar ...
  services: doctor.services.map(sd => ({
    id: sd.service.id,
    name: sd.service.name,
    type: sd.service.type,
    price: sd.service.price,
    queueMode: sd.queueMode,  // YANGI
  }))
}));

### Fayl: `src/app/api/admin/doctors/[id]/route.ts` (PATCH — kengaytirish)

Service-Doctor binding'ning queueMode'ini yangilash uchun:

typescript
// Body schema:
{
  // ... mavjud maydonlar ...
  serviceQueueModes?: Array<{
    serviceId: string;
    queueMode: 'live' | 'online' | 'slot';
  }>;
}

// Logikasi:
if (body.serviceQueueModes) {
  for (const item of body.serviceQueueModes) {
    await prisma.serviceDoctor.update({
      where: {
        serviceId_doctorId: {
          serviceId: item.serviceId,
          doctorId: params.id,
        }
      },
      data: { queueMode: item.queueMode },
    });
  }
}

### Fayl: `src/app/api/services/route.ts` (GET — kengaytirish)

Bemor uchun public endpoint — `queueMode` ham qaytadi:

typescript
const services = await prisma.service.findMany({
  where: { clinicId, isActive: true },
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
            photoUrl: true 
          } 
        } 
      }
    }
  }
});

// Response format:
return services.map(s => ({
  id: s.id,
  name: s.name,
  type: s.type,
  price: s.price,
  requiresPrePayment: s.requiresPrePayment,
  prePaymentAmount: s.prePaymentAmount,
  defaultQueueMode: s.defaultQueueMode,  // YANGI
  doctors: s.doctors.map(sd => ({
    id: sd.doctor.id,
    firstName: sd.doctor.firstName,
    lastName: sd.doctor.lastName,
    specialty: sd.doctor.specialty,
    photoUrl: sd.doctor.photoUrl,
    queueMode: sd.queueMode,  // YANGI — har shifokor uchun rejim
  }))
}));

### Fayl: `src/app/api/book/route.ts` (POST — kengaytirish)

Bron yaratish logikasi `queueMode` ga qarab farqlanadi:

typescript
// Bron yaratishdan oldin queueMode aniqlash:
const serviceDoctor = doctorId ? await prisma.serviceDoctor.findUnique({
  where: { serviceId_doctorId: { serviceId, doctorId } },
  include: { service: true },
}) : null;

const queueMode = serviceDoctor?.queueMode 
                  || (await prisma.service.findUnique({ where: { id: serviceId } }))?.defaultQueueMode 
                  || 'online';

// Mantiq:
let queueNumber: number | null = null;
let initialStatus: 'booked' | 'pending' = 'booked';
let paymentStatus: 'unpaid' | 'paid' | 'not_required' = 'not_required';

if (queueMode === 'online') {
  // Onlayn rejim — darhol navbat raqami beriladi
  queueNumber = await getNextQueueNumber(clinicId, date, serviceId);
  paymentStatus = service.requiresPrePayment ? 'pending' : 'not_required';
}

if (queueMode === 'live') {
  // Kunlik rejim — navbat raqami yo'q, kassada beriladi
  queueNumber = null;
  paymentStatus = 'pending';  // To'lov majburiy live rejimda
}

if (queueMode === 'slot') {
  // Slot rejim — hozir disabled
  return error('Slot mode hali ishga tushmagan', 400);
}

const appointment = await prisma.appointment.create({
  data: {
    clinicId,
    serviceId,
    doctorId,
    userId,
    patientName,
    patientPhone,
    date,
    status: initialStatus,
    queueNumber,
    paymentStatus,
    // ...
  }
});

⚠️ **MUHIM:** `appointments.paymentStatus` ustuni allaqachon mavjud (oldingi migration'da).

### Verifikatsiya tugagach commit qil:
bash
git add src/app/api/
git commit -m "feat(api): queue mode in admin doctors + public services + book endpoints"
`

---

## BOSQICH 1.3 — ADMIN UI

### Fayl: `src/app/admin/doctors/page.tsx`

Doctor kartochkasini kengaytir — har biriktirilgan xizmat uchun rejim tugmalari:
function QueueModeSelector({ 
  serviceId, 
  serviceName, 
  currentMode,
  onChange 
}: {
  serviceId: string;
  serviceName: string;
  currentMode: 'live' | 'online' | 'slot';
  onChange: (mode: 'live' | 'online' | 'slot') => void;
}) {
  return (
    <div className="border rounded-lg p-3 bg-gray-50">
      <p className="text-sm font-medium text-gray-700 mb-2">{serviceName}</p>
      
      <div className="space-y-2">
        {/* LIVE */}
        <label className="flex items-center justify-between p-2 bg-white rounded cursor-pointer hover:bg-blue-50 transition">
          <div>
            <span className="text-sm font-medium">💵 Kunlik ro'yxatga kirish</span>
            <p className="text-xs text-gray-500 mt-0.5">
              Bemor oldindan to'laydi, klinikada kassadan jonli navbat oladi
            </p>
          </div>
          <input
            type="radio"
            name={`queueMode-${serviceId}`}
            checked={currentMode === 'live'}
            onChange={() => onChange('live')}
            className="w-5 h-5 text-blue-600"
          />
        </label>

        {/* ONLINE */}
        <label className="flex items-center justify-between p-2 bg-white rounded cursor-pointer hover:bg-blue-50 transition">
          <div>
            <span className="text-sm font-medium">🎫 Masofaviy jonli navbat</span>
            <p className="text-xs text-gray-500 mt-0.5">
              Bemor online navbat raqamini darhol oladi, vaqtida kelishi kerak
            </p>
          </div>
          <input
            type="radio"
            name={`queueMode-${serviceId}`}
            checked={currentMode === 'online'}
            onChange={() => onChange('online')}
            className="w-5 h-5 text-blue-600"
          />
        </label>

        {/* SLOT — disabled */}
        <label className="flex items-center justify-between p-2 bg-gray-100 rounded cursor-not-allowed opacity-60">
          <div>
            <span className="text-sm font-medium">🕐 Aniq vaqt sloti</span>
            <p className="text-xs text-gray-500 mt-0.5">
              Tez orada qo'shiladi
            </p>
          </div>
          <input
            type="radio"
            disabled
            className="w-5 h-5"
          />
        </label>
      </div>
    </div>
  );
}
Va Doctor kartochkasiga integratsiya:

`tsx
function DoctorCard({ doctor, onUpdate, onDelete }) {
  const [modes, setModes] = useState(
    Object.fromEntries(
      doctor.services.map(s => [s.id, s.queueMode])
    )
  );
  const [saving, setSaving] = useState(false);

  const handleModeChange = (serviceId: string, mode: 'live' | 'online' | 'slot') => {
    setModes(prev => ({ ...prev, [serviceId]: mode }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const serviceQueueModes = Object.entries(modes).map(([serviceId, queueMode]) => ({
        serviceId,
        queueMode,
      }));

      const res = await fetch(`/api/admin/doctors/${doctor.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceQueueModes }),
      });

      const json = await res.json();
      if (!json.success) {
        alert(json.error?.message || "Saqlashda xatolik");
        return;
      }
      onUpdate();
    } catch (e) {
      alert("Server xatosi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
      {/* Mavjud doctor info ... photoUrl, specialty, name, phone, edit/delete */}

      {doctor.services && doctor.services.length > 0 && (
        <div className="mt-4 pt-4 border-t">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">
            📋 Xizmatlar va navbat rejimi
            </h4>
          
          <div className="space-y-3">
            {doctor.services.map(service => (
              <QueueModeSelector
                key={service.id}
                serviceId={service.id}
                serviceName={${service.name} (${formatPrice(service.price)})}
                currentMode={modes[service.id]}
                onChange={(mode) => handleModeChange(service.id, mode)}
              />
            ))}
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-3 w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saqlanmoqda..." : "Rejimlarni saqlash"}
          </button>
        </div>
      )}
    </div>
  );
}

### Verifikatsiya tugagach commit qil:
bash
git add src/app/admin/
git commit -m "feat(admin): queue mode radio buttons per service in doctor cards"

---

## BOSQICH 1.4 — BOT FLOW

### Fayl: `src/app/api/webhook/telegram/route.ts` (yoki bot logic qaysi joyda)

Bron yaratishda `queueMode` aniqlash kerak. Mavjud kodda bot service va doctor tanlangach, **API'ga POST yuboradi**. Yangi mantiq backend tomonda allaqachon (Bosqich 1.2 da).

Lekin **tasdiqlash xabari** rejimga qarab farqlanishi kerak. Bot oxirgi bron yaratilgach yuboradigan xabar:

typescript
async function sendBookingConfirmation(
  chatId: number, 
  appointment: any, 
  service: any, 
  doctor: any | null,
  queueMode: 'live' | 'online' | 'slot'
) {
  let message = ✅ <b>Navbatingiz tasdiqlandi!</b>\n\n;
  message += 📋 <b>Xizmat:</b> ${service.name}\n;
  message += 💰 <b>Narx:</b> ${Number(service.price).toLocaleString()} so'm\n;
  message += 📅 <b>Sana:</b> ${formatDate(appointment.date)}\n;
  
  if (doctor) {
    message += 👨‍⚕️ <b>Shifokor:</b> ${doctor.specialty} — ${doctor.lastName} ${doctor.firstName}\n;
  }
  
  message += 🆔 <b>ID:</b> ${appointment.tibId || appointment.id}\n\n;

  if (queueMode === 'live') {
    message += 💵 <b>Rejim:</b> Kunlik ro'yxatga kirish\n\n;
    message += ⚠️ <b>Diqqat:</b>\n;
    message += • ${formatDate(appointment.date)} kuni klinikaga keling\n;
    message += • Kassaga ushbu ID ni ko'rsating\n;
    message += • Kassa sizga jonli navbat raqamini beradi\n;
    message += • Kabinet oldida shu raqam bilan kutasiz\n\n;
    if (appointment.paymentStatus === 'pending') {
      message += 💳 <b>To'lov:</b> Klinikaga kelishingizdan oldin online to'lashingiz mumkin\n;
    }
  }
  
  if (queueMode === 'online') {
    message += 🎫 <b>Rejim:</b> Masofaviy jonli navbat\n\n;
    if (appointment.queueNumber) {
      message += 🔢 <b>Navbat raqamingiz:</b> #${appointment.queueNumber}\n\n;
    }
    message += ✅ <b>Diqqat:</b>\n;
    message += • ${formatDate(appointment.date)} kuni vaqtida keling\n;
    message += • To'g'ridan-to'g'ri kabinet oldiga keling\n;
    message += • Kassaga borish shart emas\n;
    message += • Navbatingiz #${appointment.queueNumber || 'N'} — botda ko'rinadi\n;
  }

  if (doctor?.photoUrl) {
    await bot.sendPhoto(chatId, doctor.photoUrl, { 
      caption: message, 
      parse_mode: 'HTML' 
    });
  } else {
    await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
  }
}

### Verifikatsiya tugagach commit qil:
bash
git add src/app/api/webhook/telegram/ src/lib/bot/
git commit -m "feat(bot): mode-aware booking confirmation messages (live/online)"

---

## BOSQICH 1.5 — WEBAPP UI

### Fayl: `src/app/webapp/page.tsx` (yoki Profilim sahifa)

Profilim sahifasidagi bron kartochkasiga **rejim badge**'i qo'shing. Mavjud kartochka dizayni saqlanadi, faqat status badge ostiga rejim ko'rsatkichi qo'shiladi:

tsx
// Status badge yonida yoki ostida:
{apt.queueMode === 'live' && (
  <div className="mt-2 px-2 py-1 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
    💵 Kunlik ro'yxat<br/>
    <span className="text-amber-600">Kassadan navbat oling</span>
  </div>
)}
{apt.queueMode === 'online' && apt.queueNumber && (
  <div className="mt-2 px-2 py-1 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
    🎫 Onlayn navbat<br/>
    <span className="text-blue-600">To'g'ridan kabinetga</span>
  </div>
)}

⚠️ Buning uchun `/api/webapp/appointments` endpoint ham `queueMode` ni qaytarishi kerak. Tekshirib qo'sh.

### Fayl: `src/app/webapp/book/...` (bron yaratish sahifa)

Bron yaratish jarayonida, **xizmat va shifokor tanlangach** — keyingi qadamga o'tishdan oldin **rejim haqida tushuncha** ko'rsatish kerak:

tsx
// Sana tanlash sahifasidan oldin yoki tasdiqlashda:
{selectedDoctor && (
  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
    <p className="text-sm font-medium text-blue-900 mb-1">
      ℹ️ Navbat rejimi: {
        selectedDoctor.queueMode === 'live' ? '💵 Kunlik ro\'yxat' :
        selectedDoctor.queueMode === 'online' ? '🎫 Onlayn navbat' :
        '🕐 Aniq vaqt'
      }
    </p>
    <p className="text-xs text-blue-700">
      {selectedDoctor.queueMode === 'live' && (
        <>Siz oldindan to'lab, tanlangan kuni klinikaga kelib kassadan jonli navbat olasiz.</>
      )}
      {selectedDoctor.queueMode === 'online' && (
        <>Sizga onlayn navbat raqami beriladi. Tanlangan kuni vaqtida kabinet oldiga kelasiz.</>
      )}
    </p>
  </div>
)}

### Verifikatsiya tugagach commit qil:
bash
git add src/app/webapp/
git commit -m "feat(webapp): queue mode info on booking flow + profile badge"

---

## BOSQICH 1.6 — TEST VA VERIFIKATSIYA

### 1. DB tekshirish
sql
-- Yangi ustunlar
SELECT 
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='services' AND column_name='defaultQueueMode') AS service_mode,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name='service_doctors' AND column_name='queueMode') AS sd_mode;

-- Default qiymatlar
SELECT name, "defaultQueueMode" FROM services WHERE "isActive"=true;
SELECT "serviceId", "doctorId", "queueMode" FROM service_doctors;

### 2. Admin panel test
- `/admin/doctors` — har shifokorda xizmat ro'yxati va rejim radio'lari ko'rinadi
- Yusupova Dilnoza kartochkasini och
- Kardiolog qabuli uchun "live" tanla, EKG uchun "online" qoldir
- "Rejimlarni saqlash" bos
- DB ni tekshir — service_doctors yangilanganini tasdiqla

### 3. Bot test
- Telegram'da /start
- "Kardiolog qabuli" tanla (yuqorida live qilingan)
- Yusupova tanla
- Sana tanla
- Bron yaratilgach **live xabari** kelishi kerak: "kassadan navbat oling"

- Yangi suhbat
- "EKG" tanla (online qoldirilgan)
- Sana tanla
- Bron yaratilgach **online xabari** kelishi kerak: "navbat #N"

### 4. Webapp test
- Profilim sahifa
- Yangi bronlarda **rejim badge** ko'rinadi
- Live bronda "kassadan navbat oling"
- Online bronda "to'g'ridan kabinetga"

### Yakuniy commit:
bash
git add .
git commit -m "feat: queue mode system phase 1 — live + online + slot disabled, full stack integration"
git push
`

---

## ⚠️Hech narsa o'chirilmaydiarsa o'chirilmaydi**
   - Mavjud `requiresSlot` ustuni saqlanadi (Bosqich 2 da hal qilamiz)
   - Mavjud bronlar tegilmaydi
   - Mavjud kod patIdempotent migrationempotent migration**
 yangi ustunlart **yangi ustunlar** qo'shadi
   - Mavjud ma'lumotlar avtomatik default qiymat oladi
   - TypeScript strict*TypeScript strict**
   - QueueMode tipi har joyda aniq berilishi
   - `any` ishlatish taqiqlangan
   - Prisma Client avtomatik tyDefault qiymat — `'online'`iymat — `'online'`**
   - Mavjud xulq-atvor saqlanadi
   - Hech narsa avtomatik buzilmaydi
   - Admin xohlaSlot disabled5. **Slot disabled**
   - UI da ko'rinadi, lekin disabled
   - DB da qiymat saqlanishi mumkin lekin bot/web handle qilmaydi
   - Bosqich 2 da to'liMavjud konvensiyalarvjud konvensiyalar**
   - `requireAuth(req)`, `ok()`, `error()` helpers ishlatilsin
   - HttpOnly cookie + credentials saqlansin
   - Telegram webhook secrAudit login

7. **Audit log**
   - Yangi ustunlar avtomatik audit_logs ga yoziladi (mavjud trigger)
   - Admin rejim o'zgartirsa, log paydo bo'ladi
   8. Test build
   - npm run build — TypeScript xato bermasligi shart
   - Vercel deploy READY bo'lishi kerak

---

## 📋 KETMA-KETLIK

### Qadam 1: Schema (Bosqich 1.1)
1. prisma/schema.prisma ga QueueMode enum + ustunlar qo'sh
2. npx prisma migrate dev --name add_queue_mode_system
3. Verifikatsiya (SQL query)
4. Commit

### Qadam 2: Backend (Bosqich 1.2)
1. /api/admin/doctors GET — services bilan queueMode
2. /api/admin/doctors/[id] PATCH — serviceQueueModes
3. /api/services GET — public, doctors bilan queueMode
4. /api/book POST — queueMode logic
5. Commit

### Qadam 3: Admin UI (Bosqich 1.3)
1. QueueModeSelector komponent yarat
2. DoctorCard'ga integratsiya
3. Save tugmasi va API chaqiruv
4. Commit

### Qadam 4: Bot (Bosqich 1.4)
1. Tasdiqlash xabari — rejim bo'yicha farqlash
2. Commit

### Qadam 5: Webapp (Bosqich 1.5)
1. Profilim — rejim badge
2. Booking flow — rejim info
3. /api/webapp/appointments queueMode ham qaytaradi
4. Commit

### Qadam 6: Test (Bosqich 1.6)
1. DB tekshirish
2. Admin panel test
3. Bot test (live + online)
4. Webapp test
5. Yakuniy push

---

## 🚀 BOSHLA

Hozir Bosqich 1.1 — schema o'zgarishi bilan boshla. Migration tugagach foydalanuvchiga "Schema tayyor, Bosqich 1.2 (backend) ga o'tamizmi?" deb so'ra.

Har bosqichdan keyin alohida commit qil va foydalanuvchidan tasdiq olish kerak.

Vaqt tezligi muhim emas — sifat va to'g'ri ishlash muhim.