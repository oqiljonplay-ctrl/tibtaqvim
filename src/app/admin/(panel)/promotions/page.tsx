"use client";
import { useEffect, useState, useCallback } from "react";
import { Container, Stack } from "@/components/layout";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Promotion {
  id: string;
  clinicId: string;
  postUrl: string;
  embedId: string;
  type: "aksiya" | "yangilik" | "elon" | "umumiy";
  source: "kanal" | "guruh";
  title: string | null;
  subscribeUsername: string | null;
  showSubscribeButton: boolean;
  isActive: boolean;
  sortOrder: number;
  publishedAt: string;
  createdAt: string;
}

const TYPE_LABEL: Record<string, string> = {
  aksiya: "Aksiya", yangilik: "Yangilik", elon: "E'lon", umumiy: "Umumiy",
};
const TYPE_COLOR: Record<string, string> = {
  aksiya: "bg-pink-100 text-pink-700",
  yangilik: "bg-blue-100 text-blue-700",
  elon: "bg-amber-100 text-amber-700",
  umumiy: "bg-gray-100 text-gray-600",
};

const EMPTY_FORM = {
  postUrl: "",
  type: "umumiy" as const,
  source: "kanal" as const,
  title: "",
  subscribeUsername: "",
  showSubscribeButton: true,
  isActive: true,
  sortOrder: 0,
  publishedAt: new Date().toISOString().slice(0, 10),
};

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ClinicPromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/promotions", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setPromotions(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setShowForm(true);
    setError(null);
  }

  function openEdit(p: Promotion) {
    setForm({
      postUrl: p.postUrl,
      type: p.type as typeof EMPTY_FORM.type,
      source: p.source as typeof EMPTY_FORM.source,
      title: p.title ?? "",
      subscribeUsername: p.subscribeUsername ?? "",
      showSubscribeButton: p.showSubscribeButton,
      isActive: p.isActive,
      sortOrder: p.sortOrder,
      publishedAt: p.publishedAt.slice(0, 10),
    });
    setEditingId(p.id);
    setShowForm(true);
    setError(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        title: form.title || null,
        subscribeUsername: form.subscribeUsername || null,
        publishedAt: new Date(form.publishedAt).toISOString(),
      };
      const url = editingId ? `/api/admin/promotions/${editingId}` : "/api/admin/promotions";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error?.message ?? "Xatolik"); return; }
      setShowForm(false);
      load();
    } catch {
      setError("Tarmoq xatosi");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Bu postni o'chirasizmi?")) return;
    setDeleting(id);
    try {
      await fetch(`/api/admin/promotions/${id}`, { method: "DELETE", credentials: "include" });
      load();
    } catch {}
    finally { setDeleting(null); }
  }

  return (
    <Container size="lg">
      <Stack gap={6}>
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">📣 Telegram postlar</h1>
            <p className="text-gray-500 text-sm mt-0.5">Webapp dropdown'da ko'rinadigan Telegram postlar</p>
          </div>
          <button
            onClick={openAdd}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition"
          >
            + Yangi post
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-base font-bold mb-4">{editingId ? "Postni tahrirlash" : "Yangi post qo'shish"}</h2>
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-700">{error}</div>
            )}
            <Stack gap={3}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">t.me link *</label>
                <input
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://t.me/kanalUsername/123"
                  value={form.postUrl}
                  onChange={(e) => setForm((f) => ({ ...f, postUrl: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tur</label>
                  <select
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as typeof form.type }))}
                  >
                    <option value="umumiy">Umumiy</option>
                    <option value="aksiya">Aksiya</option>
                    <option value="yangilik">Yangilik</option>
                    <option value="elon">E'lon</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Manba</label>
                  <select
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
                    value={form.source}
                    onChange={(e) => setForm((f) => ({ ...f, source: e.target.value as typeof form.source }))}
                  >
                    <option value="kanal">Kanal</option>
                    <option value="guruh">Guruh</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sarlavha (ixtiyoriy)</label>
                <input
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Yangi aksiya haqida..."
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Obuna username (ixtiyoriy)</label>
                  <input
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="kanalUsername (@ siz)"
                    value={form.subscribeUsername}
                    onChange={(e) => setForm((f) => ({ ...f, subscribeUsername: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sana</label>
                  <input
                    type="date"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.publishedAt}
                    onChange={(e) => setForm((f) => ({ ...f, publishedAt: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tartib raqami</label>
                  <input
                    type="number"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.sortOrder}
                    onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <div className="flex items-center gap-5 flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.showSubscribeButton}
                    onChange={(e) => setForm((f) => ({ ...f, showSubscribeButton: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">Obuna tugmasini ko'rsat</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">Faol</span>
                </label>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-60"
                >
                  {saving ? "Saqlanmoqda..." : editingId ? "Saqlash" : "Qo'shish"}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="px-5 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition"
                >
                  Bekor
                </button>
              </div>
            </Stack>
          </div>
        )}

        {/* List */}
        {loading ? (
          <Stack gap={3}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </Stack>
        ) : promotions.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-gray-500 text-sm">Hozircha post yo'q.</p>
            <p className="text-gray-400 text-xs mt-1">Yuqoridagi "+ Yangi post" tugmasini bosing.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Link / Sarlavha</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Tur</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Sana</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Holat</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {promotions.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 truncate max-w-[180px]">{p.title ?? p.embedId}</div>
                      <a
                        href={p.postUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:underline truncate block max-w-[180px]"
                      >
                        {p.postUrl}
                      </a>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLOR[p.type]}`}>
                        {TYPE_LABEL[p.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs hidden md:table-cell">
                      {new Date(p.publishedAt).toLocaleDateString("uz-UZ")}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${p.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {p.isActive ? "Faol" : "Yopiq"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => openEdit(p)}
                          className="text-blue-500 hover:text-blue-700 text-xs font-medium px-2 py-1 rounded-lg hover:bg-blue-50 transition"
                        >
                          Tahrir
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          disabled={deleting === p.id}
                          className="text-red-400 hover:text-red-600 text-xs font-medium px-2 py-1 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
                        >
                          {deleting === p.id ? "..." : "O'chir"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Stack>
    </Container>
  );
}
