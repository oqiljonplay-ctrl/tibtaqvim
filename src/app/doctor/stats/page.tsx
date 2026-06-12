"use client";
import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { StarRating } from "@/components/webapp/StarRating";

interface ClinicInfo { id: string; name: string; stintCount: number }

interface RatingBreakdown {
  compositeRating:  number | null;
  ratingCount:      number;
  patientScore:     number | null;
  returnRate:       number | null;
  arrivedRate:      number | null;
  activityScore:    number | null;
  lastUpdatedAt:    string | null;
}

interface StatusItem  { status: string; count: number }
interface ServiceItem { name: string; count: number }
interface MonthItem   { month: string; appointments: number; ratingCount: number; avgStars: number | null }

interface StatsData {
  clinics: ClinicInfo[];
  ratingBreakdown: RatingBreakdown | null;
  totalAppointments: number;
  uniquePatients: number;
  returnRate: number | null;
  statusBreakdown: StatusItem[];
  workedDays: number;
  topServices: ServiceItem[];
  newPatients: number;
  monthlyDynamics: MonthItem[];
  ratings: { count: number; avg: number | null };
}

const STATUS_COLORS: Record<string, string> = {
  arrived:   "#22c55e",
  missed:    "#f59e0b",
  cancelled: "#ef4444",
  expired:   "#94a3b8",
  booked:    "#3b82f6",
};
const STATUS_LABELS: Record<string, string> = {
  arrived:   "Keldi",
  missed:    "Kelmadi",
  cancelled: "Bekor",
  expired:   "Muddati o'tgan",
  booked:    "Navbatda",
};

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-2xl font-bold text-gray-900">{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  );
}

function pct(v: number | null) {
  return v !== null ? `${(v * 100).toFixed(1)}%` : "—";
}

export default function DoctorStatsPage() {
  const [stats,     setStats]     = useState<StatsData | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [combined,  setCombined]  = useState(false);
  const [clinicId,  setClinicId]  = useState<string | null>(null);

  function fetchStats(cId: string | null, comb: boolean) {
    setLoading(true);
    setError(null);
    const qs = comb ? "combined=true" : cId ? `clinicId=${cId}` : "";
    fetch(`/api/doctor/stats${qs ? "?" + qs : ""}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) {
          setStats(res.data);
          // Auto-select current clinic on first load
          if (cId === null && !comb && res.data.clinics?.length > 0) {
            setClinicId(res.data.clinics[0].id);
          }
        } else {
          setError(res.error?.message ?? "Xatolik");
        }
      })
      .catch(() => setError("Tarmoq xatosi"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchStats(null, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectClinic(id: string) {
    setClinicId(id);
    setCombined(false);
    fetchStats(id, false);
  }

  function selectCombined() {
    setCombined(true);
    setClinicId(null);
    fetchStats(null, true);
  }

  const rb = stats?.ratingBreakdown ?? null;

  const pieData = (stats?.statusBreakdown ?? [])
    .filter((s) => s.count > 0)
    .map((s) => ({
      id:    s.status,
      name:  STATUS_LABELS[s.status] ?? s.status,
      value: s.count,
      color: STATUS_COLORS[s.status] ?? "#9ca3af",
    }));

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header + composite rating */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Mening statistikam</h1>
        {rb && rb.compositeRating !== null && (
          <div className="mt-3 bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <StarRating value={rb.compositeRating} readOnly size={20} />
              <span className="text-2xl font-bold text-gray-900">{rb.compositeRating.toFixed(1)}</span>
              <span className="text-sm text-gray-500">({rb.ratingCount} baho)</span>
            </div>
            {/* Omillar mini-jadvali */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div className="bg-gray-50 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-500 mb-0.5">Bemor bahosi</div>
                <div className="font-semibold text-gray-800">
                  {rb.patientScore !== null ? rb.patientScore.toFixed(2) : "—"}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-500 mb-0.5">Qaytib kelish</div>
                <div className="font-semibold text-gray-800">{pct(rb.returnRate)}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-500 mb-0.5">Keldi darajasi</div>
                <div className="font-semibold text-gray-800">{pct(rb.arrivedRate)}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-2 text-center">
                <div className="text-xs text-gray-500 mb-0.5">Faollik</div>
                <div className="font-semibold text-gray-800">{pct(rb.activityScore)}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Clinic tabs */}
      {stats && stats.clinics.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {stats.clinics.map((c) => {
            const active = !combined && clinicId === c.id;
            return (
              <button
                key={c.id}
                onClick={() => selectClinic(c.id)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                  active
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-200 hover:border-blue-400"
                }`}
              >
                {c.name}
              </button>
            );
          })}
          {stats.clinics.length > 1 && (
            <button
              onClick={selectCombined}
              className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                combined
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-700 border-gray-200 hover:border-blue-400"
              }`}
            >
              Umumiy
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl p-4 text-sm">
          {error}
        </div>
      ) : stats ? (
        <>
          {/* KPI Cards — revenue yo'q */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <KpiCard label="Jami qabullar"   value={stats.totalAppointments} />
            <KpiCard label="Unikal bemorlar" value={stats.uniquePatients} />
            <KpiCard
              label="Qaytib kelish"
              value={stats.returnRate !== null ? `${(stats.returnRate * 100).toFixed(1)}%` : "—"}
            />
            <KpiCard label="Ishlagan kunlar" value={stats.workedDays} />
            <KpiCard label="Yangi bemorlar"  value={stats.newPatients} />
            <KpiCard
              label="Davr o'rtacha baho"
              value={stats.ratings.avg !== null ? stats.ratings.avg.toFixed(1) : "—"}
              sub={stats.ratings.count > 0 ? `${stats.ratings.count} baho` : undefined}
            />
          </div>

          {/* Charts */}
          {stats.monthlyDynamics.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Oylik qabullar</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.monthlyDynamics} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#6b7280" }} />
                      <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12 }}
                        formatter={(v) => [`${v} ta`, "Qabullar"]}
                      />
                      <Bar dataKey="appointments" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Oylik baho dinamikasi</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={stats.monthlyDynamics.filter((m) => m.ratingCount > 0)}
                      margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#6b7280" }} />
                      <YAxis domain={[0, 5]} tick={{ fontSize: 10, fill: "#6b7280" }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12 }}
                        formatter={(v) => [`${Number(v).toFixed(1)} ★`, "O'rtacha baho"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="avgStars"
                        stroke="#f5b50a"
                        strokeWidth={2.5}
                        dot={{ r: 3, fill: "#f5b50a" }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {pieData.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Status taqsimoti</h3>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="45%"
                        outerRadius={75}
                        innerRadius={40}
                        dataKey="value"
                        paddingAngle={2}
                      >
                        {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12 }}
                        formatter={(v, n) => [`${v} ta`, n]}
                      />
                      <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {stats.topServices.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Top xizmatlar</h3>
                <ul className="space-y-2">
                  {stats.topServices.map((s, i) => (
                    <li key={i} className="flex items-center justify-between gap-2">
                      <span className="text-sm text-gray-700 truncate">{i + 1}. {s.name}</span>
                      <span className="shrink-0 text-sm font-semibold text-blue-700">{s.count} ta</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {stats.totalAppointments === 0 && (
            <div className="text-center text-gray-400 text-sm py-8">
              Bu davrda hali qabul yo&apos;q
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
