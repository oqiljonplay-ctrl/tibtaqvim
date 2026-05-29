"use client";
import { useEffect, useState, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AdChannel {
  id: string;
  title: string;
  chatId: string;
  type: string;
  username: string | null;
  memberCount: number | null;
  scope: "clinic" | "platform";
  isActive: boolean;
  addedAt: string;
  _count: { posts: number };
}

interface AdCampaign {
  id: string;
  title: string;
  adText: string;
  imageUrl: string | null;
  targetType: "own" | "platform";
  startDate: string;
  endDate: string;
  frequency: string;
  status: "draft" | "scheduled" | "active" | "completed" | "cancelled";
  channels: { channel: { id: string; title: string } }[];
  _count: { posts: number };
}

const STATUS_BADGE: Record<string, string> = {
  draft:     "bg-gray-100 text-gray-600",
  scheduled: "bg-blue-100 text-blue-700",
  active:    "bg-green-100 text-green-700",
  completed: "bg-slate-100 text-slate-500",
  cancelled: "bg-red-100 text-red-600",
};

const STATUS_LABEL: Record<string, string> = {
  draft:     "Qoralama",
  scheduled: "Rejalashtirilgan",
  active:    "Faol",
  completed: "Tugagan",
  cancelled: "Bekor",
};

// ─── Add Channel Modal ────────────────────────────────────────────────────────

function AddChannelModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ title: "", chatId: "", type: "channel", username: "", memberCount: "" });
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
          <h3 className="font-semibold text-gray-900">Kanal ulash</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>
        <div className="px-6 py-3 bg-blue-50 border-b border-blue-100 text-xs text-blue-700">
          Botni kanalingiz/guruhingizga <strong>admin</strong> qilib qo&apos;shing, so&apos;ng chatId kiriting.
          Kanal tasdiqlash uchun super_admin ko&apos;rib chiqadi.
        </div>
        <form onSubmit={submit} className="px-6 py-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600">Kanal/Guruh nomi *</label>
            <input
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Klinika rasmiy kanali"
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Chat ID *</label>
            <input
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono"
              value={form.chatId} onChange={(e) => setForm({ ...form, chatId: e.target.value })}
              placeholder="-1001234567890"
              required
            />
            <p className="text-xs text-gray-400 mt-1">
              Kanalda: @getidsbot orqali ID oling yoki URL da raqamni toping
            </p>
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
              <label className="text-xs font-medium text-gray-600">Obunachilar</label>
              <input
                type="number" min="0"
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.memberCount} onChange={(e) => setForm({ ...form, memberCount: e.target.value })}
                placeholder="1000"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Username (ixtiyoriy)</label>
            <input
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="@klinikauzebekiston"
            />
          </div>
          {err && <p className="text-red-600 text-xs">{err}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              Bekor
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Yuborilmoqda..." : "So&apos;rov yuborish"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = "channels" | "campaigns";

export default function ClinicBroadcastPage() {
  const [tab, setTab] = useState<Tab>("channels");
  const [channels, setChannels] = useState<AdChannel[]>([]);
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddChannel, setShowAddChannel] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [ch, ca] = await Promise.all([
      fetch("/api/admin/ad-channels").then((r) => r.json()),
      fetch("/api/admin/ad-campaigns").then((r) => r.json()),
    ]);
    if (ch.success) setChannels(ch.data);
    if (ca.success) setCampaigns(ca.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleChannel(ch: AdChannel) {
    await fetch(`/api/admin/ad-channels/${ch.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !ch.isActive }),
    });
    load();
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "channels", label: "Kanallarim", icon: "📡" },
    { key: "campaigns", label: "Kampaniyalar", icon: "📢" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Broadcast</h1>
          <p className="text-sm text-gray-500 mt-1">Kanalingizga reklama yuborish boshqaruvi</p>
        </div>
        {tab === "channels" && (
          <button
            onClick={() => setShowAddChannel(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700"
          >
            + Kanal ulash
          </button>
        )}
      </div>

      {/* Info banner */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 text-xs text-indigo-700">
        <strong>Qanday ishlaydi:</strong> Botni kanalingizga admin qiling → Kanal ulang → Super admin tasdiqlaydi →
        Kampaniya yaratiladi → Bot har kuni kanalingizga reklama yuboradi.
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
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Yuklanmoqda...</span>
        </div>
      ) : (
        <>
          {/* ── Channels tab ─────────────────────────────────────────────── */}
          {tab === "channels" && (
            <div className="space-y-3">
              {channels.length === 0 ? (
                <div className="bg-white rounded-xl border border-dashed border-gray-200 px-5 py-12 text-center">
                  <div className="text-3xl mb-3">📡</div>
                  <p className="text-gray-500 text-sm font-medium">Hali kanal ulanmagan</p>
                  <p className="text-gray-400 text-xs mt-1">
                    Botni kanalingizga admin qilib, &quot;Kanal ulash&quot; tugmasini bosing
                  </p>
                </div>
              ) : (
                channels.map((ch) => (
                  <div key={ch.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${ch.isActive ? "bg-green-500" : "bg-amber-400"}`} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{ch.title}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{ch.type}</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5 font-mono">{ch.chatId}</div>
                        <div className="text-xs mt-0.5">
                          {ch.isActive ? (
                            <span className="text-green-600">Faol — yuborishga tayyor</span>
                          ) : (
                            <span className="text-amber-600">Tasdiqlanmagan — super_admin tekshirmoqda</span>
                          )}
                          {ch._count.posts > 0 && (
                            <span className="text-gray-400"> · {ch._count.posts} post yuborilgan</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {ch.isActive && (
                      <button
                        onClick={() => toggleChannel(ch)}
                        className="text-xs px-2.5 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 flex-shrink-0"
                      >
                        To&apos;xtatish
                      </button>
                    )}
                  </div>
                ))
              )}

              {channels.length > 0 && (
                <p className="text-xs text-gray-400 text-center">
                  Yangi kanal qo&apos;shish uchun &quot;Kanal ulash&quot; tugmasini bosing
                </p>
              )}
            </div>
          )}

          {/* ── Campaigns tab ────────────────────────────────────────────── */}
          {tab === "campaigns" && (
            <div className="space-y-3">
              {campaigns.length === 0 ? (
                <div className="bg-white rounded-xl border border-dashed border-gray-200 px-5 py-12 text-center">
                  <div className="text-3xl mb-3">📢</div>
                  <p className="text-gray-500 text-sm font-medium">Hali kampaniya yo&apos;q</p>
                  <p className="text-gray-400 text-xs mt-1">
                    Super admin sizning klinikangiz uchun kampaniya yaratadi
                  </p>
                </div>
              ) : (
                campaigns.map((c) => (
                  <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900">{c.title}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[c.status]}`}>
                            {STATUS_LABEL[c.status]}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {new Date(c.startDate).toLocaleDateString("uz-UZ")} →{" "}
                          {new Date(c.endDate).toLocaleDateString("uz-UZ")} ·{" "}
                          {c.frequency === "daily" ? "Kuniga 1 marta" : "Kuniga 2 marta"} ·{" "}
                          {c._count.posts} post yuborilgan
                        </div>
                        {c.channels.length > 0 && (
                          <div className="mt-2 flex gap-1 flex-wrap">
                            {c.channels.map((cc) => (
                              <span key={cc.channel.id} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                                {cc.channel.title}
                              </span>
                            ))}
                          </div>
                        )}
                        {c.channels.length === 0 && (
                          <p className="text-xs text-amber-600 mt-1">⚠️ Kanal biriktirilmagan</p>
                        )}
                        <div className="mt-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 line-clamp-2">
                          {c.adText.slice(0, 120)}{c.adText.length > 120 ? "..." : ""}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      {showAddChannel && (
        <AddChannelModal
          onClose={() => setShowAddChannel(false)}
          onSaved={() => { setShowAddChannel(false); load(); }}
        />
      )}
    </div>
  );
}
