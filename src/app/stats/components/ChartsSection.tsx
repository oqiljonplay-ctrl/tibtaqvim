"use client";
import { useState, useEffect, useCallback } from "react";
import DateRangeFilter from "./DateRangeFilter";
import ChartCard from "./ChartCard";
import DailyBookingsChart from "./DailyBookingsChart";
import DailyRevenueChart from "./DailyRevenueChart";
import ServicesDonutChart from "./ServicesDonutChart";
import StatusDonutChart from "./StatusDonutChart";
import DoctorsBarChart from "./DoctorsBarChart";
import HoursBarChart from "./HoursBarChart";
import DiscountStats from "@/components/stats/DiscountStats";

type Range = 7 | 14 | 30 | 90;

interface DailyPoint   { date: string; label: string; count: number }
interface RevenuePoint { date: string; label: string; revenue: number }
interface BreakdownItem { id: string; name: string; value: number; color?: string }
interface HourlyPoint  { hour: number; label: string; count: number }

interface ChartsData {
  range: Range;
  startDate: string;
  endDate: string;
  daily: DailyPoint[];
  revenue: RevenuePoint[];
  services: BreakdownItem[];
  statuses: BreakdownItem[];
  doctors: BreakdownItem[];
  hours: HourlyPoint[];
}

export default function ChartsSection() {
  const [range, setRange] = useState<Range>(30);
  const [data, setData] = useState<ChartsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const fetchCharts = useCallback(async (r: Range) => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/stats/charts?range=${r}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = await res.json();
      if (!json.success) {
        setErr(json.error?.message ?? "Ma'lumot yuklanmadi");
        return;
      }
      setData(json.data as ChartsData);
    } catch {
      setErr("Server bilan bog'lanishda xato");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCharts(range);
  }, [range, fetchCharts]);

  if (err) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
        ⚠️ {err}
        <button
          onClick={() => fetchCharts(range)}
          className="ml-2 underline hover:no-underline"
        >
          Qayta urinish
        </button>
      </div>
    );
  }

  const hasData = data !== null;
  const totalBookings = data?.daily.reduce((s, d) => s + d.count, 0) ?? 0;

  return (
    <div className="space-y-4">
      {/* Sarlavha + filter */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-800">
            📊 Grafiklar va tahlillar
          </h2>
          {data && (
            <p className="text-xs text-gray-500 mt-0.5">
              {data.startDate} dan {data.endDate} gacha · Jami {totalBookings} bron
            </p>
          )}
        </div>
        <DateRangeFilter value={range} onChange={setRange} disabled={loading} />
      </div>

      {/* Grafiklar grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* 1. Kunlik bronlar */}
        <ChartCard
          title="Kunlik bronlar trendi"
          subtitle="Yangi bronlar har kun"
          icon="📈"
          loading={loading}
          empty={hasData && totalBookings === 0}
          emptyMessage="Bu davrda bronlar yo'q"
        >
          {data && <DailyBookingsChart data={data.daily} />}
        </ChartCard>

        {/* 2. Kunlik daromad */}
        <ChartCard
          title="Kunlik daromad"
          subtitle="Kassada to'langan to'lovlar (so'm)"
          icon="💰"
          loading={loading}
          empty={hasData && data.revenue.every((r) => r.revenue === 0)}
          emptyMessage="Bu davrda daromad yo'q"
        >
          {data && <DailyRevenueChart data={data.revenue} />}
        </ChartCard>

        {/* 3. Xizmatlar */}
        <ChartCard
          title="Xizmatlar taqsimoti"
          subtitle="Qaysi xizmat ko'p so'raldi"
          icon="🥧"
          loading={loading}
          empty={hasData && data.services.length === 0}
          emptyMessage="Bu davrda xizmat ishlatilmagan"
        >
          {data && <ServicesDonutChart data={data.services} />}
        </ChartCard>

        {/* 4. Status */}
        <ChartCard
          title="Status taqsimoti"
          subtitle="Bron holatlari (konversiya)"
          icon="✅"
          loading={loading}
          empty={hasData && data.statuses.length === 0}
          emptyMessage="Ma'lumot yo'q"
        >
          {data && <StatusDonutChart data={data.statuses} />}
        </ChartCard>

        {/* 5. Shifokorlar — full width (vertical bar) */}
        <ChartCard
          title="Shifokorlar bo'yicha"
          subtitle="Eng band shifokorlar (TOP 10)"
          icon="👨‍⚕️"
          loading={loading}
          empty={hasData && data.doctors.length === 0}
          emptyMessage="Bu davrda shifokorlarga bron yo'q"
          fullWidth
          dynamicHeight
        >
          {data && <DoctorsBarChart data={data.doctors} />}
        </ChartCard>

        {/* 6. Soatlar — full width */}
        <ChartCard
          title="Soatlar bo'yicha"
          subtitle="Kun davomida pik vaqtlar (Asia/Tashkent)"
          icon="⏰"
          loading={loading}
          empty={hasData && data.hours.every((h) => h.count === 0)}
          emptyMessage="Ma'lumot yo'q"
          fullWidth
        >
          {data && <HoursBarChart data={data.hours} />}
        </ChartCard>

      </div>

      {/* Chegirma tahlili — range bilan birga filtirlanadi */}
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-3">Chegirma tahlili</h2>
        <DiscountStats range={range} />
      </div>
    </div>
  );
}
