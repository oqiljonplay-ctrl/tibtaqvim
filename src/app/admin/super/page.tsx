"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Stats {
  totalClinics: number;
  activeClinics: number;
  totalAppointments: number;
  todayAppointments: number;
  totalUsers: number;
  totalDoctors: number;
  clinicList: {
    id: string;
    name: string;
    isActive: boolean;
    createdAt: string;
    _count: { branches: number; doctors: number; appointments: number };
  }[];
  recentAudit: {
    id: string;
    action: string;
    actorId: string;
    clinicId: string | null;
    createdAt: string;
  }[];
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  CLINIC_CREATED: { label: "Klinika yaratildi", color: "text-green-600" },
  CLINIC_UPDATED: { label: "Klinika yangilandi", color: "text-blue-600" },
  CLINIC_DELETED: { label: "Klinika o'chirildi", color: "text-red-600" },
  SETTINGS_UPDATED: { label: "Sozlamalar o'zgartirildi", color: "text-yellow-600" },
  MODULES_UPDATED: { label: "Modullar o'zgartirildi", color: "text-purple-600" },
  FEATURES_UPDATED: { label: "Flaglar o'zgartirildi", color: "text-indigo-600" },
};

function StatCard({
  label,
  value,
  sub,
  icon,
  color,
}: {
  label: string;
  value: number;
  sub?: string;
  icon: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${color}`}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <div className="text-sm text-gray-500">{label}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

export default function SuperDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("auth_token") || "";
    fetch("/api/admin/super/stats", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setStats(j.data);
        else setError(j.error?.message ?? "Xatolik");
      })
      .catch(() => setError("Server bilan bog'lanishda xatolik"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-400">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Yuklanmoqda...</span>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700 text-sm">
        {error || "Ma'lumot yuklanmadi"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Clinic OS — barcha klinikalar nazorati</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard icon="🏥" label="Jami klinikalar" value={stats.totalClinics} color="bg-indigo-50" />
        <StatCard icon="✅" label="Faol" value={stats.activeClinics} color="bg-green-50" />
        <StatCard icon="📅" label="Bugun bron" value={stats.todayAppointments} color="bg-blue-50" />
        <StatCard icon="📊" label="Jami bronlar" value={stats.totalAppointments} color="bg-purple-50" />
        <StatCard icon="👤" label="Bemorlar" value={stats.totalUsers} color="bg-yellow-50" />
        <StatCard icon="👨‍⚕️" label="Shifokorlar" value={stats.totalDoctors} color="bg-pink-50" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Clinic list */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Klinikalar</h2>
            <Link
              href="/admin/super/clinics"
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Hammasini ko'r →
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {stats.clinicList.length === 0 && (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">
                Hali klinikalar yo'q
              </div>
            )}
            {stats.clinicList.map((c) => (
              <Link
                key={c.id}
                href={`/admin/super/clinics/${c.id}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${c.isActive ? "bg-green-500" : "bg-gray-300"}`}
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-900">{c.name}</div>
                    <div className="text-xs text-gray-400">
                      {c._count.branches} filial · {c._count.doctors} shifokor
                    </div>
                  </div>
                </div>
                <div className="text-xs text-gray-400">{c._count.appointments} bron</div>
              </Link>
            ))}
          </div>
        </div>

        {/* Audit log */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">So'nggi o'zgarishlar</h2>
            <Link
              href="/admin/super/audit"
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Hammasini ko'r →
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {stats.recentAudit.length === 0 && (
              <div className="px-5 py-8 text-center text-gray-400 text-sm">
                Hozircha hech narsa yo'q
              </div>
            )}
            {stats.recentAudit.map((log) => {
              const meta = ACTION_LABELS[log.action];
              return (
                <div key={log.id} className="flex items-start gap-3 px-5 py-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${meta?.color ?? "text-gray-700"}`}>
                      {meta?.label ?? log.action}
                    </div>
                    <div className="text-xs text-gray-400 truncate">
                      {new Date(log.createdAt).toLocaleString("uz-UZ")}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
