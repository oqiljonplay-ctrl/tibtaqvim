"use client";
import { useEffect, useState, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Clinic {
  id: string;
  name: string;
  subscriptionPlan: string;
}

interface AdChannel {
  id: string;
  title: string;
  chatId: string;
  type: string;
  username: string | null;
  memberCount: number | null;
  scope: "clinic" | "platform";
  clinicId: string | null;
  isActive: boolean;
  addedAt: string;
  clinic: { id: string; name: string } | null;
  _count: { posts: number };
  botStatus?: { isAdmin: boolean; status: string } | null;
}

interface AdCampaign {
  id: string;
  title: string;
  adText: string;
  imageUrl: string | null;
  buttonText: string | null;
  buttonUrl: string | null;
  targetType: "own" | "platform";
  startDate: string;
  endDate: string;
  frequency: string;
  status: "draft" | "scheduled" | "active" | "completed" | "cancelled";
  priority: number;
  clinic: { id: string; name: string; subscriptionPlan: string };
  channels: { channel: { id: string; title: string; type: string; scope: string } }[];
  _count: { posts: number };
}

interface Stats {
  channels: { total: number; active: number; platform: number };
  campaigns: { total: number; active: number };
  posts: { sent: number; failed: number };
  recentPosts: {
    id: string;
    status: string;
    sentAt: string;
    campaign: { title: string };
    channel: { title: string; type: string };
  }[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  draft:     "bg-gray-100 text-gray-600",
  scheduled: "bg-blue-100 text-blue-700",
  active:    "bg-green-100 text-green-700",
  completed: "bg-slate-100 text-slate-500",
  cancelled: "bg-red-100 text-red-600",
};
const STATUS_LABEL: Record<string, string> = {
  draft: "Qoralama", scheduled: "Rejalashtirilgan",
  active: "Faol", completed: "Tugagan", cancelled: "Bekor",
};

// vercel.json da "0 8 * * *" — har kuni 08:00 UTC
function nextCronTime(): string {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(8, 0, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next.toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });
}

// ─── Channel Add Modal (Faza 2 — 2 yo'l) ─────────────────────────────────────

function ChannelAddModal({
  onClose, onSaved,
}: { onClose: () => void; onSaved: () => void }) {
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [form, setForm] = useState({ title: "", chatId: "", type: "channel", username: "", memberCount: "" });
  const [lookupInput, setLookupInput] = useState("");
  const [looking, setLooking] = useState(false);
  const [lookupResult, setLookupResult] = useState<{ chatId: string; title: string; type: string; memberCount: number | null; username: string | null; isAdmin: boolean } | null>(null);
  const [lookupErr, setLookupErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function lookup() {
    if (!lookupInput.trim()) return;
    setLooking(true); setLookupErr(""); setLookupResult(null);
    try {
      const r = await fetch(`/api/admin/ad-channels/lookup?username=${encodeURIComponent(lookupInput.trim())}`);
      const j = await r.json();
      if (j.success) {
        setLookupResult(j.data);
        setForm({
          title:       j.data.title,
          chatId:      j.data.chatId,
          type:        j.data.type,
          username:    j.data.username ?? "",
          memberCount: j.data.memberCount ? String(j.data.memberCount) : "",
        });
      } else {
        setLookupErr(j.error?.message ?? "Kanal topilmadi");
      }
    } finally {
      setLooking(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setErr("");
    try {
      const r = await fetch("/api/admin/ad-channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          memberCount: form.memberCount ? Number(form.memberCount) : null,
        }),
      });
      const j = await r.json();
      if (j.success) { onSaved(); onClose(); }
      else setErr(j.error?.message ?? "Xatolik");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Kanal/guruh qo&apos;shish</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        {/* Mode tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setMode("auto")}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${mode === "auto" ? "text-indigo-600 border-b-2 border-indigo-600" : "text-gray-500 hover:text-gray-700"}`}
          >
            Avtomatik (tavsiya)
          </button>
          <button
            onClick={() => setMode("manual")}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${mode === "manual" ? "text-indigo-600 border-b-2 border-indigo-600" : "text-gray-500 hover:text-gray-700"}`}
          >
            Qo&apos;lda kiritish
          </button>
        </div>

        {mode === "auto" ? (
          <div className="px-6 py-5 space-y-4">
            {/* Yo'l 1 instruction */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm text-indigo-700 space-y-2">
              <p className="font-semibold">Botni admin qilish orqali (eng oson):</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Botni kanal/guruhingizga qo&apos;shing</li>
                <li>Botni <strong>admin</strong> qiling</li>
                <li>Bot avtomatik shu yerda paydo bo&apos;ladi</li>
              </ol>
              <p className="text-xs text-indigo-500">Bot username: @{process.env.NEXT_PUBLIC_BOT_USERNAME ?? "bot"}</p>
            </div>
            {/* Yo'l 2 — username lookup */}
            <div>
              <label className="text-xs font-medium text-gray-600">Yoki username orqali qo&apos;shing</label>
              <div className="mt-1 flex gap-2">
                <input
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  value={lookupInput} onChange={(e) => setLookupInput(e.target.value)}
                  placeholder="@klinika_kanali yoki t.me/..."
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), lookup())}
                />
                <button
                  type="button" onClick={lookup} disabled={looking || !lookupInput.trim()}
                  className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {looking ? "..." : "Topish"}
                </button>
              </div>
              {lookupErr && <p className="text-xs text-red-600 mt-1">{lookupErr}</p>}
              {lookupResult && (
                <div className={`mt-2 border rounded-lg px-3 py-2.5 text-xs space-y-1 ${lookupResult.isAdmin ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-800">{lookupResult.title}</span>
                    <span className="text-gray-500">{lookupResult.type}</span>
                  </div>
                  <div className="text-gray-500 font-mono">{lookupResult.chatId}</div>
                  {lookupResult.memberCount && <div className="text-gray-500">{lookupResult.memberCount.toLocaleString()} a&apos;zo</div>}
                  <div className={lookupResult.isAdmin ? "text-green-700" : "text-amber-700"}>
                    {lookupResult.isAdmin ? "✅ Bot admin — yuborishga tayyor" : "⚠️ Bot admin emas — botni admin qiling"}
                  </div>
                </div>
              )}
            </div>

            {lookupResult && (
              <form onSubmit={submit} className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Nomi</label>
                  <input
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required
                  />
                </div>
                {err && <p className="text-red-600 text-xs">{err}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={onClose}
                    className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                    Bekor
                  </button>
                  <button type="submit" disabled={saving}
                    className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                    {saving ? "Saqlanmoqda..." : "Qo&apos;shish"}
                  </button>
                </div>
              </form>
            )}
            {!lookupResult && (
              <button onClick={onClose}
                className="w-full py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Yopish
              </button>
            )}
          </div>
        ) : (
          // Qo'lda kiritish
          <form onSubmit={submit} className="px-6 py-4 space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Nomi *</label>
              <input
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Klinika rasmiy kanali" required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Chat ID *</label>
              <input
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
                value={form.chatId} onChange={(e) => setForm({ ...form, chatId: e.target.value })}
                placeholder="-1001234567890" required
              />
              <p className="text-xs text-gray-400 mt-1">Bot kanal/guruhga admin bo&apos;lishi shart</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Tur</label>
                <select className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="channel">Kanal</option>
                  <option value="group">Guruh</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">A&apos;zolar</label>
                <input type="number" min="0"
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={form.memberCount} onChange={(e) => setForm({ ...form, memberCount: e.target.value })}
                  placeholder="5000"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Username</label>
              <input
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="@kanalusername"
              />
            </div>
            {err && <p className="text-red-600 text-xs">{err}</p>}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Bekor
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                {saving ? "Saqlanmoqda..." : "Qo&apos;shish"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Channel Edit Modal ────────────────────────────────────────────────────────

function ChannelEditModal({
  channel, onClose, onSaved,
}: { channel: AdChannel; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    title:       channel.title,
    username:    channel.username ?? "",
    memberCount: channel.memberCount ? String(channel.memberCount) : "",
    isActive:    channel.isActive,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setErr("");
    try {
      const r = await fetch(`/api/admin/ad-channels/${channel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:       form.title,
          username:    form.username || null,
          memberCount: form.memberCount ? Number(form.memberCount) : null,
          isActive:    form.isActive,
        }),
      });
      const j = await r.json();
      if (j.success) { onSaved(); onClose(); }
      else setErr(j.error?.message ?? "Xatolik");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Kanalni tahrirlash</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        <form onSubmit={submit} className="px-6 py-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600">Nomi</label>
            <input
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required
            />
          </div>
          <div className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2 font-mono">
            {channel.chatId} &nbsp;·&nbsp; {channel.scope === "platform" ? "Umumiy platform" : `Klinika: ${channel.clinic?.name ?? "?"}`}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Username</label>
              <input
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="@kanalusername"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">A&apos;zolar</label>
              <input type="number" min="0"
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.memberCount} onChange={(e) => setForm({ ...form, memberCount: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Holat</label>
            <select
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={form.isActive ? "1" : "0"} onChange={(e) => setForm({ ...form, isActive: e.target.value === "1" })}
            >
              <option value="1">Faol</option>
              <option value="0">Nofaol</option>
            </select>
          </div>
          {err && <p className="text-red-600 text-xs">{err}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              Bekor
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {saving ? "Saqlanmoqda..." : "Saqlash"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Campaign Modal (Faza 1 — targetType/scope yashirin) ──────────────────────

function CampaignModal({
  clinics, channels, onClose, onSaved, editing,
}: {
  clinics: Clinic[];
  channels: AdChannel[];
  onClose: () => void;
  onSaved: () => void;
  editing?: AdCampaign;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    clinicId:   editing?.clinic.id ?? "",
    title:      editing?.title ?? "",
    adText:     editing?.adText ?? "",
    imageUrl:   editing?.imageUrl ?? "",
    buttonText: editing?.buttonText ?? "",
    buttonUrl:  editing?.buttonUrl ?? "",
    startDate:  editing?.startDate ? editing.startDate.slice(0, 10) : today,
    endDate:    editing?.endDate ? editing.endDate.slice(0, 10) : today,
    frequency:  editing?.frequency ?? "daily",
    status:     editing?.status ?? "scheduled",
    priority:   String(editing?.priority ?? 0),
    channelIds: editing?.channels.map((c) => c.channel.id) ?? [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // super_admin: barcha faol kanallar
  const availableChannels = channels.filter((ch) => ch.isActive);

  function toggleChannel(id: string) {
    setForm((f) => ({
      ...f,
      channelIds: f.channelIds.includes(id)
        ? f.channelIds.filter((c) => c !== id)
        : [...f.channelIds, id],
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.channelIds.length === 0) { setErr("Kamida bitta kanal yoki guruh tanlang."); return; }
    setSaving(true); setErr("");
    try {
      const url = editing ? `/api/admin/ad-campaigns/${editing.id}` : "/api/admin/ad-campaigns";
      const method = editing ? "PATCH" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, priority: Number(form.priority) }),
      });
      const j = await r.json();
      if (j.success) { onSaved(); onClose(); }
      else setErr(j.error?.message ?? "Xatolik");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl my-4">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">
            {editing ? "Kampaniyani tahrirlash" : "Yangi kampaniya"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        <form onSubmit={submit} className="px-6 py-4 space-y-3">
          {!editing && (
            <div>
              <label className="text-xs font-medium text-gray-600">Klinika *</label>
              <select
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.clinicId}
                onChange={(e) => setForm({ ...form, clinicId: e.target.value })}
                required
              >
                <option value="">— tanlang —</option>
                {clinics.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.subscriptionPlan})</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-gray-600">Sarlavha *</label>
            <input
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Klinika — May aksiya" required
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Reklama matni *</label>
            <textarea rows={4}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              value={form.adText} onChange={(e) => setForm({ ...form, adText: e.target.value })}
              placeholder="HTML qo'llab-quvvatlanadi: <b>bold</b>, <i>italic</i>"
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Rasm URL</label>
            <input
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              placeholder="https://..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Tugma matni</label>
              <input className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.buttonText} onChange={(e) => setForm({ ...form, buttonText: e.target.value })}
                placeholder="Navbat olish"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Tugma URL</label>
              <input className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.buttonUrl} onChange={(e) => setForm({ ...form, buttonUrl: e.target.value })}
                placeholder="https://t.me/..."
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Chastota</label>
              <select className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
                <option value="daily">Kuniga 1 marta</option>
                <option value="twice_daily">Kuniga 2 marta</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Status</label>
              <select className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as never })}>
                <option value="draft">Qoralama</option>
                <option value="scheduled">Rejalashtirilgan</option>
                <option value="active">Faol</option>
                <option value="cancelled">Bekor</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Boshlanish *</label>
              <input type="date" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Tugash *</label>
              <input type="date" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required />
            </div>
          </div>

          {/* Kanallar tanlash */}
          <div>
            <label className="text-xs font-medium text-gray-600">
              Kanal/guruhlar{" "}
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${form.channelIds.length > 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {form.channelIds.length} tanlangan
              </span>
            </label>
            {availableChannels.length > 0 ? (
              <div className="mt-1 border border-gray-200 rounded-lg divide-y divide-gray-50 max-h-44 overflow-y-auto">
                {availableChannels.map((ch) => (
                  <label key={ch.id}
                    className={`flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer ${form.channelIds.includes(ch.id) ? "bg-indigo-50/50" : ""}`}>
                    <input
                      type="checkbox"
                      checked={form.channelIds.includes(ch.id)}
                      onChange={() => toggleChannel(ch.id)}
                      className="rounded accent-indigo-600"
                    />
                    <span className="text-sm text-gray-800 flex-1">{ch.title}</span>
                    <span className="text-xs text-gray-400">{ch.type === "channel" ? "📢" : "👥"}</span>
                    {ch.memberCount && <span className="text-xs text-gray-400">{ch.memberCount.toLocaleString()}</span>}
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${ch.scope === "platform" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                      {ch.scope === "platform" ? "Umumiy" : "Klinika"}
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="mt-1 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-700">
                Faol kanal yo&apos;q. Avval &quot;Kanallar&quot; tabidan kanal qo&apos;shing.
              </div>
            )}
            {form.channelIds.length === 0 && availableChannels.length > 0 && (
              <p className="text-xs text-red-500 mt-1">Kamida bitta kanal yoki guruh tanlang.</p>
            )}
          </div>

          {err && <p className="text-red-600 text-xs">{err}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              Bekor
            </button>
            <button type="submit" disabled={saving || form.channelIds.length === 0}
              className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {saving ? "Saqlanmoqda..." : editing ? "Yangilash" : "Yaratish"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Send Now Confirmation Modal ──────────────────────────────────────────────

function ConfirmSendModal({
  campaign, onConfirm, onClose, sending,
}: {
  campaign: AdCampaign;
  onConfirm: () => void;
  onClose: () => void;
  sending: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Hozir yuborishni tasdiqlang</h3>
        </div>
        <div className="px-6 py-4 space-y-3">
          <p className="text-sm text-gray-700">
            <span className="font-semibold">&ldquo;{campaign.title}&rdquo;</span> xabari quyidagi kanallarga yuboriladi:
          </p>
          <div className="border border-gray-100 rounded-lg divide-y divide-gray-50 max-h-32 overflow-y-auto">
            {campaign.channels.map((cc) => (
              <div key={cc.channel.id} className="px-3 py-2 flex items-center gap-2 text-sm">
                <span>{cc.channel.type === "channel" ? "📢" : "👥"}</span>
                <span className="text-gray-800">{cc.channel.title}</span>
              </div>
            ))}
          </div>
          {campaign.channels.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
              ⚠️ Kanal biriktirilmagan — yuborish mumkin emas.
            </div>
          )}
        </div>
        <div className="px-6 pb-4 flex gap-2">
          <button onClick={onClose} disabled={sending}
            className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            Bekor
          </button>
          <button onClick={onConfirm} disabled={sending || campaign.channels.length === 0}
            className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
            {sending ? "Yuborilmoqda..." : "Ha, yuborish"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Send Now Result Modal ─────────────────────────────────────────────────────

function SendNowResult({
  result, onClose,
}: {
  result: { sent: number; failed: number; warning?: string; results?: { channelTitle: string; status: string; error?: string }[] };
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Yuborish natijasi</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        <div className="px-6 py-4 space-y-3">
          {result.warning ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-sm text-amber-700">
              {result.warning}
            </div>
          ) : (
            <>
              <div className="flex gap-4">
                <div className="flex-1 bg-green-50 rounded-xl px-3 py-3 text-center">
                  <div className="text-3xl font-bold text-green-600">{result.sent}</div>
                  <div className="text-xs text-green-500 mt-1">Yuborildi</div>
                </div>
                <div className="flex-1 bg-red-50 rounded-xl px-3 py-3 text-center">
                  <div className="text-3xl font-bold text-red-500">{result.failed}</div>
                  <div className="text-xs text-red-400 mt-1">Xatolik</div>
                </div>
              </div>
              {result.results && result.results.length > 0 && (
                <div className="border border-gray-100 rounded-lg divide-y divide-gray-50">
                  {result.results.map((r, i) => (
                    <div key={i} className="px-3 py-2 flex items-center justify-between gap-2">
                      <span className="text-sm text-gray-700 truncate">{r.channelTitle}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${r.status === "sent" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                        {r.status === "sent" ? "✓ yuborildi" : r.error ?? "xato"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          <button onClick={onClose}
            className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">
            Yopish
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = "stats" | "channels" | "campaigns";

export default function AdsPage() {
  const [tab, setTab] = useState<Tab>("stats");
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [channels, setChannels] = useState<AdChannel[]>([]);
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const [showChannelModal, setShowChannelModal] = useState(false);
  const [editingChannel, setEditingChannel] = useState<AdChannel | undefined>();
  const [editingCampaign, setEditingCampaign] = useState<AdCampaign | undefined>();
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [confirmSend, setConfirmSend] = useState<AdCampaign | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number; warning?: string; results?: { channelTitle: string; status: string; error?: string }[] } | null>(null);
  const [botChecking, setBotChecking] = useState<Record<string, boolean>>({});
  const [botStatus, setBotStatus] = useState<Record<string, { isAdmin: boolean; status: string }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const [cl, ch, ca, st] = await Promise.all([
      fetch("/api/admin/super/clinics").then((r) => r.json()),
      fetch("/api/admin/ad-channels").then((r) => r.json()),
      fetch("/api/admin/ad-campaigns").then((r) => r.json()),
      fetch("/api/admin/ad-stats").then((r) => r.json()),
    ]);
    if (cl.success) setClinics(cl.data);
    if (ch.success) setChannels(ch.data);
    if (ca.success) setCampaigns(ca.data);
    if (st.success) setStats(st.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function checkBotStatus(ch: AdChannel) {
    setBotChecking((prev) => ({ ...prev, [ch.id]: true }));
    try {
      const r = await fetch(`/api/admin/ad-channels/${ch.id}/bot-status`);
      const j = await r.json();
      if (j.success) setBotStatus((prev) => ({ ...prev, [ch.id]: j.data }));
    } finally {
      setBotChecking((prev) => ({ ...prev, [ch.id]: false }));
    }
  }

  async function toggleChannelActive(ch: AdChannel) {
    await fetch(`/api/admin/ad-channels/${ch.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !ch.isActive }),
    });
    load();
  }

  async function deleteChannel(ch: AdChannel) {
    if (!confirm(`"${ch.title}" kanalni o'chirasizmi?`)) return;
    await fetch(`/api/admin/ad-channels/${ch.id}`, { method: "DELETE" });
    load();
  }

  async function cancelCampaign(c: AdCampaign) {
    if (!confirm(`"${c.title}" kampaniyani bekor qilasizmi?`)) return;
    await fetch(`/api/admin/ad-campaigns/${c.id}`, { method: "DELETE" });
    load();
  }

  async function doSendNow() {
    if (!confirmSend) return;
    setSendingId(confirmSend.id);
    try {
      const r = await fetch(`/api/admin/ad-campaigns/${confirmSend.id}/send-now`, { method: "POST" });
      const j = await r.json();
      setConfirmSend(null);
      if (j.success) { setSendResult(j.data); load(); }
    } finally {
      setSendingId(null);
    }
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "stats", label: "Statistika", icon: "📊" },
    { key: "channels", label: "Kanallar", icon: "📡" },
    { key: "campaigns", label: "Kampaniyalar", icon: "📢" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reklamalar</h1>
          <p className="text-sm text-gray-500 mt-1">Kanal/guruh broadcast boshqaruvi</p>
        </div>
        <div className="flex gap-2">
          {tab === "channels" && (
            <button onClick={() => setShowChannelModal(true)}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700">
              + Kanal qo&apos;shish
            </button>
          )}
          {tab === "campaigns" && (
            <button onClick={() => { setEditingCampaign(undefined); setShowCampaignModal(true); }}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700">
              + Kampaniya yaratish
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              tab === t.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-gray-400 py-12 justify-center">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Yuklanmoqda...</span>
        </div>
      ) : (
        <>
          {/* ── Stats tab ── */}
          {tab === "stats" && stats && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {[
                  { label: "Jami kanallar", value: stats.channels.total, icon: "📡", color: "bg-blue-50" },
                  { label: "Faol kanallar", value: stats.channels.active, icon: "✅", color: "bg-green-50" },
                  { label: "Platform kanallar", value: stats.channels.platform, icon: "🌐", color: "bg-purple-50" },
                  { label: "Faol kampaniya", value: stats.campaigns.active, icon: "📢", color: "bg-indigo-50" },
                  { label: "Yuborilgan postlar", value: stats.posts.sent, icon: "✉️", color: "bg-teal-50" },
                ].map((card) => (
                  <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${card.color}`}>{card.icon}</div>
                    <div>
                      <div className="text-xl font-bold text-gray-900">{card.value}</div>
                      <div className="text-xs text-gray-500">{card.label}</div>
                    </div>
                  </div>
                ))}
              </div>

              {stats.posts.failed > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 flex items-center gap-3">
                  <span className="text-xl">⚠️</span>
                  <div>
                    <div className="text-sm font-medium text-red-700">{stats.posts.failed} ta post yuborilmadi</div>
                    <div className="text-xs text-red-500">Bot kanaldan chiqarilgan yoki admin huquqi yo&apos;q bo&apos;lishi mumkin</div>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-900">So&apos;nggi postlar</h2>
                </div>
                <div className="divide-y divide-gray-50">
                  {stats.recentPosts.length === 0 && (
                    <div className="px-5 py-8 text-center text-gray-400 text-sm">Hali postlar yo&apos;q</div>
                  )}
                  {stats.recentPosts.map((p) => (
                    <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.status === "sent" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                          {p.status === "sent" ? "✓" : "✕"}
                        </span>
                        <div>
                          <div className="text-sm font-medium text-gray-800">{p.campaign.title}</div>
                          <div className="text-xs text-gray-400">{p.channel.title} · {p.channel.type}</div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-400">{new Date(p.sentAt).toLocaleString("uz-UZ")}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Channels tab ── */}
          {tab === "channels" && (
            <div className="space-y-3">
              {/* Yo'riqnoma */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700">
                Botni kanal/guruhga <strong>admin</strong> qiling → avtomatik ro&apos;yxatga qo&apos;shiladi.
                &nbsp;Yoki <strong>&quot;Kanal qo&apos;shish&quot;</strong> orqali username kiritib qo&apos;shing.
              </div>

              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {channels.length === 0 && (
                  <div className="px-5 py-12 text-center text-gray-400 text-sm">
                    Hali kanallar yo&apos;q. &ldquo;Kanal qo&apos;shish&rdquo; tugmasini bosing.
                  </div>
                )}
                <div className="divide-y divide-gray-50">
                  {channels.map((ch) => {
                    const bs = botStatus[ch.id];
                    const checking = botChecking[ch.id];
                    return (
                      <div key={ch.id} className="px-5 py-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ch.isActive ? "bg-green-500" : "bg-gray-300"}`} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-gray-900 truncate">{ch.title}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${ch.scope === "platform" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                                  {ch.scope === "platform" ? "Umumiy" : "Klinika"}
                                </span>
                                <span className="text-xs text-gray-400">{ch.type === "channel" ? "📢" : "👥"}</span>
                              </div>
                              <div className="text-xs text-gray-400 mt-0.5">
                                {ch.chatId}
                                {ch.clinic && ` · ${ch.clinic.name}`}
                                {ch.memberCount && ` · ${ch.memberCount.toLocaleString()} a'zo`}
                                {` · ${ch._count.posts} post`}
                              </div>
                              {/* Bot admin status */}
                              {bs && (
                                <div className={`text-xs mt-0.5 font-medium ${bs.isAdmin ? "text-green-600" : "text-amber-600"}`}>
                                  {bs.isAdmin ? "✅ Bot admin — yuborishga tayyor" : "⚠️ Bot admin emas — botni guruhda admin qiling"}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                            <button
                              onClick={() => checkBotStatus(ch)}
                              disabled={checking}
                              className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                            >
                              {checking ? "..." : "Bot holati"}
                            </button>
                            <button onClick={() => setEditingChannel(ch)}
                              className="text-xs px-2.5 py-1 rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50">
                              Tahrir
                            </button>
                            <button onClick={() => toggleChannelActive(ch)}
                              className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${ch.isActive ? "border-red-200 text-red-600 hover:bg-red-50" : "border-green-200 text-green-600 hover:bg-green-50"}`}>
                              {ch.isActive ? "O&apos;chir" : "Yoq"}
                            </button>
                            <button onClick={() => deleteChannel(ch)}
                              className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
                              Del
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Campaigns tab ── */}
          {tab === "campaigns" && (
            <div className="space-y-3">
              {/* Cron info */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5 text-xs text-indigo-700 flex items-center gap-2">
                <span>🕗</span>
                <span>Avtomatik yuborish: <strong>har kuni 08:00 (Toshkent)</strong>. Keyingi yuborish: <strong>{nextCronTime()}</strong>. Darhol yuborish uchun kampaniya kartasidagi <strong>&ldquo;Hozir yuborish&rdquo;</strong> tugmasini bosing.</span>
              </div>

              {campaigns.length === 0 && (
                <div className="bg-white rounded-xl border border-gray-200 px-5 py-12 text-center text-gray-400 text-sm">
                  Hali kampaniyalar yo&apos;q.
                </div>
              )}
              {campaigns.map((c) => (
                <div key={c.id} className={`bg-white rounded-xl border p-5 ${c.channels.length === 0 && c.status !== "completed" && c.status !== "cancelled" ? "border-amber-200" : "border-gray-200"}`}>
                  {c.channels.length === 0 && c.status !== "completed" && c.status !== "cancelled" && (
                    <div className="mb-3 flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-700">
                      <span>⚠️</span>
                      <span>Kanal biriktirilmagan — yuborilmaydi. &ldquo;Tahrirlash&rdquo; orqali kanal tanlang.</span>
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900">{c.title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[c.status]}`}>
                          {STATUS_LABEL[c.status]}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {c.clinic.name} ({c.clinic.subscriptionPlan}) ·{" "}
                        {new Date(c.startDate).toLocaleDateString("uz-UZ")} → {new Date(c.endDate).toLocaleDateString("uz-UZ")} ·{" "}
                        {c.channels.length} kanal · {c._count.posts} post
                      </div>
                      {/* Statistika */}
                      <div className="text-xs text-gray-500 mt-0.5">
                        {c.frequency === "daily" ? "Kuniga 1 marta" : "Kuniga 2 marta"} ·{" "}
                        {c.status === "active" || c.status === "scheduled" ? `Keyingi: ${nextCronTime()}` : ""}
                      </div>
                      <div className="mt-2 text-xs text-gray-600 line-clamp-2 bg-gray-50 rounded-lg px-3 py-2">
                        {c.adText.slice(0, 150)}{c.adText.length > 150 ? "..." : ""}
                      </div>
                      {c.channels.length > 0 && (
                        <div className="mt-2 flex gap-1 flex-wrap">
                          {c.channels.map((cc) => (
                            <span key={cc.channel.id}
                              className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                              {cc.channel.type === "channel" ? "📢" : "👥"} {cc.channel.title}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      {c.status !== "completed" && c.status !== "cancelled" && (
                        <>
                          <button
                            onClick={() => setConfirmSend(c)}
                            disabled={sendingId === c.id || c.channels.length === 0}
                            className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium whitespace-nowrap"
                          >
                            {sendingId === c.id ? "Yuborilmoqda..." : "📤 Hozir yuborish"}
                          </button>
                          <button
                            onClick={() => { setEditingCampaign(c); setShowCampaignModal(true); }}
                            className="text-xs px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50"
                          >
                            Tahrirlash
                          </button>
                          <button onClick={() => cancelCampaign(c)}
                            className="text-xs px-3 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50">
                            Bekor qilish
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showChannelModal && (
        <ChannelAddModal onClose={() => setShowChannelModal(false)} onSaved={load} />
      )}
      {editingChannel && (
        <ChannelEditModal
          channel={editingChannel}
          onClose={() => setEditingChannel(undefined)}
          onSaved={() => { setEditingChannel(undefined); load(); }}
        />
      )}
      {showCampaignModal && (
        <CampaignModal
          clinics={clinics}
          channels={channels}
          editing={editingCampaign}
          onClose={() => { setShowCampaignModal(false); setEditingCampaign(undefined); }}
          onSaved={load}
        />
      )}
      {confirmSend && (
        <ConfirmSendModal
          campaign={confirmSend}
          onConfirm={doSendNow}
          onClose={() => setConfirmSend(null)}
          sending={sendingId === confirmSend.id}
        />
      )}
      {sendResult && (
        <SendNowResult result={sendResult} onClose={() => setSendResult(null)} />
      )}
    </div>
  );
}
