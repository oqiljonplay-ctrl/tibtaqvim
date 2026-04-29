"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Clinic {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { branches: number; doctors: number; appointments: number };
  settings: { enableBot: boolean; enableWebapp: boolean; enableQueue: boolean } | null;
}

function TogglePill({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
        on ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${on ? "bg-green-500" : "bg-gray-300"}`} />
      {label}
    </span>
  );
}

export default function ClinicListPage() {
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  function token() {
    return localStorage.getItem("auth_token") || "";
  }

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/super/clinics", {
      headers: { Authorization: `Bearer ${token()}` },
    });
    const j = await res.json();
    if (j.success) setClinics(j.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createClinic() {
    if (!form.name.trim()) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/admin/super/clinics", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (!j.success) { setError(j.error?.message ?? "Xatolik"); return; }
      setShowCreate(false);
      setForm({ name: "", phone: "", address: "" });
      load();
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(id: string, clinic: Clinic) {
    await fetch(`/api/admin/super/clinics/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ name: clinic.name, isActive: !clinic.isActive }),
    });
    load();
  }

  async function deleteClinic(id: string, name: string) {
    if (!confirm(`"${name}" klinikasini o'chirishni tasdiqlaysizmi? (qaytarib bo'lmaydi)`)) return;
    await fetch(`/api/admin/super/clinics/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token()}` },
    });
    load();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Klinikalar</h1>
          <p className="text-sm text-gray-500 mt-1">{clinics.length} ta klinika ro'yxatda</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <span className="text-base leading-none">+</span>
          Yangi klinika
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 mx-4">
            <h2 className="text-lg font-bold text-gray-900 mb-5">Yangi klinika</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nomi *</label>
                <input
                  className="input"
                  placeholder="Klinika nomi"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                <input
                  className="input"
                  placeholder="+998 90 000 00 00"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Manzil</label>
                <input
                  className="input"
                  placeholder="Shahar, ko'cha"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
              {error && (
                <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{error}</div>
              )}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={createClinic}
                  disabled={creating || !form.name.trim()}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
                >
                  {creating ? "Yaratilmoqda..." : "Yaratish"}
                </button>
                <button
                  onClick={() => { setShowCreate(false); setError(""); }}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 rounded-lg text-sm transition-colors"
                >
                  Bekor
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
            <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Yuklanmoqda...</span>
          </div>
        ) : clinics.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            Hali klinikalar yo'q. Birinchisini yarating!
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Klinika</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Modullar</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">Filialar</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">Shifokorlar</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">Bronlar</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">Holat</th>
                <th className="text-right px-5 py-3 font-medium text-gray-500">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {clinics.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-4">
                    <Link
                      href={`/admin/super/clinics/${c.id}`}
                      className="font-medium text-gray-900 hover:text-indigo-600 transition-colors"
                    >
                      {c.name}
                    </Link>
                    {c.phone && (
                      <div className="text-xs text-gray-400 mt-0.5">{c.phone}</div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-1">
                      <TogglePill on={c.settings?.enableBot ?? true} label="Bot" />
                      <TogglePill on={c.settings?.enableWebapp ?? true} label="WebApp" />
                      <TogglePill on={c.settings?.enableQueue ?? true} label="Navbat" />
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center text-gray-700">{c._count.branches}</td>
                  <td className="px-4 py-4 text-center text-gray-700">{c._count.doctors}</td>
                  <td className="px-4 py-4 text-center text-gray-700">{c._count.appointments}</td>
                  <td className="px-4 py-4 text-center">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium ${
                        c.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${c.isActive ? "bg-green-500" : "bg-gray-400"}`}
                      />
                      {c.isActive ? "Faol" : "Nofaol"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/admin/super/clinics/${c.id}`}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2.5 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
                      >
                        Sozla
                      </Link>
                      <button
                        onClick={() => toggleActive(c.id, c)}
                        className={`text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors ${
                          c.isActive
                            ? "text-orange-600 hover:text-orange-800 hover:bg-orange-50"
                            : "text-green-600 hover:text-green-800 hover:bg-green-50"
                        }`}
                      >
                        {c.isActive ? "To'xtat" : "Yoq"}
                      </button>
                      <button
                        onClick={() => deleteClinic(c.id, c.name)}
                        className="text-xs text-red-500 hover:text-red-700 font-medium px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        O'chir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
