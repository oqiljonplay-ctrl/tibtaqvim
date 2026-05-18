# 🎯 VAZIFA: Webapp Profilim sahifasini qayta dizayn qilish — Shifokor foto + tag-matag tugmalar

## LOYIHA KONTEKSTI

Stack: Next.js 14 (App Router) + Prisma + Supabase + Vercel + Telegram WebApp SDK
Repo: oqiljonplay-ctrl/tibtaqvim
Production: https://tibtaqvim.vercel.app

Hozirgi holat:
- Service-Doctor M2M ishlamoqda
- DoctorCard komponent mavjud (src/components/DoctorCard.tsx)
- Webapp service list sahifasida shifokor foto ishlatilmoqda
- Profilim sahifasi (bronlar ro'yxati) hali eski dizaynda — faqat service emoji ko'rinadi
- DB toza — barcha eski bronlar o'chirilgan, yangi bronlar doctorId bilan kelishi mumkin

## MAQSAD — Aniq dizayn

Profilim sahifasidagi har bron kartochkasini quyidagicha qayta dizaynlash:

### Mokup:
┌─────────────────────────────────────────────┐
│  🏥  Kardiolog qabuli                        │  ← Service emoji + nom (yuqorida, eski joy)
│      15-may, 2026                            │  ← Sana
│                                              │
│              Navbat raqami                   │  ← Navbat blok markazda
│                    #1                        │
│                                              │
│  ┌──────┐                                    │
│  │      │              ┌──────────────────┐  │
│  │ 96px │              │    Kutilmoqda    │  │  ← Status badge
│  │      │              └──────────────────┘  │     (eski "Kutilmoqda" pill)
│  └──────┘                                    │
│                        ┌──────────────────┐  │
│   Shifokor foto         │ 🔄 Qayta bron    │  │  ← Tag-matag (vertikal)
│   chap pastda           └──────────────────┘  │     o'ng tomonda
│   96x96 piksel                                │
│                        ┌──────────────────┐  │
│                        │ ❌ Bekor qilish  │  │
│                        └──────────────────┘  │
└─────────────────────────────────────────────┘
### Foydalanuvchi talab qilgan tushuntirish:
> "Emoji va xizmat nomi uz joyida (yuqorida)
> Navbat raqami #1 markazda
> Rasm emoji ostida chapda 96px
> Kutilmoqda, Qayta bron, Bekor qilish — o'ng tomonda tag-matag"

## TEXNIK TAHLIL

### API javob ma'lumotlari
GET /api/webapp/appointments quyidagi ma'lumotlarni qaytaradi (har bron uchun):
- id, queueNumber, status, date
- service.name, service.type
- doctor.id, doctor.firstName, doctor.lastName, doctor.specialty, doctor.photoUrl
- doctor NULL bo'lishi mumkin (diagnostika xizmatlari, M2M bog'lanmagan)

⚠️ MUHIM: Backend API allaqachon doctor ma'lumotlarini qaytaradi (chunki appointments → doctor relation mavjud). Faqat frontend'da ko'rsatish kerak.

Agar API doctor ma'lumotini qaytarmasa — src/app/api/webapp/appointments/route.ts ni tahrirlab include: { doctor: true, service: true } qo'shing.

### Service type bo'yicha emoji mapping
const SERVICE_EMOJI: Record<string, string> = {
  doctor_queue: '🧑‍⚕️',     // Yoki '🩺'
  diagnostic: '🔬',
  home_service: '🏠',
};
Bu mapping src/app/webapp/page.tsx da allaqachon bo'lishi mumkin — qayta yaratish shart emas, mavjudini ishlatish.

### Status emoji mapping
const STATUS_LABEL: Record<string, { text: string; className: string }> = {
  booked: { text: 'Kutilmoqda', className: 'bg-blue-100 text-blue-700' },
  arrived: { text: 'Keldi', className: 'bg-green-100 text-green-700' },
  missed: { text: 'Kelmadi', className: 'bg-orange-100 text-orange-700' },
  cancelled: { text: 'Bekor qilingan', className: 'bg-gray-100 text-gray-700' },
};
---

## IMPLEMENTATION

### Fayl: src/app/webapp/page.tsx (yoki Profilim sahifa qaerda bo'lsa)

1-qadam: Faylni topib, bron kartochkasi mapping qismini toping. 

