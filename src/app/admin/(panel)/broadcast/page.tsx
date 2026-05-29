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
  isActive: boolean;
  addedAt: string;
  _count: { posts: number };
}

interface AdCampaign {
  id: string;
  title: string;
  adText: string;
  imageUrl: string | null;
  buttonText: string | null;
  buttonUrl: string | null;
  startDate: string;
  endDate: string;
  frequency: string;
  status: "draft" | "scheduled" | "active" | "completed" | "cancelled";
  channels: { channel: { id: string; title: string; type: string } }[];
  _count: { posts: number };
}

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600", scheduled: "bg-blue-100 text-blue-700",
  active: "bg-green-100 text-green-700", completed: "bg-slate-100 text-slate-500",
  cancelled: "bg-red-100 text-red-600",
};
const STATUS_LABEL: Record<string, string> = {
  draft: "Qoralama", scheduled: "Rejalashtirilgan",
  active: "Faol", completed: "Tugagan", cancelled: "Bekor",
};

function nextCronTime(): string {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(8, 0, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next.toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" });
}

// ─── Add Channel Modal ────────────────────────────────────────────────────────

function AddChannelModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
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
          title: j.data.title, chatId: j.data.chatId, type: j.data.type,
          username: j.data.username ?? "", memberCount: j.data.memberCount ? String(j.data.memberCount) : "",
        });
      } else setLookupErr(j.error?.message ?? "Kanal topilmadi");
    } finally { setLooking(false); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setErr("");
    try {
      const r = await fetch("/api/admin/ad-channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, memberCount: form.memberCount ? Number(form.memberCount) : null }),
      });
      const j = await r.json();
      if (j.success) { onSaved(); onClose(); }
      else setErr(j.error?.message ?? "Xatolik");
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Kanal/guruh ulash</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        <div className="flex border-b border-gray-100">
          <button onClick={() => setMode("auto")}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${mode === "auto" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"}`}>
            Avtomatik (tavsiya)
          </button>
          <button onClick={() => setMode("manual")}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${mode === "manual" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"}`}>
            Qo&apos;lda kiritish
          </button>
        </div>

        {mode === "auto" ? (
          <div className="px-6 py-5 space-y-4">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm space-y-2">
              <p className="font-semibold text-blue-800">Botni admin qilish orqali:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs text-blue-700">
                <li>Kanalingizga botni qo&apos;shing</li>
                <li>Botni <strong>admin</strong> qiling (xabar yuborish huquqi bilan)</li>
                <li>Bu yerda avtomatik paydo bo&apos;ladi — super admin tasdiqlaydi</li>
              </ol>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Yoki username orqali qo&apos;shing</label>
              <div className="mt-1 flex gap-2">
                <input
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={lookupInput} onChange={(e) => setLookupInput(e.target.value)}
                  placeholder="@klinika_kanali"
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), lookup())}
                />
                <button type="button" onClick={lookup} disabled={looking || !lookupInput.trim()}
                  className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50">
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
                  {lookupResult.memberCount && <div className="text-gray-500">{lookupResult.memberCount.toLocaleString()} a&apos;zo</div>}
                  <div className={lookupResult.isAdmin ? "text-green-700 font-medium" : "text-amber-700 font-medium"}>
                    {lookupResult.isAdmin ? "✅ Bot admin — tayyor" : "⚠️ Bot admin emas — botni admin qiling"}
                  </div>
                </div>
              )}
            </div>
            {lookupResult && (
              <form onSubmit={submit} className="space-y-2">
                <div>
                  <label className="text-xs font-medium text-gray-600">Kanal nomi</label>
                  <input className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
                </div>
                {err && <p className="text-red-600 text-xs">{err}</p>}
                <div className="flex gap-2">
                  <button type="button" onClick={onClose}
                    className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600">Bekor</button>
                  <button type="submit" disabled={saving}
                    className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                    {saving ? "..." : "So&apos;rov yuborish"}
                  </button>
                </div>
              </form>
            )}
            {!lookupResult && (
              <button onClick={onClose} className="w-full py-2 border border-gray-200 rounded-lg text-sm text-gray-600">Yopish</button>
            )}
          </div>
        ) : (
          <form onSubmit={submit} className="px-6 py-4 space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Nomi *</label>
              <input className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Klinika rasmiy kanali" required />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Chat ID *</label>
              <input className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
                value={form.chatId} onChange={(e) => setForm({ ...form, chatId: e.target.value })}
                placeholder="-1001234567890" required />
              <p className="text-xs text-gray-400 mt-1">@getidsbot orqali ID oling</p>
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
                <input type="number" min="0" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={form.memberCount} onChange={(e) => setForm({ ...form, memberCount: e.target.value })} placeholder="1000" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Username</label>
              <input className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="@klinikauzebekiston" />
            </div>
            {err && <p className="text-red-600 text-xs">{err}</p>}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600">Bekor</button>
              <button type="submit" disabled={saving}
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {saving ? "Yuborilmoqda..." : "So&apos;rov yuborish"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Campaign Create/Edit Modal ───────────────────────────────────────────────

function CampaignModal({
  channels, onClose, onSaved, editing,
}: {
  channels: AdChannel[];
  onClose: () => void;
  onSaved: () => void;
  editing?: AdCampaign;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    title:      editing?.title ?? "",
    adText:     editing?.adText ?? "",
    imageUrl:   editing?.imageUrl ?? "",
    buttonText: editing?.buttonText ?? "",
    buttonUrl:  editing?.buttonUrl ?? "",
    startDate:  editing?.startDate ? editing.startDate.slice(0, 10) : today,
    endDate:    editing?.endDate ? editing.endDate.slice(0, 10) : today,
    frequency:  editing?.frequency ?? "daily",
    status:     editing?.status ?? "scheduled",
    channelIds: editing?.channels.map((c) => c.channel.id) ?? [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  // faqat faol kanallar
  const activeChannels = channels.filter((ch) => ch.isActive);

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
        body: JSON.stringify({ ...form }),
      });
      const j = await r.json();
      if (j.success) { onSaved(); onClose(); }
      else setErr(j.error?.message ?? "Xatolik");
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl my-4">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">{editing ? "Kampaniyani tahrirlash" : "Yangi e&apos;lon"}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        <form onSubmit={submit} className="px-6 py-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600">Sarlavha *</label>
            <input className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Klinika — Iyun aksiyasi" required />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Xabar matni *</label>
            <textarea rows={4} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
              value={form.adText} onChange={(e) => setForm({ ...form, adText: e.target.value })}
              placeholder="Klinikamizda yangi aksiya! &#10;&#10;<b>50% chegirma</b> barcha ko'riklar uchun" required />
            <p className="text-xs text-gray-400 mt-1">HTML formatlanadi: &lt;b&gt;bold&lt;/b&gt;, &lt;i&gt;kursiv&lt;/i&gt;</p>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600">Rasm URL (ixtiyoriy)</label>
            <input className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              placeholder="https://..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600">Tugma matni</label>
              <input className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.buttonText} onChange={(e) => setForm({ ...form, buttonText: e.target.value })}
                placeholder="Navbat olish" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600">Tugma URL</label>
              <input className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                value={form.buttonUrl} onChange={(e) => setForm({ ...form, buttonUrl: e.target.value })}
                placeholder="https://t.me/..." />
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
              </select>
            </div>
          </div>

          {/* Kanallar */}
          <div>
            <label className="text-xs font-medium text-gray-600">
              Kanal/guruh{" "}
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${form.channelIds.length > 0 ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {form.channelIds.length} tanlangan
              </span>
            </label>
            {activeChannels.length > 0 ? (
              <div className="mt-1 border border-gray-200 rounded-lg divide-y divide-gray-50 max-h-44 overflow-y-auto">
                {activeChannels.map((ch) => (
                  <label key={ch.id}
                    className={`flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer ${form.channelIds.includes(ch.id) ? "bg-blue-50/40" : ""}`}>
                    <input type="checkbox" checked={form.channelIds.includes(ch.id)}
                      onChange={() => toggleChannel(ch.id)} className="rounded accent-blue-600" />
                    <span className="text-sm text-gray-800 flex-1">{ch.title}</span>
                    <span className="text-xs text-gray-400">{ch.type === "channel" ? "📢" : "👥"}</span>
                    {ch.memberCount && <span className="text-xs text-gray-400">{ch.memberCount.toLocaleString()}</span>}
                  </label>
                ))}
              </div>
            ) : (
              <div className="mt-1 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-700">
                Faol kanal yo&apos;q. Avval &quot;Kanallar&quot; tabidan kanal qo&apos;shing va super admin tasdiqlashini kuting.
              </div>
            )}
            {form.channelIds.length === 0 && activeChannels.length > 0 && (
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
              className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {saving ? "Saqlanmoqda..." : editing ? "Yangilash" : "Yaratish"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Confirm Send Modal ───────────────────────────────────────────────────────

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
            <span className="font-semibold">&ldquo;{campaign.title}&rdquo;</span> xabari quyidagi joylarga yuboriladi:
          </p>
          <div className="border border-gray-100 rounded-lg divide-y divide-gray-50 max-h-32 overflow-y-auto">
            {campaign.channels.map((cc) => (
              <div key={cc.channel.id} className="px-3 py-2 flex items-center gap-2 text-sm">
                <span>{cc.channel.type === "channel" ? "📢" : "👥"}</span>
                <span className="text-gray-800">{cc.channel.title}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="px-6 pb-4 flex gap-2">
          <button onClick={onClose} disabled={sending}
            className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
            Bekor
          </button>
          <button onClick={onConfirm} disabled={sending}
            className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
            {sending ? "Yuborilmoqda..." : "Ha, yuborish"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Send Result Modal ────────────────────────────────────────────────────────

function SendResultModal({
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
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-sm text-amber-700">{result.warning}</div>
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
          <button onClick={onClose} className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200">Yopish</button>
        </div>
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
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<AdCampaign | undefined>();
  const [confirmSend, setConfirmSend] = useState<AdCampaign | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<{ sent: number; failed: number; warning?: string; results?: { channelTitle: string; status: string; error?: string }[] } | null>(null);
  const [botChecking, setBotChecking] = useState<Record<string, boolean>>({});
  const [botStatus, setBotStatus] = useState<Record<string, { isAdmin: boolean }>>({});

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

  async function toggleChannel(ch: AdChannel) {
    await fetch(`/api/admin/ad-channels/${ch.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !ch.isActive }),
    });
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
    } finally { setSendingId(null); }
  }

  const tabList: { key: Tab; label: string; icon: string }[] = [
    { key: "channels", label: "Kanallarim", icon: "📡" },
    { key: "campaigns", label: "E’lonlar", icon: "📢" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Broadcast</h1>
          <p className="text-sm text-gray-500 mt-1">Kanalingizga e&apos;lon yuborish</p>
        </div>
        <div>
          {tab === "channels" && (
            <button onClick={() => setShowAddChannel(true)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700">
              + Kanal ulash
            </button>
          )}
          {tab === "campaigns" && (
            <button onClick={() => { setEditingCampaign(undefined); setShowCampaignModal(true); }}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700">
              + Yangi e&apos;lon
            </button>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700">
        <strong>Qanday ishlaydi:</strong> Kanal ulang → E&apos;lon yarating → &ldquo;Hozir yuborish&rdquo; yoki avtomatik (har kuni 08:00 Toshkent).
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {tabList.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              tab === t.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
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
          {/* ── Channels tab ── */}
          {tab === "channels" && (
            <div className="space-y-3">
              {channels.length === 0 ? (
                <div className="bg-white rounded-xl border border-dashed border-gray-200 px-5 py-12 text-center">
                  <div className="text-4xl mb-3">📡</div>
                  <p className="text-gray-500 text-sm font-medium">Hali kanal ulanmagan</p>
                  <p className="text-gray-400 text-xs mt-1">Botni kanalingizga admin qilib, &ldquo;Kanal ulash&rdquo; tugmasini bosing</p>
                </div>
              ) : (
                channels.map((ch) => {
                  const bs = botStatus[ch.id];
                  const checking = botChecking[ch.id];
                  return (
                    <div key={ch.id} className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${ch.isActive ? "bg-green-500" : "bg-amber-400"}`} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900">{ch.title}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{ch.type === "channel" ? "📢 kanal" : "👥 guruh"}</span>
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5 font-mono">{ch.chatId}</div>
                            <div className="text-xs mt-0.5">
                              {ch.isActive ? (
                                <span className="text-green-600 font-medium">Faol — yuborishga tayyor</span>
                              ) : (
                                <span className="text-amber-600">Super admin tasdiqlanmagan</span>
                              )}
                              {ch._count.posts > 0 && (
                                <span className="text-gray-400"> · {ch._count.posts} post yuborilgan</span>
                              )}
                            </div>
                            {bs && (
                              <div className={`text-xs mt-0.5 font-medium ${bs.isAdmin ? "text-green-600" : "text-amber-600"}`}>
                                {bs.isAdmin ? "✅ Bot admin" : "⚠️ Bot admin emas — botni admin qiling"}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button onClick={() => checkBotStatus(ch)} disabled={checking}
                            className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50">
                            {checking ? "..." : "Tekshirish"}
                          </button>
                          {ch.isActive && (
                            <button onClick={() => toggleChannel(ch)}
                              className="text-xs px-2.5 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50">
                              To&apos;xtatish
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ── Campaigns tab ── */}
          {tab === "campaigns" && (
            <div className="space-y-3">
              {/* Cron info */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5 text-xs text-indigo-700">
                🕗 Avtomatik: <strong>har kuni 08:00</strong>. Keyingi: <strong>{nextCronTime()}</strong>.
                Darhol yuborish — &ldquo;Hozir yuborish&rdquo; tugmasi.
              </div>

              {campaigns.length === 0 ? (
                <div className="bg-white rounded-xl border border-dashed border-gray-200 px-5 py-12 text-center">
                  <div className="text-4xl mb-3">📢</div>
                  <p className="text-gray-500 text-sm font-medium">Hali e&apos;lon yo&apos;q</p>
                  <p className="text-gray-400 text-xs mt-1">
                    &ldquo;+ Yangi e&apos;lon&rdquo; tugmasini bosib e&apos;lon yarating
                  </p>
                </div>
              ) : (
                campaigns.map((c) => (
                  <div key={c.id} className={`bg-white rounded-xl border p-4 ${c.channels.length === 0 && c.status !== "completed" && c.status !== "cancelled" ? "border-amber-200" : "border-gray-200"}`}>
                    {c.channels.length === 0 && c.status !== "completed" && c.status !== "cancelled" && (
                      <div className="mb-3 flex items-center gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-700">
                        <span>⚠️</span>
                        <span>Kanal tanlanmagan. &ldquo;Tahrirlash&rdquo; orqali kanal tanlang.</span>
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900">{c.title}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[c.status]}`}>
                            {STATUS_LABEL[c.status]}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {new Date(c.startDate).toLocaleDateString("uz-UZ")} → {new Date(c.endDate).toLocaleDateString("uz-UZ")} ·{" "}
                          {c.frequency === "daily" ? "Kuniga 1 marta" : "Kuniga 2 marta"} ·{" "}
                          {c._count.posts} post
                        </div>
                        {c.channels.length > 0 && (
                          <div className="mt-1.5 flex gap-1 flex-wrap">
                            {c.channels.map((cc) => (
                              <span key={cc.channel.id} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                                {cc.channel.type === "channel" ? "📢" : "👥"} {cc.channel.title}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="mt-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 line-clamp-2">
                          {c.adText.slice(0, 120)}{c.adText.length > 120 ? "..." : ""}
                        </div>
                      </div>
                      {c.status !== "completed" && c.status !== "cancelled" && (
                        <div className="flex flex-col gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => setConfirmSend(c)}
                            disabled={sendingId === c.id || c.channels.length === 0}
                            className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium whitespace-nowrap"
                          >
                            {sendingId === c.id ? "..." : "📤 Hozir yuborish"}
                          </button>
                          <button
                            onClick={() => { setEditingCampaign(c); setShowCampaignModal(true); }}
                            className="text-xs px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50"
                          >
                            Tahrirlash
                          </button>
                          <button onClick={() => cancelCampaign(c)}
                            className="text-xs px-3 py-1.5 border border-red-200 text-red-600 rounded-lg hover:bg-red-50">
                            Bekor
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showAddChannel && (
        <AddChannelModal onClose={() => setShowAddChannel(false)} onSaved={() => { setShowAddChannel(false); load(); }} />
      )}
      {showCampaignModal && (
        <CampaignModal
          channels={channels}
          editing={editingCampaign}
          onClose={() => { setShowCampaignModal(false); setEditingCampaign(undefined); }}
          onSaved={() => { setShowCampaignModal(false); setEditingCampaign(undefined); load(); }}
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
        <SendResultModal result={sendResult} onClose={() => setSendResult(null)} />
      )}
    </div>
  );
}
