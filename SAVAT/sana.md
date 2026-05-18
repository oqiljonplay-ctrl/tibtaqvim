# 🎯 VAZIFA: Shifokor dashboard'ga sana tanlash dropdown qo'shish

## LOYIHA KONTEKSTI
Repo: oqiljonplay-ctrl/tibtaqvim  
Stack: Next.js 14 (App Router) + Prisma + Supabase + Vercel  
Production: https://tibtaqvim.vercel.app  
Shifokor dashboard: /doctor yo'lida

## MAVJUD HOLAT

### Qabulxona (Reception) sahifasida — REFERENS DIZAYN
Skrinshotda ko'rinadi: /reception/queue (yoki /reception) sahifasida:
- "Navbat ro'yxati" sarlavhasi
- Sana tanlash dropdown (masalan, "18/05/2026")
- "Oxirgi yangilanish: 08:20..." vaqt yorlig'i
- "Barchasi (2)" filter tugmasi
- Bemorlar ro'yxati

Sana dropdown'ni o'zgartirganda → API /api/appointments?date=YYYY-MM-DD chaqiriladi → ro'yxat yangilanadi.

### Shifokor (Doctor) sahifasida — HOZIRGI HOLAT
Skrinshotda ko'rinadi: /doctor sahifasida:
- "Bugungi navbat" sarlavhasi
- "yakshanba, 17-may · Oxirgi yangilanish: 08:22:41"
- Statistika: "0 Kutmoqda · 0 Keldi"
- Refresh tugmasi
- "Statistika" tugmasi (link to /stats)
- SANA TANLASH YO'Q ❌
- Faqat bugungi bemorlar ko'rinadi

## VAZIFA

Shifokor dashboardiga sana tanlash dropdown qo'shish — xuddi qabulxonadagi kabi.

### Talablar:
1. Sana dropdown — <input type="date"> yoki dropdown
2. Default — bugungi sana (har sahifa yangilanganda)
3. O'zgartirilganda — API'dan yangi sana bo'yicha bronlar yuklanishi
4. Refresh tugma — shu sanani qayta yuklash
5. Sahifa nomi — "Bugungi navbat" o'rniga "Navbat ro'yxati" (yoki dinamik: "Bugungi navbat" / "Ertangi navbat" / "17-may navbati")
6. Statistika ham tanlangan sanaga moslashishi kerak (Kutmoqda, Keldi raqamlari)

## STRATEGIK QARORLAR

1. Default har doim bugungi sana — sahifa yangilansa, bugungi sanaga qaytadi (state localStorage'da saqlanmaydi)
2. O'tgan kunlar ham ko'rinadi — shifokor tarixiy ma'lumotni ko'ra oladi
3. Kelajak kunlar ham ko'rinadi — shifokor o'zining qabul jadvalini oldindan ko'radi
4. Mavjud "Bugungi navbat" mantiq saqlanadi — faqat endi dinamik (har sana uchun)
5. Faqat tanlangan shifokorning bemorlari — API allaqachon doctorId bo'yicha filtrlaydi (login bo'lgan shifokor)

## TEXNIK TAHLIL

