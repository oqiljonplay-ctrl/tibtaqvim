"use client";
import { useEffect, useRef, useState } from "react";

interface Appointment {
  id: string; patientName: string; patientPhone: string;
  queueNumber: number | null; status: string; address: string | null;
  service: { name: string; type: string };
  slot: { startTime: string; endTime: string } | null;
  user: { tibId: string | null } | null;
}

const STATUS_CFG = {
  booked:    { label: "Kutmoqda", cls: "badge-booked" },
  arrived:   { label: "Keldi",    cls: "badge-arrived" },
  missed:    { label: "Kelmadi", cls: "badge-missed" },
  cancelled: { label: "Bekor",   cls: "badge-cancelled" },
} as const;

export default function DoctorPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string>("");
  const [dateLabel, setDateLabel] = useState<string>("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const todayRef = useRef(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    // Client-only: avoid SSR/hydration mismatch with date strings
    todayRef.current = new Date().toISOString().split("T")[0];
    setDateLabel(new Date().toLocaleDateString("uz-UZ", { weekday: "long", day: "numeric", month: "long" }));
    fetchAppointments();
    timerRef.current = setInterval(fetchAppointments, 30_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchAppointments() {
    try {
      const token = localStorage.getItem("auth_token") || "";
      const clinicId = localStorage.getItem("clinicId") || "";
      const params = new URLSearchParams({ date: todayRef.current });
      if (clinicId) params.set("clinicId", clinicId);
      const res = await fetch(`/api/appointments?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        setAppointments(json.data.items ?? json.data);
        setLastRefresh(new Date().toLocaleTimeString("uz-UZ"));
        setErrorMsg(null);
      } else {
        setErrorMsg(json.error?.message ?? json.error ?? "Ma'lumot yuklanmadi");
      }
    } catch {
      setErrorMsg("Tarmoq xatosi. Qayta urinilmoqda...");
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, status: "arrived" | "missed") {
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
        setErrorMsg(json.error?.message ?? json.error ?? "Holat o'zgartirilmadi");
        if (prev) setAppointments((list) => list.map((a) => a.id === id ? { ...a, status: prev } : a));
      }
    } catch {
      setErrorMsg("Tarmoq xatosi");
      if (prev) setAppointments((list) => list.map((a) => a.id === id ? { ...a, status: prev } : a));
    }
  }

  const booked = appointments.filter((a) => a.status === "booked");
  const done = appointments.filter((a) => ["arrived", "missed"].includes(a.status));

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bugungi navbat</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {dateLabel}
            {lastRefresh ? ` · Oxirgi yangilanish: ${lastRefresh}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-500">{booked.length}</div>
            <div className="text-xs text-gray-400">Kutmoqda</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-500">{appointments.filter((a) => a.status === "arrived").length}</div>
            <div className="text-xs text-gray-400">Keldi</div>
          </div>
          <button onClick={fetchAppointments} className="btn-secondary text-sm">↻</button>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2">
          <span className="text-red-500 flex-shrink-0 mt-0.5">⚠️</span>
          <p className="text-red-700 text-sm flex-1">{errorMsg}</p>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 text-lg leading-none flex-shrink-0">×</button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Yuklanmoqda...</div>
      ) : appointments.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">Bugun qayd yo'q</div>
      ) : (
        <div className="space-y-3">
          {booked.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Kutmoqda</h2>
              {booked.map((a) => (
                <AppointmentCard key={a.id} a={a} onUpdate={updateStatus} />
              ))}
            </div>
          )}
          {done.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 mt-4">Tugallangan</h2>
              {done.map((a) => (
                <AppointmentCard key={a.id} a={a} onUpdate={updateStatus} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AppointmentCard({
  a,
  onUpdate,
}: {
  a: Appointment;
  onUpdate: (id: string, s: "arrived" | "missed") => void;
}) {
  const sc = STATUS_CFG[a.status as keyof typeof STATUS_CFG] ?? STATUS_CFG.booked;
  const isDone = a.status !== "booked";

  return (
    <div className={`card flex items-center justify-between gap-4 mb-2 ${isDone ? "opacity-55" : ""}`}>
      <div className="flex items-center gap-4">
        {a.queueNumber != null && (
          <div className="w-11 h-11 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-lg flex-shrink-0">
            {a.queueNumber}
          </div>
        )}
        <div>
          <div className="font-semibold text-gray-900">{a.patientName}</div>
          <div className="text-sm text-gray-500">{a.patientPhone}</div>
          {a.user?.tibId && (
            <div className="text-xs text-blue-500 font-mono mt-0.5">🆔 {a.user.tibId}</div>
          )}
          <div className="text-xs text-gray-400 mt-0.5">{a.service.name}</div>
          {a.slot && <div className="text-xs text-blue-500">🕐 {a.slot.startTime} — {a.slot.endTime}</div>}
          {a.address && <div className="text-xs text-orange-500">📍 {a.address}</div>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={sc.cls}>{sc.label}</span>
        {!isDone && (
          <>
            <button onClick={() => onUpdate(a.id, "arrived")} className="btn-success text-xs py-1 px-3">Keldi</button>
            <button onClick={() => onUpdate(a.id, "missed")} className="btn-danger text-xs py-1 px-3">Kelmadi</button>
          </>
        )}
      </div>
    </div>
  );
}
