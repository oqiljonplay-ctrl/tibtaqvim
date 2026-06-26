"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

function PanelSwitcher() {
  const [actingId, setActingId] = useState<string | null>(null);
  const [actingName, setActingName] = useState<string | null>(null);

  useEffect(() => {
    const stored = document.cookie.split("; ").find(c => c.startsWith("acting_clinic="));
    setActingId(stored ? stored.split("=")[1] : null);
    setActingName(localStorage.getItem("acting_clinic_name"));
  }, []);

  const panels = [
    { href: "/admin",     label: "Admin",     icon: "🏥", desc: "Klinika boshqaruvi" },
    { href: "/doctor",    label: "Shifokor",  icon: "👨‍⚕️", desc: "Navbat ko'rish" },
    { href: "/reception", label: "Qabulxona", icon: "📋", desc: "To'lov nazorati" },
  ];

  const modeLabel = actingId && actingName
    ? `${actingName} — tahrirlash yoniq`
    : "Barcha klinikalar — faqat ko'rish";

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900">Panel ko'rish</h2>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
          actingId ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
        }`}>
          {actingId ? "✏️" : "👁"} {modeLabel}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {panels.map(p => (
          <Link
            key={p.href}
            href={p.href}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all group text-center"
          >
            <span className="text-2xl group-hover:scale-110 transition-transform">{p.icon}</span>
            <div>
              <div className="text-sm font-medium text-gray-800">{p.label}</div>
              <div className="text-xs text-gray-400">{p.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

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

// ─── Reyting boshqaruvi seksiyasi ────────────────────────────────────────────

interface EmployeeRow { id: string; emId: string; firstName: string; lastName: string | null; profession: string | null; maxClinics: number; activeStints: number }
interface EditWindow   { enabled: boolean; hours: number }
interface RatingPrior  { value: number; dynamic: boolean; threshold: number; isReal: boolean }

function RatingControls() {
  const [editWindow, setEditWindow]   = useState<EditWindow>({ enabled: false, hours: 24 });
  const [ratingPrior, setRatingPrior] = useState<RatingPrior | null>(null);
  const [employees, setEmployees]     = useState<EmployeeRow[]>([]);
  const [saving, setSaving]           = useState(false);
  const [msg, setMsg]                 = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [emSaving, setEmSaving]       = useState<string | null>(null);
  const [maxInputs, setMaxInputs]     = useState<Record<string, string>>({});

  const loadAll = useCallback(() => {
    Promise.all([
      fetch("/api/admin/global-settings").then((r) => r.json()),
      fetch("/api/admin/employees").then((r) => r.json()),
    ]).then(([gs, emRes]) => {
      if (gs.success && gs.data) {
        setEditWindow(gs.data.ratingEditWindow);
        setRatingPrior(gs.data.ratingPrior);
      }
      if (emRes.success && emRes.data) {
        setEmployees(emRes.data);
        const inputs: Record<string, string> = {};
        (emRes.data as EmployeeRow[]).forEach((e) => { inputs[e.id] = String(e.maxClinics); });
        setMaxInputs(inputs);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function saveEditWindow() {
    setSaving(true); setMsg(null);
    try {
      const res = await fetch("/api/admin/global-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "ratingEditWindow", value: editWindow }),
      });
      const data = await res.json();
      if (data.success) setMsg({ type: "ok", text: "Saqlandi" });
      else setMsg({ type: "err", text: data.error?.message ?? "Xatolik" });
    } catch { setMsg({ type: "err", text: "Tarmoq xatosi" }); }
    finally { setSaving(false); }
  }

  async function saveMaxClinics(employeeId: string) {
    const val = parseInt(maxInputs[employeeId] ?? "", 10);
    if (isNaN(val) || val < 1 || val > 10) return;
    setEmSaving(employeeId);
    try {
      const res = await fetch(`/api/admin/employees/${employeeId}/limits`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxClinics: val }),
      });
      const data = await res.json();
      if (data.success) {
        setEmployees((prev) => prev.map((e) => e.id === employeeId ? { ...e, maxClinics: val } : e));
      }
    } catch {}
    finally { setEmSaving(null); }
  }

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-gray-900">Reyting boshqaruvi</h2>

      {/* ratingEditWindow toggle */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-0.5">
            <span className="text-sm font-medium text-gray-900">Bemor bahoni tahrirlashi mumkin</span>
            <p className="text-xs text-gray-500">Yoqilsa, bemor bahoni vaqt oynasi ichida o&apos;zgartira oladi</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={editWindow.enabled}
            onClick={() => setEditWindow((v) => ({ ...v, enabled: !v.enabled }))}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${editWindow.enabled ? "bg-blue-600" : "bg-gray-200"}`}
          >
            <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${editWindow.enabled ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>
        {editWindow.enabled && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600 shrink-0">Tahrirlash oynasi (soat):</label>
            <input
              type="number"
              min={1}
              max={168}
              value={editWindow.hours}
              onChange={(e) => setEditWindow((v) => ({ ...v, hours: parseInt(e.target.value, 10) || 24 }))}
              className="w-16 text-center border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
        <button
          onClick={saveEditWindow}
          disabled={saving}
          className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "Saqlanmoqda..." : "Saqlash"}
        </button>
        {msg && (
          <p className={`text-xs ${msg.type === "ok" ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>
        )}
      </div>

      {/* ratingPrior info */}
      {ratingPrior && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-700">
          <span className="font-medium">Joriy prior: </span>
          <span className="font-bold text-blue-700">{ratingPrior.value.toFixed(2)}</span>
          <span className="ml-2 text-xs text-gray-500">
            {ratingPrior.isReal ? "real o'rtacha (dinamik)" : "boshlang'ich qiymat"}
            {` · threshold: ${ratingPrior.threshold}`}
          </span>
        </div>
      )}

      {/* EM limits table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800">EM limitlari</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">EM ID</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Ism</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Kasb</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Faol stintlar</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">maxClinics</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {employees.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-400 text-xs">
                    Xodimlar topilmadi
                  </td>
                </tr>
              )}
              {employees.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-xs text-blue-700">{e.emId}</td>
                  <td className="px-4 py-2 text-gray-800">{e.lastName ? `${e.lastName} ${e.firstName}` : e.firstName}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{e.profession ?? "—"}</td>
                  <td className="px-4 py-2 text-center">{e.activeStints}</td>
                  <td className="px-4 py-2 text-center">
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={maxInputs[e.id] ?? String(e.maxClinics)}
                      onChange={(ev) => setMaxInputs((prev) => ({ ...prev, [e.id]: ev.target.value }))}
                      className="w-14 text-center border border-gray-300 rounded px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <button
                      onClick={() => saveMaxClinics(e.id)}
                      disabled={emSaving === e.id}
                      className="px-2.5 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {emSaving === e.id ? "..." : "Saqlash"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function SuperDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/super/stats")
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

      {/* Panel almashtirgich */}
      <PanelSwitcher />

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

      {/* Reyting boshqaruvi */}
      <RatingControls />
    </div>
  );
}
