"use client";
import { useEffect, useState } from "react";

interface LimitSettings {
  patientSelfLimit: number;
  dependentBookingLimit: number;
  maxDependents: number;
  discountPercent: number;
}

interface FullSettings extends LimitSettings {
  showRatingCount: boolean;
}

type SettingsKey = keyof LimitSettings;

interface FieldMeta {
  key: SettingsKey;
  label: string;
  min: number;
  max: number;
  hint: string;
  example: string;
}

const FIELDS: FieldMeta[] = [
  {
    key: "discountPercent",
    label: "Klinika chegirma foizi",
    min: 0,
    max: 100,
    hint: "Qabulxona xodimi 'chegirma' tugmasini bosganda, bemor shu foizda kam to'laydi. 0 qo'ysangiz, chegirma tugmasi umuman ko'rinmaydi. Diapazon: 0 dan 100 gacha.",
    example: "Masalan 60% qo'ysangiz, 100 000 so'mlik qabulda bemor 40 000 so'm to'laydi. 100% = bemor bepul (0 so'm). 0 = chegirma o'chiq.",
  },
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

const DEFAULT_SETTINGS: FullSettings = {
  patientSelfLimit: 4,
  dependentBookingLimit: 1,
  maxDependents: 2,
  discountPercent: 0,
  showRatingCount: false,
};

function toInputMap(s: LimitSettings): Record<SettingsKey, string> {
  return {
    patientSelfLimit: String(s.patientSelfLimit),
    dependentBookingLimit: String(s.dependentBookingLimit),
    maxDependents: String(s.maxDependents),
    discountPercent: String(s.discountPercent),
  };
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<FullSettings>(DEFAULT_SETTINGS);
  // inputValues — foydalanuvchi yozayotgan raw string (bo'sh bo'lishi mumkin)
  const [inputValues, setInputValues] = useState<Record<SettingsKey, string>>(
    toInputMap(DEFAULT_SETTINGS)
  );
  const [showRatingCount, setShowRatingCount] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/clinic-settings")
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) {
          setSettings(res.data);
          setInputValues(toInputMap(res.data));
          setShowRatingCount(res.data.showRatingCount ?? false);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleChange(key: SettingsKey, raw: string) {
    // raw string ni har doim saqlash — foydalanuvchi erkin o'zgartirsin
    setInputValues((prev) => ({ ...prev, [key]: raw }));
    // Faqat to'g'ri son bo'lsa settings'ni yangilaymiz
    const val = parseInt(raw, 10);
    if (!isNaN(val)) {
      setSettings((prev) => ({ ...prev, [key]: val }));
    }
  }

  function handleBlur(key: SettingsKey) {
    // Focus ketganda: bo'sh yoki noto'g'ri bo'lsa, eski qiymatni qaytaramiz
    const raw = inputValues[key];
    const val = parseInt(raw, 10);
    if (isNaN(val)) {
      setInputValues((prev) => ({ ...prev, [key]: String(settings[key]) }));
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/clinic-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...settings, showRatingCount }),
      });
      const data = await res.json();
      if (data.success) {
        setSettings(data.data);
        setInputValues(toInputMap(data.data));
        setShowRatingCount(data.data.showRatingCount ?? false);
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
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Klinika sozlamalari</h1>
        <p className="text-sm text-gray-500 mt-1">
          Chegirma, bron limitleri va boshqa sozlamalar. Faqat sizning klinikangizga taalluqli.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {FIELDS.map((f) => {
          const numVal = settings[f.key];
          const invalid = typeof numVal !== "number" || numVal < f.min || numVal > f.max;
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
                    value={inputValues[f.key]}
                    onChange={(e) => handleChange(f.key, e.target.value)}
                    onBlur={() => handleBlur(f.key)}
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

        {/* showRatingCount toggle */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-1">
              <span className="block text-sm font-medium text-gray-900">
                Reyting sonini ko'rsatish
              </span>
              <p className="text-xs text-gray-500 leading-relaxed">
                Yoqilsa, shifokor reytingi yonida baholashlar soni (masalan 4.8 ★ · 23) ko'rinadi.
                O'chirilsa, faqat yulduz ko'rinadi, son yashiriladi.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={showRatingCount}
              onClick={() => setShowRatingCount((v) => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                showRatingCount ? "bg-blue-600" : "bg-gray-200"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
                  showRatingCount ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

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
