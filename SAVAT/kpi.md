📋 Asosiy reja
Sahifalar va ruxsatlar:
Rol
Sahifa
Ko'radigan ma'lumot
super_admin
/stats
Barcha klinikalar statistikasi
clinic_admin
/stats
Faqat o'z klinikasi
doctor
/stats
Faqat o'z bemorlari va qabullari
receptionist
❌ Ruxsat yo'q
Asosiy sahifaga qaytariladi
Tugma joylashuvi:
Asosiy sahifada (/) yuqori qismda "📊 Statistika" tugmasi — yangi sahifaga olib boradi.
🎨 Sahifa tuzilmasi (/stats)
┌─────────────────────────────────────────────────┐
│  📊 Statistika dashboard       [Davr: oy ▼]      │
│  super_admin: barcha klinikalar                  │
└─────────────────────────────────────────────────┘

┌────────────┬────────────┬────────────┬────────────┐
│ KPI 1      │ KPI 2      │ KPI 3      │ KPI 4      │
└────────────┴────────────┴────────────┴────────────┘
┌────────────┬────────────┬────────────┬────────────┐
│ KPI 5      │ KPI 6      │ KPI 7      │ KPI 8      │
└────────────┴────────────┴────────────┴────────────┘

┌──────────────────────┬──────────────────────────┐
│ 📈 Kunlik trend      │ 🥧 Xizmatlar (pie)       │
│ (line chart 30 kun)  │ (donut)                  │
└──────────────────────┴──────────────────────────┘

┌──────────────────────┬──────────────────────────┐
│ 📊 Doktor band'ligi  │ ⏰ Soatlar bo'yicha      │
│ (bar chart)          │ (bar chart)              │
└──────────────────────┴──────────────────────────┘

