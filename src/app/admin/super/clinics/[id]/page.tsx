"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Clinic {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  isActive: boolean;
  _count: { branches: number; doctors: number; staff: number; appointments: number };
}

interface Settings {
  dailyLimit: number;
  timezone: string;
  bookingWindowDays: number;
  allowSameDay: boolean;
  enableQueue: boolean;
  enableSlots: boolean;
  enableHomeService: boolean;
  enableWebapp: boolean;
  enableBot: boolean;
}

interface ModuleItem {
  module: "doctor_queue" | "diagnostic" | "home_service";
  enabled: boolean;
  config: Record<string, unknown>;
}

interface FlagItem {
  key: string;
  label: string;
  enabled: boolean;
}

interface AuditEntry {
  id: string;
  action: string;
  actorId: string;
  createdAt: string;
  payload: Record<string, unknown>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Tab = "settings" | "modules" | "features" | "audit";

const MODULE_META: Record<string, { icon: string; label: string; desc: string }> = {
  doctor_queue: { icon: "🩺", label: "Shifokor Navbati", desc: "Kunlik navbat tizimi, limit bilan" },
  diagnostic: { icon: "🔬", label: "Diagnostika Slot", desc: "Vaqt slotiga asoslangan bron" },
  home_service: { icon: "🏠", label: "Uy Xizmati", desc: "Manzilga borib xizmat ko'rsatish" },
};

const ACTION_LABELS: Record<string, string> = {
  CLINIC_CREATED: "Klinika yaratildi",
  CLINIC_UPDATED: "Klinika yangilandi",
  CLINIC_DELETED: "Klinika o'chirildi",
  SETTINGS_UPDATED: "Sozlamalar o'zgartirildi",
  MODULES_UPDATED: "Modullar o'zgartirildi",
  FEATURES_UPDATED: "Flaglar o'zgartirildi",
};

// ─── Toggle Switch ─────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
        checked ? "bg-indigo-600" : "bg-gray-200"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

// ─── Section card ──────────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function ClinicBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [features, setFeatures] = useState<FlagItem[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);

  const [tab, setTab] = useState<Tab>("settings");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  function token() {
    return localStorage.getItem("auth_token") || "";
  }

