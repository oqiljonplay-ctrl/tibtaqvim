"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { StarRating } from "@/components/webapp/StarRating";

interface Stint {
  id: string;
  startDate: string;
  endDate: string | null;
  role: string;
}

interface StatusItem { status: string; count: number }
interface ServiceItem { name: string; count: number }
interface MonthItem  { month: string; appointments: number; ratingCount: number; avgStars: number | null }

interface StatsData {
  stints: Stint[];
  totalAppointments: number;
  uniquePatients: number;
  returnRate: number | null;
  statusBreakdown: StatusItem[];
  revenue: number;
  workedDays: number;
  topServices: ServiceItem[];
  newPatients: number;
  monthlyDynamics: MonthItem[];
  ratings: { count: number; avg: number | null };
}

interface DoctorInfo {
  firstName: string;
  lastName: string;
  specialty: string;
  emId?: string | null;
  employee?: { compositeRating: number | null; ratingCount: number } | null;
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("uz-Latn-UZ", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("uz-Latn-UZ").format(n) + " so'm";
}

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-1">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-2xl font-bold text-gray-900">{value}</span>
      {sub && <span className="text-xs text-gray-400">{sub}</span>}
    </div>
  );
}

export default function DoctorStatsPage() {
  const params   = useParams();
  const router   = useRouter();
  const doctorId = params.id as string;

  const [doctor,   setDoctor]   = useState<DoctorInfo | null>(null);
  const [stats,    setStats]    = useState<StatsData | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [combined, setCombined] = useState(false);
  const [stintId,  setStintId]  = useState<string | null>(null);

  // Fetch doctor info
  useEffect(() => {
    fetch(`/api/admin/doctors/${doctorId}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) {
          setDoctor({
            firstName: res.data.firstName,
            lastName:  res.data.lastName,
            specialty: res.data.specialty,
            emId:      res.data.emId ?? null,
            employee:  res.data.employee ?? null,
          });
        }
      })
      .catch(() => {});
  }, [doctorId]);

  // Fetch stats
  useEffect(() => {
    setLoading(true);
    setError(null);
    const qs = combined ? "combined=true" : stintId ? `stintId=${stintId}` : "";
    fetch(`/api/admin/doctors/${doctorId}/stats${qs ? "?" + qs : ""}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) {
          setStats(res.data);
          // Default: select first stint if none chosen
          if (!stintId && !combined && res.data.stints?.length > 0) {
            setStintId(res.data.stints[0].id);
          }
        } else {
          setError(res.error?.message ?? "Xatolik");
        }
      })
      .catch(() => setError("Tarmoq xatosi"))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorId, combined, stintId]);

  function selectStint(id: string) {
    setCombined(false);
    setStintId(id);
  }

  function selectCombined() {
    setCombined(true);
    setStintId(null);
  }

  const compositeRating = doctor?.employee?.compositeRating ?? null;
  const ratingCount     = doctor?.employee?.ratingCount ?? 0;

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
      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => router.back()}
          className="mt-1 text-gray-400 hover:text-gray-700 text-xl"
          title="Orqaga"
        >
          ←
        </button>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold text-gray-900">
              {doctor ? `${doctor.lastName} ${doctor.firstName}` : "Yuklanmoqda..."}
            </h1>
            {doctor?.emId && (
              <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-mono">
                {doctor.emId}
              </span>
            )}
            {compositeRating !== null && (
              <span className="flex items-center gap-1 text-sm text-gray-600">
                <StarRating value={compositeRating} readOnly size={16} />
                <span className="font-medium">{compositeRating.toFixed(1)}</span>
                {ratingCount > 0 && (
                  <span className="text-gray-400">({ratingCount} baho)</span>
                )}
              </span>
            )}
          </div>
          {doctor?.specialty && (
            <p className="text-sm text-gray-500 mt-0.5">{doctor.specialty}</p>
          )}
        </div>
      </div>

      {/* Stint selector */}
      {stats && stats.stints.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {stats.stints.map((s) => {
            const active = !combined && stintId === s.id;
            return (
              <button
                key={s.id}
                onClick={() => selectStint(s.id)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                  active
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-700 border-gray-200 hover:border-blue-400"
                }`}
              >
                {formatDate(s.startDate)} — {s.endDate ? formatDate(s.endDate) : "hozir (faol)"}
              </button>
            );
          })}
          <button
            onClick={selectCombined}
            className={`px-3 py-1.5 rounded-lg text-sm border transition ${
              combined
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-200 hover:border-blue-400"
            }`}
          >
            Jamlangan
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl p-4 text-sm">
          {error}
        </div>
      ) : stats ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Jami qabullar"   value={stats.totalAppointments} />
            <KpiCard label="Unikal bemorlar" value={stats.uniquePatients} />
            <KpiCard
              label="Qaytib kelish"
              value={stats.returnRate !== null ? `${(stats.returnRate * 100).toFixed(1)}%` : "—"}
            />
            <KpiCard label="Tushum" value={formatMoney(stats.revenue)} />
            <KpiCard label="Ishlagan kunlar" value={stats.workedDays} />
            <KpiCard label="Yangi bemorlar"  value={stats.newPatients} />
            <KpiCard label="Baholar soni"    value={stats.ratings.count} />
            <KpiCard
              label="Davr o'rtacha baho"
              value={stats.ratings.avg !== null ? stats.ratings.avg.toFixed(1) : "—"}
              sub={stats.ratings.avg !== null ? "★" : undefined}
            />
          </div>

          {/* Charts row */}
          {stats.monthlyDynamics.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Bar: monthly appointments */}
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

              {/* Line: monthly rating avg */}
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

          {/* Pie chart + top services row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie: status breakdown */}
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
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12 }}
                        formatter={(v, name) => [`${v} ta`, name]}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        wrapperStyle={{ fontSize: 11 }}
                        iconType="circle"
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Top services */}
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