### Mavjud API endpoint
GET /api/appointments — qabulxona allaqachon ishlatadi:
- ?date=YYYY-MM-DD parametri qabul qiladi
- Hozir 200 OK qaytaradi (loglarda ko'rindi)

### Shifokor endpoint
/doctor sahifa ehtimol o'z API'sini ishlatadi yoki /api/appointments ni doctorId filteri bilan ishlatadi. Tekshirish kerak:
- src/app/doctor/page.tsx
- src/app/api/doctor/appointments/route.ts (ehtimol mavjud)

---

# 📋 ISH BOSQICHLARI

## BOSQICH 1 — DIAGNOSTIKA

### Topish kerak bo'lgan fayllar:

# Shifokor dashboard
find src/app/doctor -name "*.tsx"

# Shifokor API
find src/app/api -path "*doctor*" -name "*.ts"

# Qabulxona referens dizayni
find src/app -name "*.tsx" | xargs grep -l "Navbat ro'yxati\|sana tanlash" 2>/dev/null
Tahlil qil:
1. /doctor sahifa qaerda?
2. Hozirgi sana qanday filtrlash mantig'i bor? (new Date().toISOString().split('T')[0] ehtimol)
3. API endpoint qaerda? /api/doctor/appointments yoki /api/appointments?doctorId=...?
4. Qabulxonada sana dropdown qanday ishlangan? — shu pattern'ni nusxalash kerak

Hisobot: Foydalanuvchiga "Topdim: shifokor sahifasi X faylda, qabulxona Y faylda, API Z" deb qisqa ayt.

---

## BOSQICH 2 — FRONTEND: Sana dropdown qo'shish

### Fayl: src/app/doctor/page.tsx (taxminan)

### Hozirgi taxminiy kod:
`tsx
"use client";
import { useState, useEffect } from "react";

export default function DoctorPage() {
  const [appointments, setAppointments] = useState([]);
  const [stats, setStats] = useState({ waiting: 0, arrived: 0 });
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  useEffect(() => {
    fetchAppointments();
  }, []);
  
  const fetchAppointments = async () => {
    const res = await fetch(/api/doctor/appointments?date=${today}, { 
      credentials: 'include' 
    });
    const json = await res.json();
    if (json.success) {
      setAppointments(json.data);
      setLastUpdate(new Date());
      // statistika hisoblash...
    }
  };
  
  return (
    <div>
      <h1>Bugungi navbat</h1>
      <p>{new Date().toLocaleDateString('uz', {...})} · Oxirgi yangilanish: {...}</p>
      {/* ... */}
    </div>
  );
}

### Yangi versiya — sana dropdown bilan:

tsx
"use client";
import { useState, useEffect, useCallback } from "react";

export default function DoctorPage() {
  // ⚠️ BUGUNGI SANA — har sahifa yuklanganda hisoblanadi
  const getToday = () => new Date().toISOString().split('T')[0];
  
  const [selectedDate, setSelectedDate] = useState<string>(getToday());
  const [appointments, setAppointments] = useState<any[]>([]);
  const [stats, setStats] = useState({ waiting: 0, arrived: 0 });
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  
  // ⚠️ SHIFOKOR PANEL APPOINTMENT ENDPOINT — mavjud yo'lni saqla
  const fetchAppointments = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const res = await fetch(/api/doctor/appointments?date=${date}, {
        credentials: 'include',
      });
      const json = await res.json();
      if (json.success) {
        const data = json.data || [];
        setAppointments(data);
        
        // Statistika hisoblash
        const waiting = data.filter((a: any) => a.status === 'booked').length;
        const arrived = data.filter((a: any) => a.status === 'arrived').length;
        setStats({ waiting, arrived });
        
        setLastUpdate(new Date());
      }
    } catch (err) {
      console.error('Appointments yuklashda xato:', err);
    } finally {
      setLoading(false);
    }
  }, []);
  
  // Birinchi yuklanish + sana o'zgarganda qayta yuklash
  useEffect(() => {
    fetchAppointments(selectedDate);
  }, [selectedDate, fetchAppointments]);
  
  // ⚠️ Sana o'zgarganda yangi sana bilan API chaqirish
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
  };
  
  // Refresh tugma
  const handleRefresh = () => {
    fetchAppointments(selectedDate);
  };
  
  // Sana label dinamik
  const isToday = selectedDate === getToday();
  const dateLabel = isToday ? "Bugungi navbat" : "Navbat ro'yxati";
  
  // Format sana o'zbek tilida ko'rsatish uchun
  const formattedDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('uz-UZ', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  
  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">{dateLabel}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {formattedDate}
            {lastUpdate && (
              <span> · Oxirgi yangilanish: {lastUpdate.toLocaleTimeString('uz', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            )}
          </p>
        </div>
        
        {/* Statistika + tugmalar (mavjud joylash saqlanadi) */}
        <div className="flex items-center gap-3">
          <div className="text-center">
            <div className="text-xl font-bold text-amber-600">{stats.waiting}</div>
            <div className="text-xs text-gray-500">Kutmoqda</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-green-600">{stats.arrived}</div>
            <div className="text-xs text-gray-500">Keldi</div>
            </div>
          
          {/* Refresh tugma */}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-2 rounded-md border hover:bg-gray-50 disabled:opacity-50"
            title="Yangilash"
          >
            <span className={loading ? "inline-block animate-spin" : ""}>↻</span>
          </button>
          
          {/* Statistika tugma (mavjud) */}
          <a 
            href="/stats" 
            className="px-3 py-2 bg-purple-600 text-white rounded-md text-sm hover:bg-purple-700"
          >
            📊 Statistika
          </a>
        </div>
      </div>
      
      {/* ⚠️ YANGI: Sana tanlash dropdown */}
      <div className="mb-4 flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700">Sana:</label>
        <input
          type="date"
          value={selectedDate}
          onChange={handleDateChange}
          className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        
        {!isToday && (
          <button
            onClick={() => setSelectedDate(getToday())}
            className="px-3 py-2 text-sm text-blue-600 hover:underline"
          >
            Bugunga qaytish
          </button>
        )}
      </div>
      
      {/* Appointments ro'yxati — mavjud kod saqlanadi */}
      <div className="space-y-2">
        {appointments.length === 0 ? (
          <div className="bg-white rounded-lg p-8 text-center text-gray-400">
            {isToday ? "Bugun qayd yo'q" : ${formattedDate} kuni qayd yo'q}
          </div>
        ) : (
          appointments.map(apt => (
            // Mavjud appointment kartochka render kodi (TEGILMAYDI)
            <div key={apt.id}>...</div>
          ))
        )}
      </div>
    </div>
  );
}

### ⚠️ MUHIM ESLATMALAR

#### 1. Mavjud `localStorage` ishlatmang
Sana **saqlanmasin** — har sahifa yangilanganda bugungi sanaga qaytadi. Bu **foydalanuvchi talab qildi**.

#### 2. Mavjud appointment kartochka rendering TEGILMAYDI
Faqat `appointments` state'i yangilanadi (yangi sana bilan), kartochka komponenti saqlanadi.

#### 3. Mavjud auto-refresh logikasi (agar bor bo'lsa)
Agar sahifa avtomatik har 30 sekundda yangilanadigan bo'lsa, **shu logikani saqla** — lekin endi `selectedDate` bilan ishlasin:

tsx
// Mavjud bo'lsa:
useEffect(() => {
  const interval = setInterval(() => {
    fetchAppointments(selectedDate);
  }, 30000);
  return () => clearInterval(interval);
}, [selectedDate, fetchAppointments]);

#### 4. Statistika tegilmaydi
"Kutmoqda" va "Keldi" raqamlari **tanlangan sana** uchun hisoblanadi. Bu **avtomatik** — chunki `appointments` state shu sana uchun yuklanadi.

#### 5. Statistika sahifaga link
"Statistika" tugmasi `/stats` ga olib boradi. Bu **tegilmaydi**. Lekin agar `/stats` ham sana parametr qabul qilsa, kelajakda link'ga `?date=` qo'shish mumkin (hozir kerak emas).

---

## BOSQICH 3 — BACKEND: `?date=` parametri ishlashini ta'minlash

### Fayl: `src/app/api/doctor/appointments/route.ts` (yoki tegishli)

**Mavjud handler taxminan:**
typescript
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth) return error('Unauthorized', 401);
  if (auth.role !== 'doctor') return error('Forbidden', 403);
  
  // Doctor o'z bemorlarini ko'radi
  const doctorId = await prisma.doctor.findUnique({
    where: { userId: auth.userId },
    select: { id: true },
  });
  
  if (!doctorId) return error('Doctor topilmadi', 404);
  
  // ⚠️ HOZIR: faqat bugungi sana
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const appointments = await prisma.appointment.findMany({
    where: {
      doctorId: doctorId.id,
      date: {
        gte: today,
        lt: tomorrow,
      },
    },
    // ...
  });
  
  return ok(appointments);
}
`

**O'zgartirish — `?date=` parametri qabul qilish:**
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth) return error('Unauthorized', 401);
  if (auth.role !== 'doctor') return error('Forbidden', 403);
  
  const doctor = await prisma.doctor.findFirst({
    where: { userId: auth.userId },
    select: { id: true },
  });
  
  if (!doctor) return error('Doctor topilmadi', 404);
  
  // ⚠️ YANGI: ?date= parametr qabul qilish (default bugungi)
  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get('date'); // "YYYY-MM-DD"
  
  let targetDate: Date;
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    targetDate = new Date(dateParam + 'T00:00:00');
  } else {
    targetDate = new Date();
  }
  targetDate.setHours(0, 0, 0, 0);
  
  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);
  
  const appointments = await prisma.appointment.findMany({
    where: {
      doctorId: doctor.id,
      date: {
        gte: targetDate,
        lt: nextDay,
      },
    },
    include: {
      service: { select: { id: true, name: true, type: true, price: true } },
    },
    orderBy: { queueNumber: 'asc' },
  });
  
  return ok(appointments);
}
⚠️ MUHIM:
- Mavjud include va orderBy ni saqlash (kod o'qib aniq solishtirish)
- Mavjud requireAuth va rol tekshirish tegilmaydi
- Faqat targetDate mantiqi qo'shiladi

#### Agar mavjud kod boshqa shaklda bo'lsa
Reference uchun: /api/appointments (qabulxona ishlatadi) qaerda bo'lsa, xuddi shu pattern'ni nusxalang.

---

## BOSQICH 4 — VERIFIKATSIYA

### 4.1 — Build test
npm run build
TypeScript xato bo'lmasligi shart.

### 4.2 — Lokal test (ixtiyoriy)
npm run dev
- Doctor login qil (+998901111111 / doctor123)
- /doctor ga o't
- Sana dropdown ko'rinishi shart
- Sana o'zgartir → ro'yxat yangilanishi shart
- "Bugunga qaytish" tugma faqat bugungi sana emas bo'lganda ko'rinishi
- Sahifa yangilash (F5) → bugungi sanaga qaytishi shart

### 4.3 — Production deploy
git add .
git commit -m "feat(doctor): date picker dropdown with auto-reset to today on refresh"
git push
### 4.4 — Foydalanuvchiga test ko'rsatma

"Tuzatildi. Deploy bo'lgach test qiling:

1. Doctor sifatida login qiling (+998901111111 / doctor123)
2. /doctor ga o'ting — sana dropdown ko'rinishi shart
3. Boshqa sana tanlang — ro'yxat o'sha sanada qayd qilingan bemorlarni ko'rsatishi shart
4. Statistika ham o'sha sana uchun hisoblanishi shart (Kutmoqda, Keldi)
5. Sahifa yangilash (F5) → avtomatik bugungi sanaga qaytishi shart
6. 'Bugunga qaytish' tugma faqat boshqa sana tanlangan paytda ko'rinadi
7. Refresh tugmasi shu sanani qayta yuklaydi"

---

## ⚠️ MUHIM QOIDALAR

1. Hech narsa o'chirmaslik:
   - Mavjud appointment kartochka render saqlanadi
   - Mavjud auto-refresh interval saqlanadi (agar bor bo'lsa)
   - Mavjud Statistika tugma saqlanadi
   - Mavjud refresh tugma saqlanadi (yoki agar yo'q bo'lsa qo'shiladi)
   - Mavjud auth pattern (requireAuth + role check) tegilmaydi
   - Mavjud Prisma include va orderBy saqlanadi

2. Faqat 2 ta narsa qo'shiladi:
   - Frontend: sana dropdown (<input type="date">)
   - Backend: ?date= parametr qabul qilish

3. Default — har doim bugungi sana:
   - localStorage ishlatmaslik
   - Sessionga saqlamaslik
   - Sahifa yangilanganda bugungi sana

4. TypeScript strict — any ishlatmaslik (state'lar uchun aniq tip)

5. Mavjud Mobile UX: Dropdown ham mobile'da ham yaxshi ko'rinishi shart (<input type="date"> mobile'da native picker ochadi).

---

## 📋 BAJARISH TARTIBI

1. Diagnostika — /doctor sahifa va API endpoint qaerda? Qabulxona referens qanday?
2. Frontend — sana dropdown qo'shish, state mantig'i
3. Backend — ?date= parametr qabul qilish
4. Build — TypeScript xatosiz
5. Commit + push — feat(doctor): date picker dropdown
6. Foydalanuvchiga test ko'rsatma

---

## 🚀 BOSHLA
1. Avval src/app/doctor/page.tsx ni o'qib chiq
2. /api/doctor/appointments/route.ts (yoki ishlatilgan endpoint) ni o'qi
3. Qabulxonadagi referens dizaynni ko'r (src/app/reception/...)
4. Foydalanuvchiga qisqa hisobot ber: "Topdim, X, Y, Z fayllar. Ishni boshlashga ruxsatmi?"
5. Tasdiqdan keyin Bosqich 2-3 ni bajar
6. Build → commit → push