Hozirgi kod taxminan shunga o'xshash bo'lishi mumkin:
`tsx
{appointments.map(apt => (<div key={apt.id} className="bg-white rounded-lg shadow p-4 mb-3">
    <div className="flex items-start justify-between">
      <div className="flex gap-3">
        <span className="text-2xl">{getServiceEmoji(apt.service.type)}</span>
        <div>
          <h3 className="font-semibold">{apt.service.name}</h3>
          <p className="text-sm text-gray-500">{formatDate(apt.date)}</p>
        </div>
      </div>
      <span className="px-3 py-1 rounded-full ...">{STATUS_LABEL[apt.status].text}</span>
    </div>
    
    {apt.queueNumber && (
      <div className="mt-3 bg-blue-50 rounded-lg p-3 text-center">
        <p className="text-xs text-blue-600">Navbat raqami</p>
        <p className="text-3xl font-bold text-blue-700">#{apt.queueNumber}</p>
      </div>
    )}
    
    <div className="flex gap-2 mt-3">
      <button className="...">❌ Bekor qilish</button>
      <button className="...">🔄 Qayta bron</button>
    </div>
  </div>
))}

**2-qadam:** Yangi dizayn bilan ALMASHTIRING:

tsx
{appointments.map(apt => {
  const serviceEmoji = SERVICE_EMOJI[apt.service.type] || '📋';
  const statusInfo = STATUS_LABEL[apt.status] || STATUS_LABEL.booked;
  const doctor = apt.doctor; // null bo'lishi mumkin
  const fullName = doctor ? ${doctor.lastName} ${doctor.firstName} : null;
  const initials = doctor ? ${doctor.firstName[0]}${doctor.lastName[0]}.toUpperCase() : null;
  
  return (
    <div 
      key={apt.id} 
      className="bg-white rounded-xl shadow-sm p-4 mb-3 border border-gray-100"
    >
      {/* YUQORI QISM: Service emoji + nom + sana (chap), Status badge (o'ng) */}
      <div className="flex items-start gap-3 mb-3">
        <span className="text-3xl flex-shrink-0">{serviceEmoji}</span>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">
            {apt.service.name}
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">{formatDate(apt.date)}</p>
        </div>
      </div>

      {/* MARKAZDA: Navbat raqami (faqat queueNumber bor bo'lsa) */}
      {apt.queueNumber != null && (
        <div className="bg-blue-50 rounded-lg py-3 mb-4 text-center">
          <p className="text-xs text-blue-600 font-medium">Navbat raqami</p>
          <p className="text-4xl font-bold text-blue-700 leading-none mt-1">
            #{apt.queueNumber}
          </p>
        </div>
      )}

      {/* PASTKI QISM: Foto chapda + Status & Tugmalar o'ngda tag-matag */}
      <div className="flex items-start gap-4">
        {/* CHAP: Shifokor foto (96x96) */}
        <div className="flex-shrink-0">
          {doctor?.photoUrl ? (
            <img
              src={doctor.photoUrl}
              alt={fullName || 'Shifokor'}
              className="w-24 h-24 rounded-xl object-cover border border-gray-200"
            />
          ) : doctor ? (
            // Doctor bor, lekin foto yo'q — initials avatar
            <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
              <span className="text-white text-2xl font-semibold">{initials}</span>
            </div>
          ) : (
            // Doctor umuman yo'q (diagnostika xizmati) — placeholder
            <div className="w-24 h-24 rounded-xl bg-gray-100 flex items-center justify-center">
              <span className="text-4xl">{serviceEmoji}</span>
            </div>
          )}
          
          {/* Foto ostida shifokor ismi (agar doctor bo'lsa) */}
          {doctor && (
            <div className="mt-2 text-center">
              <p className="text-xs text-gray-700 font-medium leading-tight">
                {doctor.specialty}
              </p>
              <p className="text-xs text-gray-500 leading-tight mt-0.5">
                {fullName}
              </p>
            </div>
          )}
        </div>
        {/* O'NG: Status badge + Qayta bron + Bekor qilish (tag-matag) */}
        <div className="flex-1 flex flex-col gap-2">
          {/* Status badge */}
          <div className={px-4 py-2 rounded-lg text-center font-medium text-sm ${statusInfo.className}}>
            {statusInfo.text}
          </div>
          
          {/* Qayta bron */}
          <button
            onClick={() => handleRebook(apt)}
            className="w-full px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition"
          >
            <span>🔄</span>
            <span>Qayta bron</span>
          </button>
          
          {/* Bekor qilish (faqat booked status uchun) */}
          {apt.status === 'booked' && (
            <button
              onClick={() => handleCancel(apt)}
              className="w-full px-4 py-2.5 border border-red-200 hover:bg-red-50 text-red-600 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition"
            >
              <span>❌</span>
              <span>Bekor qilish</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
})}

### KRITIK SHARTLAR

#### 1. **Backend API tekshirish**
`src/app/api/webapp/appointments/route.ts` ni o'qing. Agar Prisma query'da doctor relation include qilinmagan bo'lsa, qo'shing:

typescript
const appointments = await prisma.appointment.findMany({
  where: { userId: user.id },
  include: {
    service: {
      select: { id: true, name: true, type: true, price: true }
    },
    doctor: {  // ⚠️ MUHIM — qo'shing agar yo'q bo'lsa
      select: { 
        id: true, 
        firstName: true, 
        lastName: true, 
        specialty: true, 
        photoUrl: true 
      }
    }
  },
  orderBy: { createdAt: 'desc' }
});

#### 2. **TypeScript tip**
Appointment type'iga `doctor` field qo'shilishi kerak:
typescript
interface Appointment {
  id: string;
  queueNumber: number | null;
  status: 'booked' | 'arrived' | 'missed' | 'cancelled';
  date: string;
  service: {
    id: string;
    name: string;
    type: 'doctor_queue' | 'diagnostic' | 'home_service';
  };
  doctor: {              // ← QO'SHISH
    id: string;
    firstName: string;
    lastName: string;
    specialty: string;
    photoUrl: string | null;
  } | null;              // ← null bo'lishi mumkin
}
`

