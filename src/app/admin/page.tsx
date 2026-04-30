"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Stats {
  totalAppointments: number;
  todayAppointments: number;
  arrivedToday: number;
  missedToday: number;
  pendingToday: number;
  totalDoctors: number;
  totalServices: number;
  recentAppointments: {
    id: string;
    patientName: string;
    patientPhone: string;
    status: string;
    queueNumber: number | null;
    createdAt: string;
    service: { name: string; type: string };
    doctor: { firstName: string; lastName: string } | null;
  }[];
}

const statusColors: Record<string, string> = {
  booked: "badge-booked",
  arrived: "badge-arrived",
  missed: "badge-missed",
  cancelled: "badge-cancelled",
};

const statusLabels: Record<string, string> = {
  booked: "Bron", arrived: "Keldi", missed: "Kelmadi", cancelled: "Bekor",
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [clinicId, setClinicId] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("clinicId") || "";
    setClinicId(stored);
    fetchStats(stored);
  }, []);

  async function fetchStats(cid: string) {
    setLoading(true);
    try {
      const token = localStorage.getItem("auth_token") || "";
      const res = await fetch(`/api/admin/stats${cid ? `?clinicId=${cid}` : ""}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) setStats(json.data);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 text-sm">Yuklanmoqda...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-500 mb-4">Ma'lumot yuklanmadi. Tizimga kiring.</p>
        <Link href="/login" className="btn-primary">Kirish</Link>
      </div>
    );
  }

  const statCards = [
    { label: "Bugun jami", value: stats.todayAppointments, color: "text-blue-600" },
    { label: "Keldi", value: stats.arrivedToday, color: "text-green-600" },
    { label: "Kelmadi", value: stats.missedToday, color: "text-red-600" },
    { label: "Kutmoqda", value: stats.pendingToday, color: "text-yellow-600" },
    { label: "Jami shifokorlar", value: stats.totalDoctors, color: "text-purple-600" },
    { label: "Jami xizmatlar", value: stats.totalServices, color: "text-indigo-600" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {statCards.map((s) => (
          <div key={s.label} className="card text-center py-4">
            <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">So'nggi qabullar</h2>
        {stats.recentAppointments.length === 0 ? (
          <p className="text-gray-400 text-sm">Bugun hali qayd yo'q</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 font-medium text-gray-500">Sana</th>
                  <th className="text-left py-2 font-medium text-gray-500">Bemor</th>
                  <th className="text-left py-2 font-medium text-gray-500">Xizmat</th>
                  <th className="text-left py-2 font-medium text-gray-500">Shifokor</th>
                  <th className="text-left py-2 font-medium text-gray-500">№</th>
                  <th className="text-left py-2 font-medium text-gray-500">Holat</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentAppointments.map((a) => (
                  <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(a.createdAt).toLocaleDateString("uz-UZ", { day: "numeric", month: "short" })}
                    </td>
                    <td className="py-2">
                      <div>{a.patientName}</div>
                      <div className="text-xs text-gray-400">{a.patientPhone}</div>
                    </td>
                    <td className="py-2 text-gray-700">{a.service.name}</td>
                    <td className="py-2 text-gray-700">
                      {a.doctor ? `${a.doctor.firstName} ${a.doctor.lastName}` : "—"}
                    </td>
                    <td className="py-2 text-gray-700">{a.queueNumber ?? "—"}</td>
                    <td className="py-2">
                      <span className={statusColors[a.status]}>
                        {statusLabels[a.status] ?? a.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
