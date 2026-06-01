"use client";

import { useEffect, useState } from "react";

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
  return new Intl.NumberFormat("uz-UZ").format(value) + " so'm";
}

function calcDelta(current: number, previous: number): { text: string; positive: boolean } {
  if (previous === 0) {
    return { text: current > 0 ? "Yangi" : "—", positive: current > 0 };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  return { text: pct > 0 ? `+${pct}%` : `${pct}%`, positive: pct >= 0 };
}

export default function KpiCards() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d: ApiResponse) => { setData(d); setError(null); })
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
  const weekDelta  = calcDelta(kpi.thisWeekBookings, kpi.lastWeekBookings);
  const monthDelta = calcDelta(kpi.thisMonthBookings, kpi.lastMonthBookings);

  const cards = [
    {
      label: "Bugungi bron'lar",
      value: kpi.todayBookings,
      sub: `Kecha: ${kpi.yesterdayBookings}`,
      delta: todayDelta,
      gradient: "from-blue-500 to-blue-600",
      icon: "📅",
    },
    {
      label: "Bu hafta",
      value: kpi.thisWeekBookings,
      sub: `O'tgan hafta: ${kpi.lastWeekBookings}`,
      delta: weekDelta,
      gradient: "from-emerald-500 to-emerald-600",
      icon: "📊",
    },
    {
      label: "Bu oy",
      value: kpi.thisMonthBookings,
      sub: `O'tgan oy: ${kpi.lastMonthBookings}`,
      delta: monthDelta,
      gradient: "from-purple-500 to-purple-600",
      icon: "🗓️",
    },
    {
      label: "Daromad (oy)",
      value: formatCurrency(kpi.thisMonthRevenue),
      sub: "Kassada to'langan (bu oy)",
      gradient: "from-green-600 to-green-700",
      icon: "💰",
    },
    {
      label: "Yangi bemorlar (oy)",
      value: kpi.newPatientsThisMonth,
      sub: "Yangi ro'yxatdan o'tganlar",
      gradient: "from-yellow-500 to-yellow-600",
      icon: "🆕",
    },
    {
      label: "Aktiv bemorlar",
      value: kpi.activePatients,
      sub: "Oy ichida bron qilgan",
      gradient: "from-orange-500 to-orange-600",
      icon: "👥",
    },
    {
      label: "Konversiya",
      value: `${kpi.conversionRate}%`,
      sub: `Keldi: ${kpi.arrivedCount} / Kelmadi: ${kpi.missedCount}`,
      gradient: "from-teal-500 to-teal-600",
      icon: "✅",
    },
    {
      label: "Aktiv jonli",
      value: kpi.activeLiveCount,
      sub: kpi.activeLiveCount > 0 ? "Hozir kuzatilmoqda" : "Hech kim aktiv emas",
      gradient: kpi.activeLiveCount > 0 ? "from-rose-500 to-rose-600" : "from-gray-400 to-gray-500",
      icon: kpi.activeLiveCount > 0 ? "🔴" : "⚪️",
      pulse: kpi.activeLiveCount > 0,
    },
  ] as const;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((card, i) => (
        <div
          key={i}
          className="relative overflow-hidden bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition"
        >
          <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${card.gradient} opacity-10 rounded-bl-full`} />
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-600 font-medium">{card.label}</span>
            <span className={`text-xl ${"pulse" in card && card.pulse ? "animate-pulse" : ""}`}>{card.icon}</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 mb-1">{card.value}</div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500 truncate">{card.sub}</span>
            {"delta" in card && card.delta && (
              <span className={`font-semibold ${card.delta.positive ? "text-emerald-600" : "text-red-600"}`}>
                {card.delta.text}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
