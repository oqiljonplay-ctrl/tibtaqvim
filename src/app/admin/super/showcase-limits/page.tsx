"use client";
import { useEffect, useState, useCallback } from "react";

interface Clinic {
  id: string;
  name: string;
  subscriptionPlan: string;
}

interface ShowcaseLimits {
  clinicId: string;
  maxBlocksDoctors: number;
  maxBlocksServices: number;
  maxMediaPerBlock: number;
  maxImageKb: number;
  maxGifKb: number;
  maxVideoKb: number;
  maxAudioKb: number;
  maxPdfKb: number;
  storageTotalMb: number;
  videoMaxSec: number;
  allowVideoUpload: boolean;
  allowedFormats: string[];
}

const ALL_FORMATS = ["image", "gif", "video", "audio", "youtube", "telegram", "pdf", "url"];
const FORMAT_LABEL: Record<string, string> = {
  image: "Rasm (upload)",
  gif: "GIF (upload)",
  video: "Video (upload)",
  audio: "Audio (upload)",
  youtube: "YouTube embed",
  telegram: "Telegram embed",
  pdf: "PDF (upload)",
  url: "Rasm (URL/havola)",
};

const NUM_FIELDS: { key: keyof ShowcaseLimits; label: string; hint: string; min: number; max: number }[] = [
  { key: "maxBlocksDoctors",  label: "Shifokor blok limiti",       hint: "tab=doctors uchun maksimal bloklar soni",   min: 0, max: 100 },
  { key: "maxBlocksServices", label: "Xizmat blok limiti",         hint: "tab=services uchun maksimal bloklar soni",  min: 0, max: 100 },
  { key: "maxMediaPerBlock",  label: "Blokdagi media limiti",       hint: "Bir blokda nechta media bo'lishi mumkin",   min: 0, max: 50  },
  { key: "maxImageKb",        label: "Rasm o'lchami (KB)",          hint: "Eng katta rasm hajmi kilobaytta",           min: 0, max: 51200 },
  { key: "maxGifKb",          label: "GIF o'lchami (KB)",           hint: "Eng katta GIF hajmi kilobaytta",            min: 0, max: 51200 },
  { key: "maxVideoKb",        label: "Video o'lchami (KB)",         hint: "Eng katta video hajmi kilobaytta",          min: 0, max: 51200 },
  { key: "maxAudioKb",        label: "Audio o'lchami (KB)",         hint: "Eng katta audio hajmi kilobaytta",          min: 0, max: 51200 },
  { key: "maxPdfKb",          label: "PDF o'lchami (KB)",           hint: "Eng katta PDF hajmi kilobaytta",            min: 0, max: 51200 },
  { key: "storageTotalMb",    label: "Jami storage limiti (MB)",    hint: "Klinika uchun umumiy storage hajmi",        min: 0, max: 5120  },
  { key: "videoMaxSec",       label: "Video davomiyligi (soniya)",  hint: "Video yuklash uchun maksimal davomiylik",   min: 0, max: 600   },
];

const DEFAULT_LIMITS: ShowcaseLimits = {
  clinicId: "",
  maxBlocksDoctors: 10,
  maxBlocksServices: 10,
  maxMediaPerBlock: 8,
  maxImageKb: 800,
  maxGifKb: 4000,
  maxVideoKb: 20480,
  maxAudioKb: 2000,
  maxPdfKb: 1500,
  storageTotalMb: 100,
  videoMaxSec: 60,
  allowVideoUpload: false,
  allowedFormats: ["image", "gif", "audio", "youtube", "telegram", "pdf", "url"],
};