  function showToast(msg: string, type: "ok" | "err" = "ok") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  const load = useCallback(async () => {
    setLoading(true);
    const headers = { Authorization: `Bearer ${token()}` };
    const [cRes, sRes, mRes, fRes, aRes] = await Promise.all([
      fetch(`/api/admin/super/clinics/${id}`, { headers }),
      fetch(`/api/admin/super/clinics/${id}/settings`, { headers }),
      fetch(`/api/admin/super/clinics/${id}/modules`, { headers }),
      fetch(`/api/admin/super/clinics/${id}/features`, { headers }),
      fetch(`/api/admin/super/audit?clinicId=${id}&take=20`, { headers }),
    ]);
    const [cJ, sJ, mJ, fJ, aJ] = await Promise.all([
      cRes.json(), sRes.json(), mRes.json(), fRes.json(), aRes.json(),
    ]);
    if (cJ.success) setClinic(cJ.data);
    if (sJ.success) setSettings(sJ.data);
    if (mJ.success) setModules(mJ.data);
    if (fJ.success) setFeatures(fJ.data);
    if (aJ.success) setAudit(aJ.data);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // ─── Save settings ──────────────────────────────────────────────────────────

  async function saveSettings() {
    if (!settings) return;
    setSaving(true);
    const res = await fetch(`/api/admin/super/clinics/${id}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify(settings),
    });
    const j = await res.json();
    setSaving(false);
    j.success ? showToast("Sozlamalar saqlandi ✓") : showToast(j.error?.message ?? "Xatolik", "err");
  }

  // ─── Save modules ───────────────────────────────────────────────────────────

  async function saveModules() {
    setSaving(true);
    const res = await fetch(`/api/admin/super/clinics/${id}/modules`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify(modules),
    });
    const j = await res.json();
    setSaving(false);
    j.success ? showToast("Modullar saqlandi ✓") : showToast(j.error?.message ?? "Xatolik", "err");
  }

  // ─── Save features ──────────────────────────────────────────────────────────

  async function saveFeatures() {
    setSaving(true);
    const res = await fetch(`/api/admin/super/clinics/${id}/features`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify(features.map((f) => ({ key: f.key, enabled: f.enabled }))),
    });
    const j = await res.json();
    setSaving(false);
    j.success
      ? showToast("Feature flaglar saqlandi ✓")
      : showToast(j.error?.message ?? "Xatolik", "err");
    if (j.success) load();
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  function setModuleEnabled(module: string, enabled: boolean) {
    setModules((prev) =>
      prev.map((m) => (m.module === module ? { ...m, enabled } : m))
    );
  }

  function setFlag(key: string, enabled: boolean) {
    setFeatures((prev) =>
      prev.map((f) => (f.key === key ? { ...f, enabled } : f))
    );
  }

  // ─── Loading state ────────────────────────────────────────────────────────────

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

  if (!clinic || !settings) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700 text-sm">
        Klinika topilmadi.{" "}
        <Link href="/admin/super/clinics" className="underline">
          Orqaga
        </Link>
      </div>
    );
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "settings", label: "Sozlamalar", icon: "⚙️" },
    { key: "modules", label: "Modullar", icon: "🧩" },
    { key: "features", label: "Feature Flaglar", icon: "🚩" },
    { key: "audit", label: "Audit", icon: "📋" },
  ];

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${
            toast.type === "ok"
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* Breadcrumb + header */}
      <div>
        <div className="text-xs text-gray-400 mb-2">
          <Link href="/admin/super/clinics" className="hover:text-gray-600">
            Klinikalar
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-gray-600">{clinic.name}</span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{clinic.name}</h1>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  clinic.isActive
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {clinic.isActive ? "Faol" : "Nofaol"}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
              <span>{clinic._count.branches} filial</span>
              <span>·</span>
              <span>{clinic._count.doctors} shifokor</span>
              <span>·</span>
              <span>{clinic._count.staff} xodim</span>
              <span>·</span>
              <span>{clinic._count.appointments} bron</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── SETTINGS TAB ── */}
      {tab === "settings" && (
        <div className="space-y-5">

          {/* WebApp Bot Tugmasi — alohida kard */}
          <div className={`rounded-xl border-2 p-5 transition-all ${
            settings.enableWebapp
              ? "border-indigo-300 bg-indigo-50"
              : "border-gray-200 bg-gray-50"
          }`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${
                  settings.enableWebapp ? "bg-indigo-100" : "bg-gray-100"
                }`}>
                  🌐
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Web App Bot Tugmasi</div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    Bot'da foydalanuvchi klaviaturasida pastki persistent tugma paydo bo'ladi.
                    Foydalanuvchi uni bosib to'g'ridan-to'g'ri Web App'ni ochadi.
                  </div>
                  {/* Telegram tugma preview */}
                  <div className="mt-3">
                    <div className="text-xs text-gray-400 mb-1.5">Bot ko'rinishi:</div>
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      settings.enableWebapp
                        ? "bg-[#2AABEE] text-white shadow-sm"
                        : "bg-gray-200 text-gray-400 line-through"
                    }`}>
                      <span>⊞</span>
                      <span>🌐 Onlayn bron (Web App)</span>
                    </div>
                    <div className={`text-xs mt-1.5 font-medium ${
                      settings.enableWebapp ? "text-indigo-600" : "text-gray-400"
                    }`}>
                      {settings.enableWebapp ? "✓ Faol — foydalanuvchilarga ko'rinadi" : "✕ O'chirilgan — tugma yashirin"}
                    </div>
                  </div>
                </div>
              </div>
              <Toggle
                checked={settings.enableWebapp}
                onChange={(v) => setSettings({ ...settings, enableWebapp: v })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <SectionCard title="Umumiy sozlamalar">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Kunlik limit (standart)
                </label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  className="input"
                  value={settings.dailyLimit}
                  onChange={(e) =>
                    setSettings({ ...settings, dailyLimit: parseInt(e.target.value) || 40 })
                  }
                />
                <p className="text-xs text-gray-400 mt-1">
                  Shifokor/xizmat uchun standart kunlik bron limiti
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Vaqt zonasi
                </label>
                <select
                  className="input"
                  value={settings.timezone}
                  onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                >
                  <option value="Asia/Tashkent">Asia/Tashkent (UTC+5)</option>
                  <option value="Asia/Almaty">Asia/Almaty (UTC+6)</option>
                  <option value="Asia/Bishkek">Asia/Bishkek (UTC+6)</option>
                  <option value="Europe/Moscow">Europe/Moscow (UTC+3)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Necha kun oldin bron qilish mumkin
                </label>
                <input
                  type="number"
                  min={1}
                  max={90}
                  className="input"
                  value={settings.bookingWindowDays}
                  onChange={(e) =>
                    setSettings({ ...settings, bookingWindowDays: parseInt(e.target.value) || 7 })
                  }
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Boshqa kanallar">
            <div className="space-y-4">
              {[
                { key: "allowSameDay", label: "Bugun uchun bron qilish", desc: "Bir xil kuni bron imkoni" },
                { key: "enableQueue", label: "Navbat tizimi (Bot)", desc: "Telegram bot orqali navbat" },
                { key: "enableSlots", label: "Slot tizimi", desc: "Vaqt oralig'iga asoslangan bron" },
                { key: "enableHomeService", label: "Uy xizmati", desc: "Manzilga borib ko'rsatish" },
                { key: "enableBot", label: "Telegram Bot", desc: "Bot orqali ishlash" },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between py-1">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{label}</div>
                    <div className="text-xs text-gray-400">{desc}</div>
                  </div>
                  <Toggle
                    checked={settings[key as keyof Settings] as boolean}
                    onChange={(v) => setSettings({ ...settings, [key]: v })}
                  />
                </div>
              ))}
            </div>
          </SectionCard>

          <div className="lg:col-span-2 flex justify-end">
            <button
              onClick={saveSettings}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-lg text-sm transition-colors"
            >
              {saving ? "Saqlanmoqda..." : "Sozlamalarni saqlash"}
            </button>
          </div>
          </div>{/* grid end */}
        </div>
      )}

      {/* ── MODULES TAB ── */}
      {tab === "modules" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {modules.map((m) => {
              const meta = MODULE_META[m.module];
              return (
                <div
                  key={m.module}
                  className={`bg-white rounded-xl border-2 p-5 transition-all ${
                    m.enabled ? "border-indigo-200 shadow-sm" : "border-gray-100"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="text-3xl">{meta.icon}</div>
                    <Toggle
                      checked={m.enabled}
                      onChange={(v) => setModuleEnabled(m.module, v)}
                    />
                  </div>
                  <div className="font-semibold text-gray-900 text-sm">{meta.label}</div>
                  <div className="text-xs text-gray-400 mt-1">{meta.desc}</div>
                  <div
                    className={`mt-3 text-xs font-medium ${
                      m.enabled ? "text-indigo-600" : "text-gray-400"
                    }`}
                  >
                    {m.enabled ? "✓ Yoqilgan" : "✕ O'chirilgan"}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Webapp + Bot toggles */}
          <SectionCard title="Platforma sozlamalari">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                {
                  icon: "🌐",
                  key: "enableWebapp",
                  label: "Telegram WebApp",
                  desc: "Foydalanuvchi bron qilish uchun mini-app ochadi",
                },
                {
                  icon: "🤖",
                  key: "enableBot",
                  label: "Telegram Bot",
                  desc: "Botdan to'liq bron qilish mumkin",
                },
              ].map(({ icon, key, label, desc }) => (
                <div
                  key={key}
                  className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                    settings[key as keyof Settings]
                      ? "border-indigo-200 bg-indigo-50"
                      : "border-gray-100 bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{icon}</span>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{label}</div>
                      <div className="text-xs text-gray-400">{desc}</div>
                    </div>
                  </div>
                  <Toggle
                    checked={settings[key as keyof Settings] as boolean}
                    onChange={(v) => setSettings({ ...settings, [key]: v })}
                  />
                </div>
              ))}
            </div>
          </SectionCard>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => { saveModules(); saveSettings(); }}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-lg text-sm transition-colors"
            >
              {saving ? "Saqlanmoqda..." : "Modullarni saqlash"}
            </button>
          </div>
        </div>
      )}

      {/* ── FEATURE FLAGS TAB ── */}
      {tab === "features" && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            Feature flaglar klinikaning xulq-atvorini boshqaradi. O'zgarishlar darhol kuchga kiradi.
          </div>

          <SectionCard title="Feature Flaglar">
            <div className="space-y-1">
              {features.map((flag, idx) => (
                <div
                  key={flag.key}
                  className={`flex items-center justify-between px-4 py-3.5 rounded-xl transition-colors ${
                    idx % 2 === 0 ? "bg-gray-50" : "bg-white"
                  }`}
                >
                  <div>
                    <div className="text-sm font-medium text-gray-900">{flag.label}</div>
                    <div className="text-xs text-gray-400 mt-0.5 font-mono">{flag.key}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs font-medium ${
                        flag.enabled ? "text-green-600" : "text-gray-400"
                      }`}
                    >
                      {flag.enabled ? "Yoqilgan" : "O'chirilgan"}
                    </span>
                    <Toggle checked={flag.enabled} onChange={(v) => setFlag(flag.key, v)} />
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <div className="flex justify-end">
            <button
              onClick={saveFeatures}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-lg text-sm transition-colors"
            >
              {saving ? "Saqlanmoqda..." : "Flaglarni saqlash"}
            </button>
          </div>
        </div>
      )}

      {/* ── AUDIT TAB ── */}
      {tab === "audit" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">O'zgarishlar tarixi</h3>
          </div>
          {audit.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              Hozircha hech qanday o'zgarish qayd qilinmagan
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {audit.map((log) => (
                <div key={log.id} className="flex items-start gap-4 px-5 py-4">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500 text-sm flex-shrink-0 mt-0.5">
                    📝
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {ACTION_LABELS[log.action] ?? log.action}
                      </span>
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString("uz-UZ")}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 font-mono truncate">
                      actorId: {log.actorId}
                    </div>
                    {Object.keys(log.payload).length > 0 && (
                      <details className="mt-1.5">
                        <summary className="text-xs text-indigo-500 cursor-pointer hover:text-indigo-700">
                          Tafsilotlar ko'rsatish
                        </summary>
                        <pre className="mt-2 text-xs bg-gray-50 rounded-lg p-3 overflow-x-auto text-gray-600 max-h-32">
                          {JSON.stringify(log.payload, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
