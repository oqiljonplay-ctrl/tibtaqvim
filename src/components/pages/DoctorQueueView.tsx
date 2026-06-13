"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import StatsButton from "@/components/StatsButton";
import { Stack } from "@/components/layout";
import { DoctorBlockedDatesManager } from "@/components/DoctorBlockedDatesManager";

interface DoctorPatient {
  id: string;
  patientName: string;
  patientPhone: string;
  queueNumber: number | null;
  status: string;
  paymentStatus: string;
  notes: string | null;
}

interface ServiceIsland {
  serviceId: string;
  serviceName: string;
  serviceType: string | null;
  doctorName: string | null;
  specialty: string | null;
  patients: DoctorPatient[];
}

interface DoctorData {
  date: string;
  services: ServiceIsland[];
  counts: { total: number; services: number; arrived: number; waiting: number; missed: number };
}

const AUTO_REFRESH_MS = 30_000;

export interface DoctorQueueViewProps {
  context?: "standalone" | "admin";
}

export default function DoctorQueueView({ context = "standalone" }: DoctorQueueViewProps) {
  const [data, setData] = useState<DoctorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [date, setDate] = useState(() => new Date().toLocaleDateString("sv-SE"));
  const [lastRefresh, setLastRefresh] = useState("");
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [showBlockManager, setShowBlockManager] = useState(false);
  const [isInactive, setIsInactive] = useState(false);
  const [inactiveEmId, setInactiveEmId] = useState<string | null>(null);
  const dateRef = useRef(date);

  useEffect(() => {
    if (context === "admin") return;
    fetch("/api/doctor/profile", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          if (j.data.inactive) {
            setIsInactive(true);
            setInactiveEmId(j.data.emId ?? null);
            setLoading(false);
          } else {
            setDoctorId(j.data.id);
          }
        }
      })
      .catch(() => {});
  }, [context]);

  const fetchData = useCallback(async (d?: string) => {
    const target = d ?? dateRef.current;
    try {
      const res = await fetch(`/api/doctor/appointments?date=${target}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = await res.json();
      if (res.status === 403 && json.error?.code === "EM_REQUIRED") {
        window.location.href = "/login";
        return;
      }
      if (json.success) {
        setData(json.data);
        setLastRefresh(new Date().toLocaleTimeString("uz-UZ"));
        setErrorMsg(null);
      } else {
        setErrorMsg(json.error?.message ?? "Ma'lumot yuklanmadi");
      }
    } catch {
      setErrorMsg("Tarmoq xatosi. Qayta urinilmoqda...");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const timer = setInterval(() => fetchData(), AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [fetchData]);

  function handleDateChange(d: string) {
    if (!d) return;
    dateRef.current = d;
    setDate(d);
    setLoading(true);
    fetchData(d);
  }

  async function handleAttendance(appointmentId: string, action: "arrived" | "missed" | "reset") {
    setActionLoading(appointmentId);
    try {
      const res = await fetch(`/api/doctor/appointments/${appointmentId}/attendance`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchData();
      } else {
        setErrorMsg("Xato: " + (json.error?.message ?? json.message ?? "Amal bajarilmadi"));
      }
    } catch {
      setErrorMsg("Tarmoq xatosi");
    } finally {
      setActionLoading(null);
    }
  }

  // Bo'shatilgan shifokor — faol klinika yo'q holat ekrani
  if (isInactive) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="text-5xl mb-4">🏥</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Faol ish joyi yo&apos;q</h2>
        <p className="text-gray-500 text-sm leading-relaxed max-w-sm mb-4">
          Siz hozirda hech qaysi klinikada faol xodim emassiz.
          {inactiveEmId && (
            <> <span className="font-semibold text-blue-600">EM ID: {inactiveEmId}</span>.</>
          )}{" "}
          Profil ma&apos;lumotlaringiz va statistikangiz saqlangan. Yangi klinikaga ishga kirish — klinika administratori sizni EM ID orqali ishga oladi.
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <a
            href="/doctor/profile"
            className="w-full py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold text-center"
          >
            📋 Profilni ko&apos;rish
          </a>
          <a
            href="/doctor/stats"
            className="w-full py-3 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium text-center"
          >
            📊 Tarixiy statistika
          </a>
        </div>
      </div>
    );
  }

  const isToday = date === new Date().toLocaleDateString("sv-SE");
  const dateLabel = new Date(date + "T00:00:00").toLocaleDateString("uz-UZ", {
    weekday: "long", day: "numeric", month: "long",
  });

  return (
    <div>
      {/* Header */}
      <Stack direction="row" stackOnMobile justify="between" align="start" gap={4} className="mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isToday ? "Bugungi navbat" : "Navbat ro'yxati"}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {dateLabel}
            {lastRefresh ? ` · Oxirgi yangilanish: ${lastRefresh}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {data && (
            <div className="flex gap-3 text-sm">
              <span className="text-center">
                <div className="text-xl font-bold text-amber-500">{data.counts.waiting}</div>
                <div className="text-xs text-gray-400">Kutmoqda</div>
              </span>
              <span className="text-center">
                <div className="text-xl font-bold text-emerald-500">{data.counts.arrived}</div>
                <div className="text-xs text-gray-400">Keldi</div>
              </span>
            </div>
          )}
          <button onClick={() => fetchData()} className="btn-secondary text-sm">↻</button>
          <StatsButton />
        </div>
      </Stack>

      {/* Sana tanlash */}
      <div className="flex items-center gap-2 mb-5">
        <input
          type="date"
          value={date}
          onChange={(e) => handleDateChange(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {!isToday && (
          <button
            onClick={() => handleDateChange(new Date().toLocaleDateString("sv-SE"))}
            className="text-sm text-blue-600 hover:underline"
          >
            Bugunga qaytish
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2">
          <span className="text-red-500 flex-shrink-0">⚠️</span>
          <p className="text-red-700 text-sm flex-1">{errorMsg}</p>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 text-lg leading-none">×</button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Yuklanmoqda...</div>
      ) : !data || data.services.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <p>{isToday ? "Bugun to'langan bemor yo'q" : `${dateLabel} kuni to'langan bemor yo'q`}</p>
          <p className="text-xs mt-2 text-gray-300">
            Bemorlar qabulxona to'lovni tasdiqlagandan keyin bu yerda ko'rinadi
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.services.map((island) => (
            <ServiceIslandCard
              key={island.serviceId}
              island={island}
              date={data.date}
              actionLoading={actionLoading}
              onAttendance={handleAttendance}
            />
          ))}
        </div>
      )}

      {/* Bloklangan kunlar — faqat shifokor uchun */}
      {doctorId && (
        <div className="mt-6">
          <button
            onClick={() => setShowBlockManager((v) => !v)}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
          >
            <span className={`transition-transform ${showBlockManager ? "rotate-90" : ""}`}>▶</span>
            Bloklangan kunlarni boshqarish
          </button>
          {showBlockManager && (
            <div className="mt-3 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
              <DoctorBlockedDatesManager doctorId={doctorId} credentials="include" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Xizmat orolchasi ───────────────────────────────────────────────────────────

interface IslandProps {
  island: ServiceIsland;
  date: string;
  actionLoading: string | null;
  onAttendance: (id: string, action: "arrived" | "missed" | "reset") => void;
}

function ServiceIslandCard({ island, date, actionLoading, onAttendance }: IslandProps) {
  const printRef = useRef<HTMLDivElement>(null);

  function handlePrint() {
    const printWindow = window.open("", "_blank", "width=800,height=600");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head>
        <title>${island.serviceName} — ${date}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { font-size: 18px; margin-bottom: 4px; }
          .meta { color: #666; font-size: 13px; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 13px; }
          th { background: #f5f5f5; }
        </style>
      </head><body>
        <h1>${island.serviceName}</h1>
        <div class="meta">
          ${island.specialty ? island.specialty + " · " : ""}
          ${island.doctorName ?? ""} · Sana: ${date} · Jami: ${island.patients.length} bemor
        </div>
        <table>
          <thead><tr><th>#</th><th>Bemor</th><th>Telefon</th><th>Holat</th></tr></thead>
          <tbody>
            ${island.patients.map((p, i) => `
              <tr>
                <td>${p.queueNumber ?? i + 1}</td>
                <td>${p.patientName}</td>
                <td>${p.patientPhone}</td>
                <td>${p.status === "arrived" ? "Keldi" : p.status === "missed" ? "Kelmadi" : "Kutmoqda"}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  }

  async function handleDownloadPDF() {
    try {
      const { default: jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF();

      doc.setFontSize(16);
      doc.text(island.serviceName, 14, 18);
      doc.setFontSize(10);
      doc.setTextColor(100);
      const meta = [island.specialty, island.doctorName, `Sana: ${date}`, `Jami: ${island.patients.length} bemor`]
        .filter(Boolean).join(" · ");
      doc.text(meta, 14, 25);

      autoTable(doc, {
        startY: 30,
        head: [["#", "Bemor", "Telefon", "Holat"]],
        body: island.patients.map((p, i) => [
          String(p.queueNumber ?? i + 1),
          p.patientName,
          p.patientPhone,
          p.status === "arrived" ? "Keldi" : p.status === "missed" ? "Kelmadi" : "Kutmoqda",
        ]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [79, 70, 229] },
      });

      doc.save(`${island.serviceName}-${date}.pdf`);
    } catch {
      alert("PDF kutubxona yuklanmadi. Chop etish funksiyasini ishlating.");
    }
  }

  return (
    <div className="card overflow-hidden p-0">
      {/* Orolcha sarlavhasi */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 px-4 py-3 border-b border-gray-100">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900">{island.serviceName}</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {island.specialty && <span>{island.specialty}</span>}
              {island.doctorName && <span> · {island.doctorName}</span>}
              <span> · {island.patients.length} bemor</span>
            </p>
          </div>
          <div className="flex gap-1.5 flex-shrink-0">
            <button
              onClick={handlePrint}
              className="px-2.5 py-2 min-h-[44px] bg-white border border-gray-200 hover:bg-gray-50 rounded text-xs font-medium"
            >
              🖨 Chop
            </button>
            <button
              onClick={handleDownloadPDF}
              className="px-2.5 py-2 min-h-[44px] bg-white border border-gray-200 hover:bg-gray-50 rounded text-xs font-medium"
            >
              ⬇ PDF
            </button>
          </div>
        </div>
      </div>

      {/* Bemorlar ro'yxati */}
      <div ref={printRef} className="divide-y divide-gray-50">
        {island.patients.map((p, idx) => (
          <div key={p.id} className="px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {p.queueNumber ?? idx + 1}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{p.patientName}</p>
                  <p className="text-xs text-gray-500">📞 {p.patientPhone}</p>
                </div>
              </div>
              <StatusBadge status={p.status} />
            </div>

            {/* Keldi / Kelmadi tugmalari */}
            <div className="flex gap-2 mt-2.5">
              {p.status === "booked" && (
                <>
                  <button
                    onClick={() => onAttendance(p.id, "arrived")}
                    disabled={actionLoading === p.id}
                    className="flex-1 px-3 py-1.5 min-h-[44px] bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    {actionLoading === p.id ? "..." : "✅ Keldi"}
                  </button>
                  <button
                    onClick={() => onAttendance(p.id, "missed")}
                    disabled={actionLoading === p.id}
                    className="flex-1 px-3 py-1.5 min-h-[44px] bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-600 rounded-lg text-sm transition-colors"
                  >
                    {actionLoading === p.id ? "..." : "❌ Kelmadi"}
                  </button>
                </>
              )}
              {(p.status === "arrived" || p.status === "missed") && (
                <button
                  onClick={() => onAttendance(p.id, "reset")}
                  disabled={actionLoading === p.id}
                  className="px-3 py-1.5 min-h-[44px] bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-600 rounded-lg text-xs transition-colors"
                >
                  {actionLoading === p.id ? "..." : "↩ Qaytarish"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; cls: string }> = {
    arrived: { label: "Keldi", cls: "bg-emerald-100 text-emerald-700" },
    missed:  { label: "Kelmadi", cls: "bg-red-100 text-red-700" },
    booked:  { label: "Kutmoqda", cls: "bg-amber-100 text-amber-700" },
  };
  const { label, cls } = cfg[status] ?? { label: status, cls: "bg-gray-100 text-gray-600" };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${cls}`}>
      {label}
    </span>
  );
}