┌─────────────────────────────────────────────────┐
│ 🗺 Hudud taqsimoti (uyda bemor ko'rish)         │
│ (Yandex iframe + ro'yxat)                        │
└─────────────────────────────────────────────────┘
🛠️ Texnik tuzilma (yangi fayllar)
Backend (API):
Fayl
Vazifasi
src/app/api/stats/route.ts
Asosiy stats endpoint (KPI + grafiklar)
src/lib/stats/queries.ts
SQL aggregate funksiyalari
src/lib/stats/access.ts
Rol bo'yicha filter mantiqi
Frontend (sahifa va komponentlar):
Fayl
Vazifasi
src/app/stats/page.tsx
Asosiy sahifa (server component)
src/components/stats/StatsClient.tsx
Client wrapper (data fetching)
src/components/stats/KpiCards.tsx
8 ta KPI kartochka
src/components/stats/DailyTrendChart.tsx
30 kunlik chiziqli grafik
src/components/stats/ServicesPieChart.tsx
Xizmatlar donut
src/components/stats/DoctorsBarChart.tsx
Doktor bar chart
src/components/stats/HoursBarChart.tsx
Soatlar bar chart
src/components/stats/RegionsList.tsx
Hudud ro'yxati + xarita
src/components/stats/PeriodSelector.tsx
Davr tanlash (kun/hafta/oy/yil)
Mavjud asosiy sahifa
"📊 Statistika" tugmasi qo'shish
Kutubxona:
Recharts — chiroyli, responsive, Next.js bilan mos
npm install recharts
🧮 KPI metrikalari (8 ta)
№
KPI
Hisoblash
Rang
1
Bugungi bron'lar
COUNT WHERE date = today
🔵 Ko'k
2
Bu hafta bron'lar
COUNT WHERE date >= week_start + o'tgan hafta bilan %
🟢 Yashil
3
Bu oy bron'lar
COUNT WHERE date >= month_start + o'tgan oy bilan %
🟣 Bin.
4
Bu oy daromad
SUM(service.price) WHERE status='arrived'
💚 To'q yashil
5
Yangi bemorlar (oy)
COUNT users WHERE createdAt >= month_start
🟡 Sariq
6
Aktiv bemorlar
COUNT DISTINCT users WITH bron oy ichida
🟠 To'q sariq
7
Konversiya
arrived / (arrived + missed) foizi
✅ Yashil
8
Aktiv jonli
COUNT WHERE liveStatus='active'
🔴 Pulsatsion
🚦 Boshlash — eng katta savol
Bu juda katta funksiya. 3 deploy orqali bo'lib qilamizmi yoki bitta katta bo'lib? Katta deploy'da bug topish qiyinroq.
Mening tavsiyam: 3 bosqichli deploy, har biri ishlashini test qilish.
Bosqich 1: 🟢 KPI + asosiy sahifa
API + KPI hisoblash
Sahifa tuzilmasi + 8 ta kartochka
Asosiy sahifaga tugma
Ruxsat tekshiruvi
Test qilamiz — KPI'lar to'g'ri chiqyaptimi
Bosqich 2: 📊 4 ta grafik
Recharts kutubxona o'rnatish
Kunlik trend, xizmatlar, doktorlar, soatlar
Test — grafiklar to'g'ri ko'rinadimi
Bosqich 3: 🗺 Hudud va davr tanlash
Hudud bo'yicha (uyda bemor ko'rish)
Davr tanlash (kun/hafta/oy/yil filter)
Eksport (CSV, kelajak uchun)
❓ Davom etishdan oldin oxirgi savol
Tanlasangiz, men birinchi bosqich uchun aniq:
SQL queries (men tayyor beraman)
API endpoint kodi
KPI komponenti kodi
Sahifa tuzilmasi
Tugma joylashuvi
Hammasini "tegmaslik" printsipi bilan — mavjud kodga aralashtirmasdan, faqat yangi fayllar yaratamiz.
Bosqich 1 — KPI + asosiy sahifadan boshlaymiz.
Mavjud kodga TEGMAYMIZ — faqat yangi fayllar va asosiy sahifaga bitta tugma.
📦 BOSQICH 1: KPI Dashboard
📂 FAYL 1: src/lib/stats/access.ts (yangi — ruxsat va filter)
// src/lib/stats/access.ts
// Rol bo'yicha statistika filter va ruxsat mantiqi

export type StatsRole = 'super_admin' | 'clinic_admin' | 'doctor' | 'denied';

export interface StatsScope {
  role: StatsRole;
  clinicId: string | null;  // null = barcha klinikalar (super_admin)
  doctorId: string | null;  // doctor bo'lsa, faqat o'z bemorlari
}

/**
 * User role'iga qarab statistika ko'rish ruxsatini va filter scope'ini aniqlaydi.
 */
export function getStatsScope(user: {
  role: string;
  clinicId?: string | null;
  doctorId?: string | null;
}): StatsScope {
  switch (user.role) {
    case 'super_admin':
      return { role: 'super_admin', clinicId: null, doctorId: null };
    case 'clinic_admin':
      return { 
        role: 'clinic_admin', 
        clinicId: user.clinicId ?? null, 
        doctorId: null 
      };
    case 'doctor':
      return { 
        role: 'doctor', 
        clinicId: user.clinicId ?? null, 
        doctorId: user.doctorId ?? null 
      };
    default:
      return { role: 'denied', clinicId: null, doctorId: null };
  }
}

/**
 * Prisma where filter — scope asosida appointments uchun
 */
export function buildAppointmentsWhere(scope: StatsScope) {
  const where: Record<string, any> = {};
  
  if (scope.role === 'denied') {
    // Hech narsa qaytarmaslik uchun imkonsiz shart
    where.id = 'no_access';
    return where;
  }
  
  if (scope.clinicId) {
    where.clinicId = scope.clinicId;
  }
  
  if (scope.doctorId) {
    where.doctorId = scope.doctorId;
  }
  
  return where;
}
📂 FAYL 2: src/lib/stats/queries.ts (yangi — KPI hisoblash)
// src/lib/stats/queries.ts
// Statistika uchun aggregate query'lar

import { prisma } from '@/lib/prisma';
import { StatsScope, buildAppointmentsWhere } from './access';

export interface KpiData {
  todayBookings: number;
  yesterdayBookings: number;
  
  thisWeekBookings: number;
  lastWeekBookings: number;
  
  thisMonthBookings: number;
  lastMonthBookings: number;
  
  thisMonthRevenue: number;
  
  newPatientsThisMonth: number;
  activePatients: number;
  
  arrivedCount: number;
  missedCount: number;
  conversionRate: number; // 0..100
  
  activeLiveCount: number;
}

/**
 * Sana yordamchilari (server timezone'da)
 */
function getDateRanges() {
  const now = new Date();
  
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // Hafta — dushanbadan boshlanadi
  const dayOfWeek = today.getDay(); // 0 = yakshanba
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - daysFromMonday);
  
  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(monthStart);
  
  return { 
    today, yesterday, tomorrow, 
    weekStart, lastWeekStart, 
    monthStart, lastMonthStart, lastMonthEnd 
  };
}

