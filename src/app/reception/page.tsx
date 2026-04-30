"use client";
import { useEffect, useRef, useState } from "react";

interface Appointment {
  id: string; patientName: string; patientPhone: string;
  queueNumber: number | null; status: string; address: string | null;
  createdAt: string;
  service: { name: string; type: string };
  doctor: { firstName: string; lastName: string } | null;
  slot: { startTime: string; endTime: string } | null;
  user: { tibId: string | null } | null;
}
interface Service { id: string; name: string }

const STATUS_CFG = {
  booked:    { label: "Kutmoqda", cls: "badge-booked" },
  arrived:   { label: "Keldi",    cls: "badge-arrived" },
  missed:    { label: "Kelmadi", cls: "badge-missed" },
  cancelled: { label: "Bekor",   cls: "badge-cancelled" },
} as const;

const AUTO_REFRESH_MS = 30_000;

export default function ReceptionPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [search, setSearch] = useState("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchAll();
    timerRef.current = setInterval(() => fetchAppointments(), AUTO_REFRESH_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  useEffect(() => { fetchAppointments(); }, [selectedDate, serviceFilter]);

  async function fetchAll() {
    setLoading(true);
    try {
      const token = localStorage.getItem("auth_token") || "";
      const clinicId = localStorage.getItem("clinicId") || "";
      const [apptRes, svcRes] = await Promise.all([
        fetch(`/api/appointments?date=${selectedDate}${clinicId ? `&clinicId=${clinicId}` : ""}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/admin/services${clinicId ? `?clinicId=${clinicId}` : ""}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      const [apptJson, svcJson] = await Promise.all([apptRes.json(), svcRes.json()]);
      if (apptJson.success) setAppointments(apptJson.data.items ?? apptJson.data);
      else setErrorMsg(apptJson.error ?? "Qabullar yuklanmadi");
      if (svcJson.success) setServices(svcJson.data);
      setLastRefresh(new Date().toLocaleTimeString("uz-UZ"));
    } catch {
      setErrorMsg("Tarmoq xatosi. Qayta urinib ko'ring.");
    } finally {
      setLoading(false);
    }
  }

  async function fetchAppointments() {
    try {
      const token = localStorage.getItem("auth_token") || "";
      const clinicId = localStorage.getItem("clinicId") || "";
      const params = new URLSearchParams({ date: selectedDate });
      if (clinicId) params.set("clinicId", clinicId);
      if (serviceFilter !== "all") params.set("serviceId", serviceFilter);
      const res = await fetch(`/api/appointments?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.success) { setAppointments(json.data.items ?? json.data); setLastRefresh(new Date().toLocaleTimeString("uz-UZ")); setErrorMsg(null); }
      else setErrorMsg(json.error ?? "Qabullar yuklanmadi");
    } catch {
      setErrorMsg("Tarmoq xatosi.");
    }
  }

  async function markStatus(id: string, status: "arrived" | "missed") {
    const prev = appointments.find((a) => a.id === id)?.status;
    setAppointments((list) => list.map((a) => a.id === id ? { ...a, status } : a));
    try {
      const token = localStorage.getItem("auth_token") || "";
      const res = await fetch("/api/arrived", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ appointmentId: id, status }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setErrorMsg(json.error ?? "Holat o'zgartirilmadi");
        if (prev) setAppointments((list) => list.map((a) => a.id === id ? { ...a, status: prev } : a));
      }
    } catch {
      setErrorMsg("Tarmoq xatosi");
      if (prev) setAppointments((list) => list.map((a) => a.id === id ? { ...a, status: prev } : a));
    }
  }

  const markArrived = (id: string) => markStatus(id, "arrived");
  const markMissed  = (id: string) => markStatus(id, "missed");

  const filtered = appointments.filter((a) => {
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const tibId = a.user?.tibId?.toLowerCase() ?? "";
      const name = a.patientName.toLowerCase();
      const phone = a.patientPhone.toLowerCase();
      if (!tibId.includes(q) && !name.includes(q) && !phone.includes(q)) return false;
    }
    return true;
  });

  const counts = {
    all: appointments.length,
    booked: appointments.filter((a) => a.status === "booked").length,
    arrived: appointments.filter((a) => a.status === "arrived").length,
    missed: appointments.filter((a) => a.status === "missed").length,
  };

  return (
    <div>
      {/* Title + refresh */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Navbat ro'yxati</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {lastRefresh ? `Oxirgi yangilanish: ${lastRefresh}` : "Yuklanmoqda..."}
            <span className="ml-2 text-blue-400">(har 30s avtomatik)</span>
          </p>
        </div>
        <button onClick={fetchAppointments} className="btn-secondary text-sm flex items-center gap-1.5">
          ↻ Yangilash
        </button>
      </div>

      {errorMsg && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2">
          <span className="text-red-500 flex-shrink-0 mt-0.5">⚠️</span>
          <p className="text-red-700 text-sm flex-1">{errorMsg}</p>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 text-lg leading-none flex-shrink-0">×</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="input w-auto text-sm"
        />
        <select
          value={serviceFilter}
          onChange={(e) => setServiceFilter(e.target.value)}
          className="input w-auto text-sm"
        >
          <option value="all">Barcha xizmatlar</option>
          {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input text-sm flex-1 min-w-[160px]"
          placeholder="🔍 Ism, telefon yoki 🆔 tibId"
        />
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {(["all", "booked", "arrived", "missed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === f
                ? "bg-blue-600 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {f === "all" ? "Barchasi" : f === "booked" ? "Kutmoqda" : f === "arrived" ? "Keldi" : "Kelmadi"}
            <span className="ml-1.5 text-xs opacity-75">({counts[f]})</span>
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Yuklanmoqda...</div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">Ro'yxat bo'sh</div>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="border-b border-gray-100">
                <th className="text-left py-3 px-4 font-medium text-gray-500 w-12">№</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Bemor</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 hidden md:table-cell">🆔 ID</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Xizmat</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500 hidden lg:table-cell">Shifokor</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Vaqt</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Holat</th>
                <th className="text-left py-3 px-4 font-medium text-gray-500">Amal</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const sc = STATUS_CFG[a.status as keyof typeof STATUS_CFG] ?? STATUS_CFG.booked;
                return (
                  <tr key={a.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${a.status !== "booked" ? "opacity-60" : ""}`}>
                    <td className="py-3 px-4 text-center">
                      <span className="bg-gray-100 text-gray-700 text-xs font-bold px-2 py-0.5 rounded-md">
                        {a.queueNumber ?? "—"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-900">{a.patientName}</div>
                      <div className="text-xs text-gray-400">{a.patientPhone}</div>
                      {a.address && <div className="text-xs text-orange-500 mt-0.5">📍 {a.address}</div>}
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      {a.user?.tibId
                        ? <span className="text-xs font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{a.user.tibId}</span>
                        : <span className="text-xs text-gray-300">—</span>}
                    </td>
                    <td className="py-3 px-4 text-gray-700">{a.service.name}</td>
                    <td className="py-3 px-4 text-gray-700 hidden lg:table-cell">
                      {a.doctor ? `${a.doctor.firstName} ${a.doctor.lastName}` : "—"}
                    </td>
                    <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                      {a.slot
                        ? `${a.slot.startTime}–${a.slot.endTime}`
                        : new Date(a.createdAt).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="py-3 px-4">
                      <span className={sc.cls}>{sc.label}</span>
                    </td>
                    <td className="py-3 px-4">
                      {a.status === "booked" && (
                        <div className="flex gap-1.5">
                          <button onClick={() => markArrived(a.id)} className="btn-success text-xs py-1 px-2.5">Keldi</button>
                          <button onClick={() => markMissed(a.id)} className="btn-danger text-xs py-1 px-2.5">Kelmadi</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
