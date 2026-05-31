"use client";
import { useEffect, useState } from "react";

interface LimitSettings {
  patientSelfLimit: number;
  dependentBookingLimit: number;
  maxDependents: number;
}

interface FieldMeta {
  key: keyof LimitSettings;
  label: string;
  min: number;
  max: number;
  hint: string;
  example: string;
}

const FIELDS: FieldMeta[] = [
  {
    key: "patientSelfLimit",
    label: "Bemor o'zi uchun faol bron limiti",
    min: 1,
    max: 10,
    hint: "Bemor bir vaqtning o'zida nechta turli shifokorga navbat olishi mumkin. 0 bo'lsa bemor umuman navbat ola olmaydi — shuning uchun minimum 1.",
    example: "Masalan 4 qo'ysangiz, bemor 4 xil shifokorga navbat oladi. 5-shifokorga olish uchun avval bittasiga borib kelishi yoki bekor qilishi kerak.",
  },
  {
    key: "dependentBookingLimit",
    label: "Oila a'zosi uchun faol bron limiti",
    min: 0,
    max: 5,
    hint: "Har bir oila a'zosi (farzand, ota, ona) uchun bir vaqtda nechta navbat olish mumkin. 0 qo'ysangiz, oila a'zolari uchun navbat olish o'chadi.",
    example: "Masalan 1 qo'ysangiz, har bir a'zo bitta navbat oladi va uni bo'shatmaguncha (keldi yoki bekor) yangi navbat qilolmaydi.",
  },
  {
    key: "maxDependents",
    label: "Oila a'zolari soni limiti",
    min: 0,
    max: 5,
    hint: "Bemor profiliga nechta oila a'zosi qo'sha olishi mumkin (farzand, ota, ona, boshqalar). 0 qo'ysangiz, oila a'zosi qo'shish o'chadi.",
    example: "Masalan 2 qo'ysangiz, jami 2 ta a'zo qo'shiladi. 3-a'zo qo'shmoqchi bo'lsa tizim bloklaydi.",
  },
];

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<LimitSettings>({
    patientSelfLimit: 4,
    dependentBookingLimit: 1,
    maxDependents: 2,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/clinic-settings")
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) setSettings(res.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleChange(key: keyof LimitSettings, raw: string) {
    const val = parseInt(raw, 10);
    if (!isNaN(val)) setSettings((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/clinic-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: "ok", text: "Sozlamalar saqlandi!" });
      } else {
        setMessage({ type: "err", text: data.error?.message ?? "Xatolik yuz berdi" });
      }
    } catch {
      setMessage({ type: "err", text: "Tarmoq xatosi" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Bron limit sozlamalari</h1>
        <p className="text-sm text-gray-500 mt-1">
          Bemorlar va oila a'zolari uchun faol bron limitlarini belgilang. Bu sozlamalar faqat sizning klinikangizga taalluqli.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {FIELDS.map((f) => {
          const val = settings[f.key];
          const meta = FIELDS.find((x) => x.key === f.key)!;
          const invalid = typeof val !== "number" || val < meta.min || val > meta.max;
          return (
            <div
              key={f.key}
              className="bg-white border border-gray-200 rounded-xl p-4 md:p-5 space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1 space-y-1">
                  <label className="block text-sm font-medium text-gray-900">
                    {f.label}
                  </label>
                  <p className="text-xs text-gray-500 leading-relaxed">{f.hint}</p>
                  <p className="text-xs text-blue-600 leading-relaxed">{f.example}</p>
                </div>
                <div className="shrink-0 flex flex-col items-start sm:items-end gap-1">
                  <input
                    type="number"
                    min={f.min}
                    max={f.max}
                    value={val}
                    onChange={(e) => handleChange(f.key, e.target.value)}
                    className={`w-20 text-center px-2 py-2 text-lg font-semibold border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      invalid
                        ? "border-red-400 bg-red-50 text-red-700"
                        : "border-gray-300 bg-white text-gray-900"
                    }`}
                  />
                  <span className="text-xs text-gray-400">
                    {f.min}–{f.max} oralig'ida
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {message && (
          <div
            className={`px-4 py-3 rounded-lg text-sm font-medium ${
              message.type === "ok"
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {message.text}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {saving ? "Saqlanmoqda..." : "Sozlamalarni saqlash"}
        </button>
      </form>
    </div>
  );
}