export async function fetchKpi(scope: StatsScope): Promise<KpiData> {
  const baseWhere = buildAppointmentsWhere(scope);
  const r = getDateRanges();
  
  // Parallel queries — tezroq
  const [
    todayBookings,
    yesterdayBookings,
    thisWeekBookings,
    lastWeekBookings,
    thisMonthBookings,
    lastMonthBookings,
    revenueAgg,
    newPatients,
    activePatientsResult,
    arrivedCount,
    missedCount,
    activeLiveCount,
  ] = await Promise.all([
    // 1. Bugungi
    prisma.appointment.count({
      where: { ...baseWhere, date: { gte: r.today, lt: r.tomorrow } },
    }),
    // 2. Kechagi (solishtirish uchun)
    prisma.appointment.count({
      where: { ...baseWhere, date: { gte: r.yesterday, lt: r.today } },
    }),
    // 3. Bu hafta
    prisma.appointment.count({
      where: { ...baseWhere, date: { gte: r.weekStart, lt: r.tomorrow } },
    }),
    // 4. O'tgan hafta
    prisma.appointment.count({
      where: { ...baseWhere, date: { gte: r.lastWeekStart, lt: r.weekStart } },
    }),
    // 5. Bu oy
    prisma.appointment.count({
      where: { ...baseWhere, date: { gte: r.monthStart, lt: r.tomorrow } },
    }),
    // 6. O'tgan oy
    prisma.appointment.count({
      where: { ...baseWhere, date: { gte: r.lastMonthStart, lt: r.lastMonthEnd } },
    }),
    // 7. Bu oy daromad — faqat 'arrived' status va xizmat narxi orqali
    prisma.appointment.findMany({
      where: { 
        ...baseWhere, 
        date: { gte: r.monthStart, lt: r.tomorrow },
        status: 'arrived',
      },
      select: {
        service: { select: { price: true } },
      },
    }),
    // 8. Yangi bemorlar (oy ichida ro'yxatdan o'tgan)
    prisma.user.count({
      where: {
        role: 'patient',
        createdAt: { gte: r.monthStart },
        ...(scope.clinicId ? { clinicId: scope.clinicId } : {}),
      },
    }),
    // 9. Aktiv bemorlar (oy ichida bron qilgan UNIQUE userlar)
    prisma.appointment.findMany({
      where: { ...baseWhere, date: { gte: r.monthStart, lt: r.tomorrow } },
      select: { userId: true },
      distinct: ['userId'],
    }),
    // 10. Keldi (oy)
    prisma.appointment.count({
      where: { ...baseWhere, date: { gte: r.monthStart, lt: r.tomorrow }, status: 'arrived' },
      }),
    // 11. Kelmadi (oy)
    prisma.appointment.count({
      where: { ...baseWhere, date: { gte: r.monthStart, lt: r.tomorrow }, status: 'missed' },
    }),
    // 12. Aktiv live
    prisma.appointment.count({
      where: { ...baseWhere, liveStatus: 'active' },
    }),
  ]);
  
  // Daromad hisoblash
  const thisMonthRevenue = revenueAgg.reduce(
    (sum, a) => sum + (a.service?.price ?? 0), 
    0
  );
  
  // Konversiya
  const totalCompleted = arrivedCount + missedCount;
  const conversionRate = totalCompleted > 0 
    ? Math.round((arrivedCount / totalCompleted) * 100) 
    : 0;
  
  return {
    todayBookings,
    yesterdayBookings,
    thisWeekBookings,
    lastWeekBookings,
    thisMonthBookings,
    lastMonthBookings,
    thisMonthRevenue,
    newPatientsThisMonth: newPatients,
    activePatients: activePatientsResult.length,
    arrivedCount,
    missedCount,
    conversionRate,
    activeLiveCount,
  };
}
📂 FAYL 3 (yakuniy): src/app/api/stats/route.ts
// src/app/api/stats/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { getStatsScope } from '@/lib/stats/access';
import { fetchKpi } from '@/lib/stats/queries';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['super_admin', 'clinic_admin', 'doctor'];