Mavjud handlerlar saqlanadilanadi**
`handleRebook(apt)` va `handleCancel(apt)` mavjud —tegmaslikmaslik**. Faqat ko'rinishni o'zgartiramiz.

Mavjud helper funksiyalariyalar**
`getServiceEmoji()`, `formatDate()`, `SERVICE_EMOJI`, `STATUS_LABEL` — agar mavjud bo'lsa, ulardan foydalaning. Yo'q bo'lsa — yuqoridagi mapping'larni qo'shing.

Boshqa joylarga tegmaslikmaslik**
- Service list sahifasi (yangi bron qilish) — tegilmaydi
- Admin paneli — tegilmaydi
- DoctorCard komponent — tegilmaydi
Profilim sahifasidagi appointment kartochkasichkasi** o'zgaradi

---

## DESIGN TOKENS (Tailwind)

| Element | Class |
|---|---|
| Kartochka | `bg-white rounded-xl shadow-sm p-4 mb-3 border border-gray-100` |
| Service emoji | `text-3xl` (~32px) |
| Service nom | `font-semibold text-gray-900` |
| Sana | `text-sm text-gray-500` |
| Navbat blok | `bg-blue-50 rounded-lg py-3 mb-4` |
| Navbat raqami | `text-4xl font-bold text-blue-700` |
| Foto | `w-24 h-24 rounded-xl object-cover` (96px) |
| Initials avatar | `bg-gradient-to-br from-blue-400 to-indigo-500` |
| Placeholder (doctor yo'q) | `bg-gray-100` |
| Status badge | `px-4 py-2 rounded-lg text-center` |
| Qayta bron tugma | `bg-blue-50 hover:bg-blue-100 text-blue-700` |
| Bekor qilish tugma | `border border-red-200 hover:bg-red-50 text-red-600` |

---

## ⚠️ MUHIM QOIDAAniqlik birinchi:inchi:** Avval `src/app/webapp/page.tsx` ni o'qib, hozirgi appointment kartochkasi qaerdaligini toping
2. Backend tekshirish: Doctor ma'lumotlari API'dan kelyaptimi? Yo'q bo'lsa — Prisma query'ni yangilang
3. Hech narsa o'chirmaslik: Mavjud handleRebook, handleCancel, SERVICE_EMOJI, helper'lar — saqlanadi
4. TypeScript strict: any ishlatmaslik, doctor null bo'lishi mumkinligini hisobga olish
5. Test: npm run build xato bermasligi shart
6. Mobile birinchi: 96px foto small ekranda ham yaxshi ko'rinishi kerak

---

## 📋 BAJARISH TARTIBI

### Qadam 1 — Diagnostika
# Profilim sahifasini topish
cat src/app/webapp/page.tsx | head -100
# yoki
grep -r "appointments" src/app/webapp/ --include="*.tsx"
### Qadam 2 — Backend tekshirish
src/app/api/webapp/appointments/route.ts ni o'qib, doctor include borligini tasdiqla. Yo'q bo'lsa qo'sh.

### Qadam 3 — Frontend tahrir
Topilgan faylda appointment kartochkasi mapping qismini yuqoridagi yangi dizayn bilan almashtir.

### Qadam 4 — Tipni yangilash
Mavjud Appointment interface/type'iga doctor: { ... } | null qo'sh.

### Qadam 5 — Build test
npm run build
### Qadam 6 — Commit + push
git add .
git commit -m "feat(webapp): profilim doctor photo (96px) + vertical action buttons"
git push
### Qadam 7 — Foydalanuvchiga xabar
"Tuzatildi. Production deploy bo'lgach Telegram'da Profilim sahifasini ochib tekshiring:
1. Yangi bronlarda shifokor foto (96px) chap pastda ko'rinadi
2. Kutilmoqda, Qayta bron, Bekor qilish — o'ng tomonda vertikal (tag-matag)
3. Navbat raqami markazda
4. Diagnostika xizmatlarida (Qon tahlili, EKG) foto yo'q bo'lsa service emoji placeholder ko'rinadi"

---

## 🚀 BOSHLA

1. src/app/webapp/page.tsx ni o'qib chiq (yoki Profilim sahifasi qaerda bo'lsa)
2. Hozirgi appointment kartochkasi qaerdaligini top
3. Backend API doctor ma'lumotini qaytarayotganini tekshir
4. Yangi dizayn bilan almashtir
5. Build qil, commit, push