"use client";
import { useEffect, useState } from "react";
import { Stack } from "@/components/layout";

function normalizeEmId(raw: string): string {
  const t = raw.trim().toUpperCase();
  const m = t.match(/^EM0*(\d+)$/);
  if (!m) return t;
  const n = m[1];
  return "EM" + (n.length >= 6 ? n : n.padStart(6, "0"));
}

type Tab = "doctors" | "services";
type Source = "em" | "service" | "manual";

interface Service {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
  isHidden: boolean;
}

interface EmPreview {
  id: string;
  emId: string;
  firstName: string;
  lastName: string | null;
  specialty: string | null;
  compositeRating: number | null;
  photoUrl: string | null;
}

interface Props {
  tab: Tab;
  block?: {
    id: string;
    source: string;
    employeeId: string | null;
    serviceId: string | null;
    title: string;
    subtitle: string | null;
    showRating: boolean;
    cta: string;
  } | null;
  limits: { allowedFormats: string[] } | null;
  onClose: () => void;
  onSaved: () => void;
}

export function ShowcaseBlockForm({ tab, block, onClose, onSaved }: Props) {
  const [source, setSource] = useState<Source>((block?.source as Source) ?? "manual");
  const [emInput, setEmInput] = useState("");
  const [emPreview, setEmPreview] = useState<EmPreview | null>(null);
  const [emLookupState, setEmLookupState] = useState<"idle" | "loading" | "notfound">("idle");
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState(block?.serviceId ?? "");
  const [title, setTitle] = useState(block?.title ?? "");
  const [subtitle, setSubtitle] = useState(block?.subtitle ?? "");
  const [showRating, setShowRating] = useState(block?.showRating !== false);
  const [cta, setCta] = useState<"auto" | "generic" | "none">((block?.cta as "auto" | "generic" | "none") ?? "auto");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/services", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setServices(j.data.filter((s: Service) => s.isActive && !s.isHidden));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (source !== "em") return;
    const raw = emInput.trim();
    if (!raw) { setEmPreview(null); setEmLookupState("idle"); return; }
    const normalized = normalizeEmId(raw);
    if (!/^EM\d{6,}$/.test(normalized)) { setEmPreview(null); setEmLookupState("idle"); return; }
    setEmLookupState("loading");
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/em-lookup?emId=${normalized}`, { credentials: "include" });
        const j = await res.json();
        if (j.success) {
          setEmPreview(j.data);
          setTitle(`${j.data.firstName}${j.data.lastName ? " " + j.data.lastName : ""}`);
          setSubtitle(j.data.specialty ?? "");
          setEmLookupState("idle");
        } else {
          setEmPreview(null);
          setEmLookupState("notfound");
        }
      } catch {
        setEmPreview(null);
        setEmLookupState("notfound");
      }
    }, 500);
    return () => clearTimeout(t);
  }, [emInput, source]);

  function handleServiceChange(id: string) {
    setSelectedServiceId(id);
    const svc = services.find((s) => s.id === id);
    if (svc) {
      setTitle(svc.name);
      setSubtitle(`${svc.price.toLocaleString("uz-UZ")} so'm`);
    }
  }

  async function handleSave() {
    setErr(null);
    if (!title.trim()) { setErr("Sarlavha kerak"); return; }
    if (source === "em" && !emPreview) { setErr("EM ID bo'yicha xodim topilmadi"); return; }
    if (source === "service" && !selectedServiceId) { setErr("Xizmat tanlanmadi"); return; }
    setSaving(true);
    const payload: Record<string, unknown> = {
      tab,
      source,
      title: title.trim(),
      subtitle: subtitle.trim() || null,
      showRating,
      cta,
      employeeId: source === "em" ? emPreview?.id : null,
      serviceId: source === "service" ? selectedServiceId : null,
    };
    const url = block ? `/api/admin/showcase/blocks/${block.id}` : "/api/admin/showcase/blocks";
    const method = block ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const j = await res.json();
    setSaving(false);
    if (!j.success) { setErr(j.error?.message ?? "Saqlashda xato"); return; }
    onSaved();
  }

  const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <h2 className="text-base font-bold mb-4">{block ? "Blokni tahrirlash" : "Yangi blok qo'shish"}</h2>
      {err && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-700">
          {err}
        </div>
      )}
      <Stack gap={4}>
        {/* Manba */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Ma&apos;lumot manbai</p>
          <div className="flex gap-4">
            {(["em", "service", "manual"] as Source[]).map((s) => (
              <label key={s} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="source"
                  value={s}
                  checked={source === s}
                  onChange={() => { setSource(s); setEmPreview(null); setEmInput(""); }}
                  className="accent-blue-600"
                />
                {s === "em" ? "Shifokor (EM ID)" : s === "service" ? "Xizmat" : "Qo'lda"}
              </label>
            ))}
          </div>
        </div>

        {/* EM ID */}
        {source === "em" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">EM ID</label>
            <input
              type="text"
              placeholder="Masalan: EM000001"
              value={emInput}
              onChange={(e) => setEmInput(e.target.value)}
              className={inputCls}
            />
            {emLookupState === "loading" && (
              <p className="text-xs text-gray-400 mt-1">Qidirilmoqda...</p>
            )}
            {emLookupState === "notfound" && (
              <p className="text-xs text-red-500 mt-1">Xodim topilmadi</p>
            )}
            {emPreview && (
              <div className="mt-2 flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                {emPreview.photoUrl && (
                  <img
                    src={emPreview.photoUrl}
                    alt=""
                    className="w-8 h-8 rounded-full object-cover"
                  />
                )}
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {emPreview.firstName} {emPreview.lastName}
                  </p>
                  {emPreview.specialty && (
                    <p className="text-xs text-blue-600">{emPreview.specialty}</p>
                  )}
                  {emPreview.compositeRating && (
                    <p className="text-xs text-amber-500">★ {emPreview.compositeRating.toFixed(1)}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Xizmat dropdown */}
        {source === "service" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Xizmat</label>
            <select
              value={selectedServiceId}
              onChange={(e) => handleServiceChange(e.target.value)}
              className={inputCls + " bg-white"}
            >
              <option value="">— Xizmat tanlang —</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} — {s.price.toLocaleString("uz-UZ")} so&apos;m
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Sarlavha */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sarlavha</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Blok sarlavhasi"
            className={inputCls}
          />
        </div>

        {/* Subtitle */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Qo&apos;shimcha matn (ixtiyoriy)
          </label>
          <input
            type="text"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="Masalan: mutaxassislik yoki narx"
            className={inputCls}
          />
        </div>

        {/* showRating + cta */}
        <div className="flex gap-6 flex-wrap">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={showRating}
              onChange={(e) => setShowRating(e.target.checked)}
              className="accent-blue-600 w-4 h-4"
            />
            Reyting ko&apos;rsatilsin
          </label>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-700">Tugma:</span>
            <select
              value={cta}
              onChange={(e) => setCta(e.target.value as "auto" | "generic" | "none")}
              className="border border-gray-200 rounded-lg px-2 py-1 text-sm bg-white"
            >
              <option value="auto">Avtomatik</option>
              <option value="generic">Umumiy</option>
              <option value="none">Yashirin</option>
            </select>
          </div>
        </div>

        {/* Tugmalar */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-60"
          >
            {saving ? "Saqlanmoqda..." : block ? "Saqlash" : "Qo'shish"}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition"
          >
            Bekor
          </button>
        </div>
      </Stack>
    </div>
  );
}
