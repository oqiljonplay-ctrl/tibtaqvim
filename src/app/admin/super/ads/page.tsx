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

// ─── Status badges ────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  draft:       "bg-gray-100 text-gray-600",
  scheduled:   "bg-blue-100 text-blue-700",
  active:      "bg-green-100 text-green-700",
  completed:   "bg-slate-100 text-slate-500",
  cancelled:   "bg-red-100 text-red-600",
};

const STATUS_LABEL: Record<string, string> = {
  draft:     "Qoralama",
  scheduled: "Rejalashtirilgan",
  active:    "Faol",
  completed: "Tugagan",
  cancelled: "Bekor",
};

// ─── Channel Modal ────────────────────────────────────────────────────────────

function ChannelModal({
  clinics,
  onClose,
  onSaved,
}: {
  clinics: Clinic[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    title: "", chatId: "", type: "channel", username: "", memberCount: "",
    scope: "platform", clinicId: "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr("");
    try {
      const r = await fetch("/api/admin/ad-channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          memberCount: form.memberCount ? Number(form.memberCount) : null,
          clinicId: form.scope === "clinic" ? form.clinicId || null : null,
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
          <h3 className="font-semibold text-gray-900">Kanal qo'shish</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>
        <form onSubmit={submit} className="px-6 py-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600">Nomi *</label>
            <input
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Toshkent Salomatlik"
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Chat ID *</label>
            <input
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.chatId} onChange={(e) => setForm({ ...form, chatId: e.target.value })}
              placeholder="-1001234567890"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Tur</label>
              <select
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                <option value="channel">Kanal</option>
                <option value="group">Guruh</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Scope</label>
              <select
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })}
              >
                <option value="platform">Platform (umumiy)</option>
                <option value="clinic">Klinika (o'z kanali)</option>
              </select>
            </div>
          </div>
          {form.scope === "clinic" && (
            <div>
              <label className="text-xs font-medium text-gray-600">Klinika</label>
              <select
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.clinicId} onChange={(e) => setForm({ ...form, clinicId: e.target.value })}
              >
                <option value="">— tanlang —</option>
                {clinics.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
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
              <label className="text-xs font-medium text-gray-600">Obunachilar</label>
              <input
                type="number" min="0"
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.memberCount} onChange={(e) => setForm({ ...form, memberCount: e.target.value })}
                placeholder="5000"
              />
            </div>
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

// ─── Campaign Modal ────────────────────────────────────────────────────────────

function CampaignModal({
  clinics,
  channels,
  onClose,
  onSaved,
  editing,
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
    targetType: editing?.targetType ?? "own",
    startDate:  editing?.startDate ? editing.startDate.slice(0, 10) : today,
    endDate:    editing?.endDate ? editing.endDate.slice(0, 10) : today,
    frequency:  editing?.frequency ?? "daily",
    status:     editing?.status ?? "scheduled",
    priority:   String(editing?.priority ?? 0),
    channelIds: editing?.channels.map((c) => c.channel.id) ?? [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const availableChannels = channels.filter((ch) =>
    ch.isActive &&
    (form.targetType === "platform" ? ch.scope === "platform" : (ch.scope === "clinic" && ch.clinicId === form.clinicId))
  );

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
    setSaving(true);
    setErr("");
    try {
      const url = editing
        ? `/api/admin/ad-campaigns/${editing.id}`
        : "/api/admin/ad-campaigns";
      const method = editing ? "PATCH" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          priority: Number(form.priority),
          channelIds: form.channelIds,
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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl my-4">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">
            {editing ? "Kampaniyani tahrirlash" : "Yangi kampaniya"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>
        <form onSubmit={submit} className="px-6 py-4 space-y-3">
          {!editing && (
            <div>
              <label className="text-xs font-medium text-gray-600">Klinika *</label>
              <select
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.clinicId}
                onChange={(e) => setForm({ ...form, clinicId: e.target.value, channelIds: [] })}
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
              placeholder="BUYUK TABIB - May aksiya" required
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Reklama matni *</label>
            <textarea
              rows={4}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              value={form.adText} onChange={(e) => setForm({ ...form, adText: e.target.value })}
              placeholder="HTML format qo'llab-quvvatlanadi: <b>bold</b>, <i>italic</i>"
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
              <input
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.buttonText} onChange={(e) => setForm({ ...form, buttonText: e.target.value })}
                placeholder="Navbat olish"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Tugma URL</label>
              <input
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.buttonUrl} onChange={(e) => setForm({ ...form, buttonUrl: e.target.value })}
                placeholder="https://t.me/..."
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Tur</label>
              <select
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.targetType}
                onChange={(e) => setForm({ ...form, targetType: e.target.value as "own" | "platform", channelIds: [] })}
              >
                <option value="own">O'z kanali</option>
                <option value="platform">Umumiy kanal (navbat)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Chastota</label>
              <select
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}
              >
                <option value="daily">Kuniga 1 marta</option>
                <option value="twice_daily">Kuniga 2 marta</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Boshlanish *</label>
              <input
                type="date"
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Tugash *</label>
              <input
                type="date"
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Status</label>
              <select
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as never })}
              >
                <option value="draft">Qoralama</option>
                <option value="scheduled">Rejalashtirilgan</option>
                <option value="active">Faol</option>
                <option value="cancelled">Bekor</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Ustuvorlik</label>
              <input
                type="number" min="0"
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
              />
            </div>
          </div>

          {/* Kanallar */}
          {availableChannels.length > 0 && (
            <div>
              <label className="text-xs font-medium text-gray-600">
                Kanallar ({form.channelIds.length} tanlangan)
              </label>
              <div className="mt-1 border border-gray-200 rounded-lg divide-y divide-gray-50 max-h-40 overflow-y-auto">
                {availableChannels.map((ch) => (
                  <label key={ch.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.channelIds.includes(ch.id)}
                      onChange={() => toggleChannel(ch.id)}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-800">{ch.title}</span>
                    <span className="text-xs text-gray-400 ml-auto">{ch.type}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {availableChannels.length === 0 && form.clinicId && (
            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
              {form.targetType === "platform"
                ? "Faol platform kanallar yo'q. Avval kanal qo'shing."
                : "Bu klinikaning faol kanali yo'q. Avval kanal qo'shing."}
            </p>
          )}

          {err && <p className="text-red-600 text-xs">{err}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              Bekor
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
              {saving ? "Saqlanmoqda..." : editing ? "Yangilash" : "Yaratish"}
            </button>
          </div>
        </form>
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
  const [editingCampaign, setEditingCampaign] = useState<AdCampaign | undefined>();
  const [showCampaignModal, setShowCampaignModal] = useState(false);

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

  async function toggleChannelActive(ch: AdChannel) {
    await fetch(`/api/admin/ad-channels/${ch.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !ch.isActive }),
    });
    load();
  }

  async function deleteChannel(ch: AdChannel) {
    if (!confirm(`"${ch.title}" kanalni o'chirish/deactivate qilasizmi?`)) return;
    await fetch(`/api/admin/ad-channels/${ch.id}`, { method: "DELETE" });
    load();
  }

  async function cancelCampaign(c: AdCampaign) {
    if (!confirm(`"${c.title}" kampaniyani bekor qilasizmi?`)) return;
    await fetch(`/api/admin/ad-campaigns/${c.id}`, { method: "DELETE" });
    load();
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
            <button
              onClick={() => setShowChannelModal(true)}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700"
            >
              + Kanal qo'shish
            </button>
          )}
          {tab === "campaigns" && (
            <button
              onClick={() => { setEditingCampaign(undefined); setShowCampaignModal(true); }}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700"
            >
              + Kampaniya yaratish
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              tab === t.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
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
          {/* ── Stats tab ──────────────────────────────────────────────────── */}
          {tab === "stats" && stats && (
            <div className="space-y-6">
              {/* Overview cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {[
                  { label: "Jami kanallar", value: stats.channels.total, icon: "📡", color: "bg-blue-50" },
                  { label: "Faol kanallar", value: stats.channels.active, icon: "✅", color: "bg-green-50" },
                  { label: "Platform kanallar", value: stats.channels.platform, icon: "🌐", color: "bg-purple-50" },
                  { label: "Faol kampaniya", value: stats.campaigns.active, icon: "📢", color: "bg-indigo-50" },
                  { label: "Yuborilgan postlar", value: stats.posts.sent, icon: "✉️", color: "bg-teal-50" },
                ].map((card) => (
                  <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${card.color}`}>
                      {card.icon}
                    </div>
                    <div>
                      <div className="text-xl font-bold text-gray-900">{card.value}</div>
                      <div className="text-xs text-gray-500">{card.label}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Failed posts warning */}
              {stats.posts.failed > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 flex items-center gap-3">
                  <span className="text-red-500 text-xl">⚠️</span>
                  <div>
                    <div className="text-sm font-medium text-red-700">{stats.posts.failed} ta post yuborilmadi</div>
                    <div className="text-xs text-red-500">Bot kanaldan chiqarilgan bo'lishi mumkin</div>
                  </div>
                </div>
              )}

              {/* Recent posts */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-900">So'nggi postlar</h2>
                </div>
                <div className="divide-y divide-gray-50">
                  {stats.recentPosts.length === 0 && (
                    <div className="px-5 py-8 text-center text-gray-400 text-sm">Hali postlar yo'q</div>
                  )}
                  {stats.recentPosts.map((p) => (
                    <div key={p.id} className="px-5 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          p.status === "sent" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                        }`}>
                          {p.status === "sent" ? "✓" : "✕"}
                        </span>
                        <div>
                          <div className="text-sm font-medium text-gray-800">{p.campaign.title}</div>
                          <div className="text-xs text-gray-400">{p.channel.title} · {p.channel.type}</div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-400">
                        {new Date(p.sentAt).toLocaleString("uz-UZ")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Channels tab ───────────────────────────────────────────────── */}
          {tab === "channels" && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="divide-y divide-gray-50">
                {channels.length === 0 && (
                  <div className="px-5 py-12 text-center text-gray-400 text-sm">
                    Hali kanallar yo'q. "Kanal qo'shish" tugmasini bosing.
                  </div>
                )}
                {channels.map((ch) => (
                  <div key={ch.id} className="px-5 py-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ch.isActive ? "bg-green-500" : "bg-gray-300"}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 truncate">{ch.title}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                            ch.scope === "platform" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                          }`}>
                            {ch.scope === "platform" ? "Platform" : "Klinika"}
                          </span>
                          <span className="text-xs text-gray-400">{ch.type}</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {ch.chatId}
                          {ch.clinic && ` · ${ch.clinic.name}`}
                          {ch.memberCount && ` · ${ch.memberCount.toLocaleString()} obunachi`}
                          {` · ${ch._count.posts} post`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => toggleChannelActive(ch)}
                        className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                          ch.isActive
                            ? "border-red-200 text-red-600 hover:bg-red-50"
                            : "border-green-200 text-green-600 hover:bg-green-50"
                        }`}
                      >
                        {ch.isActive ? "O'chirish" : "Yoqish"}
                      </button>
                      <button
                        onClick={() => deleteChannel(ch)}
                        className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
                      >
                        O'chirish
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Campaigns tab ──────────────────────────────────────────────── */}
          {tab === "campaigns" && (
            <div className="space-y-3">
              {campaigns.length === 0 && (
                <div className="bg-white rounded-xl border border-gray-200 px-5 py-12 text-center text-gray-400 text-sm">
                  Hali kampaniyalar yo'q.
                </div>
              )}
              {campaigns.map((c) => (
                <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900">{c.title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[c.status]}`}>
                          {STATUS_LABEL[c.status]}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          c.targetType === "platform" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                        }`}>
                          {c.targetType === "platform" ? "Umumiy navbat" : "O'z kanali"}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {c.clinic.name} ({c.clinic.subscriptionPlan}) ·{" "}
                        {new Date(c.startDate).toLocaleDateString("uz-UZ")} →{" "}
                        {new Date(c.endDate).toLocaleDateString("uz-UZ")} ·{" "}
                        {c.channels.length} kanal · {c._count.posts} post yuborilgan
                      </div>
                      <div className="mt-2 text-xs text-gray-600 line-clamp-2 bg-gray-50 rounded-lg px-3 py-2">
                        {c.adText.slice(0, 150)}{c.adText.length > 150 ? "..." : ""}
                      </div>
                      {c.channels.length > 0 && (
                        <div className="mt-2 flex gap-1 flex-wrap">
                          {c.channels.map((cc) => (
                            <span key={cc.channel.id}
                              className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                              {cc.channel.title}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      {c.status !== "completed" && c.status !== "cancelled" && (
                        <button
                          onClick={() => { setEditingCampaign(c); setShowCampaignModal(true); }}
                          className="text-xs px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50"
                        >
                          Tahrirlash
                        </button>
                      )}
                      {c.status !== "completed" && c.status !== "cancelled" && (
                        <button
                          onClick={() => cancelCampaign(c)}
                          className="text-xs px-3 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50"
                        >
                          Bekor qilish
                        </button>
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
        <ChannelModal
          clinics={clinics}
          onClose={() => setShowChannelModal(false)}
          onSaved={load}
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
    </div>
  );
}