export default function SuperShowcaseLimitsPage() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [clinicsLoading, setClinicsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");
  const [limits, setLimits] = useState<ShowcaseLimits | null>(null);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [limitsLoading, setLimitsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/super/clinics", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => { if (j.success) setClinics(j.data); })
      .finally(() => setClinicsLoading(false));
  }, []);

  const loadLimits = useCallback(async (id: string) => {
    if (!id) return;
    setLimitsLoading(true); setMsg(null); setLimits(null);
    const r = await fetch(`/api/admin/super/clinics/${id}/showcase-limits`, { credentials: "include" });
    const j = await r.json();
    if (j.success) {
      const l: ShowcaseLimits = j.data.limits;
      setLimits(l);
      const inp: Record<string, string> = {};
      NUM_FIELDS.forEach((f) => { inp[f.key] = String((l as unknown as Record<string, unknown>)[f.key] ?? 0); });
      setInputs(inp);
    } else {
      setMsg({ type: "err", text: j.error?.message ?? "Limitlarni yuklashda xato" });
    }
    setLimitsLoading(false);
  }, []);

  useEffect(() => { if (selectedId) loadLimits(selectedId); }, [selectedId, loadLimits]);

  function handleNum(key: string, raw: string) {
    setInputs((p) => ({ ...p, [key]: raw }));
    const n = parseInt(raw, 10);
    if (!isNaN(n) && limits) {
      setLimits((prev) => prev ? { ...prev, [key]: n } : prev);
    }
  }

  function handleBlur(key: string, min: number) {
    const n = parseInt(inputs[key], 10);
    if (isNaN(n) && limits) {
      setInputs((p) => ({ ...p, [key]: String((limits as unknown as Record<string, unknown>)[key] ?? min) }));
    }
  }

  function toggleFormat(fmt: string) {
    if (!limits) return;
    const cur = limits.allowedFormats ?? [];
    setLimits((prev) => prev ? {
      ...prev,
      allowedFormats: cur.includes(fmt) ? cur.filter((f) => f !== fmt) : [...cur, fmt],
    } : prev);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!limits || !selectedId) return;
    setSaving(true); setMsg(null);
    try {
      const body: Record<string, unknown> = { allowVideoUpload: limits.allowVideoUpload, allowedFormats: limits.allowedFormats };
      NUM_FIELDS.forEach((f) => {
        const n = parseInt(inputs[f.key], 10);
        body[f.key] = isNaN(n) ? (limits as unknown as Record<string, unknown>)[f.key] : n;
      });
      const r = await fetch(`/api/admin/super/clinics/${selectedId}/showcase-limits`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (j.success) {
        setLimits(j.data.limits);
        const inp: Record<string, string> = {};
        NUM_FIELDS.forEach((f) => { inp[f.key] = String((j.data.limits as Record<string, unknown>)[f.key] ?? 0); });
        setInputs(inp);
        setMsg({ type: "ok", text: "Limitlar saqlandi!" });
      } else {
        setMsg({ type: "err", text: j.error?.message ?? "Saqlashda xato" });
      }
    } catch {
      setMsg({ type: "err", text: "Tarmoq xatosi" });
    } finally {
      setSaving(false);
    }
  }

  const selectedClinic = clinics.find((c) => c.id === selectedId);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Vitrina limitlari</h1>
        <p className="text-sm text-gray-500 mt-1">
          Klinika tanlang va reklama vitrina blok/media limitlarini o&apos;rnating.
        </p>
      </div>

      {/* Klinika tanlash */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Klinika</label>
        {clinicsLoading ? (
          <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
        ) : (
          <select
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            <option value="">— klinika tanlang —</option>
            {clinics.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.subscriptionPlan})
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Limitlar formasi */}
      {selectedId && (
        limitsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : limits ? (
          <form onSubmit={save} className="space-y-4">
            {selectedClinic && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 text-sm text-blue-700 font-medium">
                {selectedClinic.name} — limit sozlamalari
              </div>
            )}

            {/* Raqamli maydonlar */}
            <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
              {NUM_FIELDS.map((f) => {
                const val = parseInt(inputs[f.key] ?? "0", 10);
                const invalid = isNaN(val) || val < f.min || val > f.max;
                return (
                  <div key={f.key} className="px-4 py-3 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800">{f.label}</div>
                      <div className="text-xs text-gray-400">{f.hint} ({f.min}–{f.max})</div>
                    </div>
                    <input
                      type="number"
                      min={f.min}
                      max={f.max}
                      value={inputs[f.key] ?? "0"}
                      onChange={(e) => handleNum(f.key, e.target.value)}
                      onBlur={() => handleBlur(f.key, f.min)}
                      className={`w-24 text-center px-2 py-1.5 text-sm font-semibold border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        invalid ? "border-red-400 bg-red-50 text-red-700" : "border-gray-300 bg-white text-gray-900"
                      }`}
                    />
                  </div>
                );
              })}
            </div>

            {/* Video yuklash toggle */}
            <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-800">Video yuklashga ruxsat</div>
                <div className="text-xs text-gray-400">O&apos;chirilgan bo&apos;lsa faqat YouTube/Telegram embed ishlaydi</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={limits.allowVideoUpload}
                onClick={() => setLimits((p) => p ? { ...p, allowVideoUpload: !p.allowVideoUpload } : p)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  limits.allowVideoUpload ? "bg-blue-600" : "bg-gray-200"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
                    limits.allowVideoUpload ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Ruxsat etilgan formatlar */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="text-sm font-medium text-gray-800 mb-3">Ruxsat etilgan formatlar</div>
              <div className="grid grid-cols-2 gap-2">
                {ALL_FORMATS.map((fmt) => {
                  const checked = limits.allowedFormats?.includes(fmt) ?? false;
                  return (
                    <label
                      key={fmt}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                        checked ? "border-blue-300 bg-blue-50" : "border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleFormat(fmt)}
                        className="accent-blue-600"
                      />
                      <span className="text-sm text-gray-700">{FORMAT_LABEL[fmt] ?? fmt}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Xabar */}
            {msg && (
              <div className={`px-4 py-3 rounded-lg text-sm font-medium border ${
                msg.type === "ok"
                  ? "bg-green-50 text-green-700 border-green-200"
                  : "bg-red-50 text-red-700 border-red-200"
              }`}>
                {msg.text}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saving ? "Saqlanmoqda..." : "Limitlarni saqlash"}
            </button>
          </form>
        ) : null
      )}
    </div>
  );
}