export async function GET(req: NextRequest) {
  try {
    // 1) JWT auth
    const auth = requireAuth(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    if (!ALLOWED_ROLES.includes(auth.role)) {
      return NextResponse.json(
        { error: 'Statistika ko\'rishga ruxsat yo\'q' }, 
        { status: 403 }
      );
    }
    
    // 2) Doctor uchun doctorId topish (faqat doctor role'i uchun)
    let doctorId: string | null = null;
    if (auth.role === 'doctor') {
      const doctor = await prisma.doctor.findFirst({
        where: { 
          userId: auth.userId,
          ...(auth.clinicId ? { clinicId: auth.clinicId } : {}),
        },
        select: { id: true },
      });
      doctorId = doctor?.id ?? null;
      
      // Doctor user'ga bog'langan Doctor rec'ord topilmasa — ehtiyot
      if (!doctorId) {
        return NextResponse.json(
          { error: 'Doctor profili topilmadi' }, 
          { status: 403 }
        );
      }
    }
    
    // 3) Scope
    const scope = getStatsScope({ 
      role: auth.role, 
      clinicId: auth.clinicId, 
      doctorId,
    });
    
    if (scope.role === 'denied') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    // 4) KPI hisoblash
    const kpi = await fetchKpi(scope);
    
    return NextResponse.json({
      scope: {
        role: scope.role,
        clinicId: scope.clinicId,
      },
      kpi,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[/api/stats] error:', err);
    return NextResponse.json({ error: 'Server xatosi' }, { status: 500 });
  }
}
📂 FAYL 4: src/components/stats/KpiCards.tsx (yangi)
Tsx
'use client';

import { useEffect, useState } from 'react';

interface KpiData {
  todayBookings: number;
  yesterdayBookings: number;
  thisWeekBookings: number;
  lastWeekBookings: number;
  thisMonthBookings: number;
  lastMonthBookings: number;
  thisMonthRevenue: number;
  newPatientsThisMonth: number;
  activePatients: number;
  arrivedCount: number;
  missedCount: number;
  conversionRate: number;
  activeLiveCount: number;
}

interface ApiResponse {
  scope: { role: string; clinicId: string | null };
  kpi: KpiData;
  generatedAt: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('uz-UZ').format(value) + ' so\'m';
}

function calcDelta(current: number, previous: number): { text: string; positive: boolean } {
  if (previous === 0) {
    return { text: current > 0 ? 'Yangi' : '—', positive: current > 0 };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  return {
    text: pct > 0 ? +${pct}% : ${pct}%,
    positive: pct >= 0,
  };
}

export default function KpiCards() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stats', { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) throw new Error(HTTP ${r.status});
        return r.json();
      })
      .then((d: ApiResponse) => {
        setData(d);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
            <div className="h-3 bg-gray-200 rounded w-2/3 mb-3" />
            <div className="h-7 bg-gray-200 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        ⚠️ Xatolik: {error}
      </div>
    );
  }

  if (!data) return null;

  const { kpi } = data;
  const todayDelta = calcDelta(kpi.todayBookings, kpi.yesterdayBookings);
  const weekDelta = calcDelta(kpi.thisWeekBookings, kpi.lastWeekBookings);
  const monthDelta = calcDelta(kpi.thisMonthBookings, kpi.lastMonthBookings);

  const cards = [
    {
      label: 'Bugungi bron\'lar',
      value: kpi.todayBookings,
      sub: Kecha: ${kpi.yesterdayBookings},
      delta: todayDelta,
      gradient: 'from-blue-500 to-blue-600',
      icon: '📅',
    },
    {
      label: 'Bu hafta',
      value: kpi.thisWeekBookings,
      sub: O'tgan hafta: ${kpi.lastWeekBookings},
      delta: weekDelta,
      gradient: 'from-emerald-500 to-emerald-600',
      icon: '📊',
    },
    {
      label: 'Bu oy',
      value: kpi.thisMonthBookings,
      sub: O'tgan oy: ${kpi.lastMonthBookings},
      delta: monthDelta,
      gradient: 'from-purple-500 to-purple-600',
      icon: '🗓️',
    },
    {
      label: 'Daromad (oy)',
      value: formatCurrency(kpi.thisMonthRevenue),
      sub: Faqat 'keldi' status,
      gradient: 'from-green-600 to-green-700',
      icon: '💰',
    },
    {
      label: 'Yangi bemorlar (oy)',
      value: kpi.newPatientsThisMonth,
      sub: Yangi ro'yxatdan o'tganlar,
      gradient: 'from-yellow-500 to-yellow-600',
      icon: '🆕',
    },
    {
      label: 'Aktiv bemorlar',
      value: kpi.activePatients,
      sub: Oy ichida bron qilgan,
      gradient: 'from-orange-500 to-orange-600',
      icon: '👥',
    },
    {
      label: 'Konversiya',
      value: ${kpi.conversionRate}%,
      sub: Keldi: ${kpi.arrivedCount} / Kelmadi: ${kpi.missedCount},
      gradient: 'from-teal-500 to-teal-600',
      icon: '✅',
    },
    {
      label: 'Aktiv jonli',
      value: kpi.activeLiveCount,
      sub: kpi.activeLiveCount > 0 ? 'Hozir kuzatilmoqda' : 'Hech kim aktiv emas',
      gradient: kpi.activeLiveCount > 0 ? 'from-rose-500 to-rose-600' : 'from-gray-400 to-gray-500',
      icon: kpi.activeLiveCount > 0 ? '🔴' : '⚪️',
      pulse: kpi.activeLiveCount > 0,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((card, i) => (
        <div
          key={i}
          className="relative overflow-hidden bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition"
        >
          <div className={absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${card.gradient} opacity-10 rounded-bl-full} />
          
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-600 font-medium">{card.label}</span>
            <span className={text-xl ${card.pulse ? 'animate-pulse' : ''}}>{card.icon}</span>
          </div>
          
          <div className="text-2xl font-bold text-gray-900 mb-1">
            {card.value}
          </div>
          
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500 truncate">{card.sub}</span>
            {card.delta && (
              <span className={font-semibold ${card.delta.positive ? 'text-emerald-600' : 'text-red-600'}}>
                {card.delta.text}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
📂 FAYL 5 (yakuniy): src/app/stats/page.tsx
⚠️ Muhim: Sizning loyihada middleware.ts allaqachon JWT tekshiradi va role-based redirect qiladi. Demak /stats sahifasiga avtomatik himoya o'rnatish uchun eng oson yo'l — middleware'ga /stats yo'lini qo'shish.
Lekin chalg'imaslik uchun, sahifa o'zida ham qisqa tekshiruv qilamiz (server component).
// src/app/stats/page.tsx
import KpiCards from '@/components/stats/KpiCards';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ALLOWED_ROLES = ['super_admin', 'clinic_admin', 'doctor'];

export default async function StatsPage() {
  // Server-side auth tekshiruvi
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;
  
  if (!token) {
    redirect('/login');
  }
  
  const payload = verifyToken(token);
  if (!payload) {
    redirect('/login');
  }
  
  if (!ALLOWED_ROLES.includes(payload.role)) {
    // Receptionist va boshqalar — asosiy sahifaga qaytariladi
    redirect('/');
  }
  
  const subtitle = 
    payload.role === 'super_admin' ? 'Barcha klinikalar bo\'yicha' :
    payload.role === 'clinic_admin' ? 'Sizning klinikangiz bo\'yicha' :
    'Sizning bemorlar va qabullar';
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              📊 Statistika
            </h1>
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          </div>
          
          <Link 
            href="/"
            className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm hover:bg-gray-50 transition"
          >
            ← Asosiy sahifa
          </Link>
        </div>

        {/* KPI Section */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            Asosiy ko'rsatkichlar
          </h2>
          <KpiCards />
        </section>

        {/* Keyingi bosqich joyi */}
        <section className="mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">
            📈 Grafiklar va tahlillar — keyingi bosqichda qo'shiladi
          </div>
        </section>
      </div>
    </div>
  );
}
📂 FAYL 6: Asosiy sahifaga 1 ta tugma qo'shish
Asosiy sahifa fayli (taxminan src/app/page.tsx yoki src/app/(dashboard)/page.tsx) — qaysi rolda foydalanuvchi bo'lsa, shu yerga tugma qo'shish kerak.
⚠️ Muhim: Faqat tugma qo'shamiz, mavjud kodni o'zgartirmaymiz.
Misol — sahifaning yuqori qismida (header yoki nav joyida):
import Link from 'next/link';

// Mavjud JSX ichida — qaerda boshqa link/tugmalar bo'lsa, yoniga qo'shing:
<Link 
  href="/stats"
  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-md text-sm font-medium hover:opacity-90 transition shadow-sm"
>
  📊 Statistika
</Link>

⚠️ Tugma faqat ruxsati bor user'larga ko'rinishi kerak. Ya'ni super_admin, clinic_admin, doctor uchun. receptionist uchun yo'q.
Sizning mavjud sahifada user role qanday tekshirilsa, shu shartni qo'llang:
{['super_admin', 'clinic_admin', 'doctor'].includes(currentUser?.role) && (
  <Link href="/stats" className="...">
    📊 Statistika
  </Link>
)}
📋 Sizdan kerak
№
Vazifa
Fayl
1
src/lib/stats/access.ts yangi fayl
yangi
2
src/lib/stats/queries.ts yangi fayl
yangi
3
src/app/api/stats/route.ts yangi endpoint
yangi
4
src/components/stats/KpiCards.tsx yangi komponent
yangi
5
src/app/stats/page.tsx yangi sahifa
yangi
6
Asosiy sahifaga "📊 Statistika" tugmasi
mavjud
7
git push → Vercel deploy
terminal
⚠️ DIQQAT — sizdan kerak ma'lumot
API endpoint'da men placeholder auth ishlatdim:
const userId = req.cookies.get('userId')?.value;
Bu sizning kodingizda boshqacha bo'lishi mumkin. To'g'ri ishlash uchun:
Lokal kompyuteringizda findstr qiling:
findstr /S /I /N "cookies" src\app\api\appointments\*.ts
Yoki:
findstr /S /I /N "getServerSession" src\app\api\*.ts
Mavjud /api/appointments qanday auth tekshirsa — xuddi shuni /api/stats da ham ishlating
Yoki men beraman — shunchaki menga ayting "auth bunday ishlaydi" — men kodga moslayman
🧪 Test sxemasi (deploy bo'lgach)
Doktor sifatida login — 📊 Statistika tugmasi ko'rinishi kerak
Tugmani bosing → /stats sahifasi ochiladi
8 ta KPI kartochka ko'rinishi kerak:
Bugun: 0-1 (5-may bron'lar)
Bu hafta: ~5
Bu oy: ~30
Daromad: faqat 'arrived' status'lardan
Aktiv jonli: 1 (Aliyev valining live'i hali aktiv)
Receptionist sifatida login → tugma ko'rinmasligi kerak
Receptionist agar URL'ni qo'lda yozib /stats'ga kirsa → 403 Forbidden
❓ Boshlaymizmi?
Avvalgi savolga javob bering — mavjud kodda auth qanday ishlaydi (yoki findstr natijasini yuboring). Men /api/stats/route.ts ni mos qilib qaytadan beraman.
Yoki agar siz auth qismini o'zingiz moslayotgan bo'lsangiz, kodni shunchaki olib qo'shing va davom eting.
Tayyor bo'lgach "qildim" deysiz — Vercel deploy va DB'da KPI to'g'ri hisoblanganini tekshiraman.
⚠️ Server component'da verifyToken — bu node runtime'da ishlaydi (jsonwebtoken). auth-edge.ts faqat middleware uchun. Sahifa Node runtime'da render qilinadi, shuning uchun standart verifyToken ishlaydi.
📂 KpiCards client komponentida — auth tekshiruvi ham kerak
Frontend'dan /api/stats chaqirilganda cookie avtomatik yuboriladi, demak alohida header qo'shish kerak emas. Lekin agar Authorization header bilan ishlatish kerak bo'lsa:
// KpiCards.tsx ichida fetch
fetch('/api/stats', { 
  cache: 'no-store',
  credentials: 'include',  // cookie avtomatik yuboriladi (default)
})
Bu credentials: 'include' aslida shart emas — same-origin'da cookie avtomatik. Lekin xavfsizlik uchun aniq qoldirish yaxshi. Yo'qsa avvalgi versiya o'zgartirmasdan ishlaydi.
📋 Yakuniy ish ro'yxati — Bosqich 1
№
Vazifa
Fayl
Holat
1
src/lib/stats/access.ts (yangi fayl)
yangi
⏳ Siz
2
src/lib/stats/queries.ts (yangi fayl)
yangi
⏳ Siz
3
src/app/api/stats/route.ts (yuqorida yakuniy)
yangi
⏳ Siz
4
src/components/stats/KpiCards.tsx (yangi fayl)
yangi
⏳ Siz
5
src/app/stats/page.tsx (yuqorida yakuniy)
yangi
⏳ Siz
6
Asosiy sahifaga "📊 Statistika" tugmasi
mavjud
⏳ Siz
7
(ixtiyoriy) middleware.ts'ga /stats yo'lini qo'shish
mavjud
⚠️ tekshirish
8
git push → Vercel deploy
terminal
⏳ Siz
⚠️ Middleware tekshirish
Sizning middleware.ts'da role-based redirect bor. /stats yo'lini ham hisobga olishi kerak. Bir narsani tekshiring:
findstr /S /I /N "doctor" src\middleware.ts
findstr /S /I /N "matcher" src\middleware.ts
Agar matcher aniq yo'llarni sanab ko'rsatsa (masalan ['/doctor/:path*', '/reception/:path*']), /stats ham qo'shilishi kerak.
Yoki agar barcha autentifikatsiya kerak yo'llar (authenticated)/... group orqali bo'lsa, /stats'ni ham shu group ichiga qo'ying.
Agar middleware umuman aniq matcher ishlatmasa va sahifa o'zida verifyToken qiladigan bo'lsa, qo'shimcha narsa kerak emas — yuqoridagi page.tsx o'zi himoya qiladi.
🧪 Test sxemasi (deploy bo'lgach)
Test
Kim
Kutilgan natija
1
Receptionist
Asosiy sahifada tugma yo'q, URL'ga qo'lda kirsa → asosiy sahifaga redirect
2
Doctor
Tugma ko'rinadi → /stats ochiladi → faqat o'z bemorlari KPI
3
Clinic admin
Tugma ko'rinadi → o'z klinikasi statistikasi
4
Super admin
Tugma ko'rinadi → barcha klinikalar
5
Auth yo'q
/stats → /login redirect
📊 KPI tasdiqlash
Deploy bo'lgach men DB'da hisoblangan qiymatlar to'g'riligini tekshiraman. Hozir taxminiy:
KPI
Bugun (taxminan)
Bugungi bron'lar
1-2
Bu hafta
~5
Bu oy
~30+
Aktiv bemorlar
~10
Aktiv jonli
1 (Aliyev vali)
Konversiya
hisoblanadi
❓ Boshlaymizmi?
Quyidagi 4 ta yangi fayl + 1 ta mavjudga tugma:
src/lib/stats/access.ts
src/lib/stats/queries.ts
src/app/api/stats/route.ts
src/components/stats/KpiCards.tsx
src/app/stats/page.tsx
Asosiy sahifaga tugma
VS Code'da boshlang. Tayyor bo'lgach "qildim" deysiz — Vercel deploy va DB tomondan KPI'lar to'g'ri hisoblanganini tekshiraman.
Boshlang!