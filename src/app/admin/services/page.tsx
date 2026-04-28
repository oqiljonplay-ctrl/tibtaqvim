"use client";
import { useEffect, useState } from "react";

interface Service {
  id: string;
  name: string;
  type: string;
  price: number;
  requiresSlot: boolean;
  requiresAddress: boolean;
  dailyLimit: number | null;
  isActive: boolean;
}

const typeLabels: Record<string, string> = {
  doctor_queue: "Shifokor navbati",
  diagnostic: "Diagnostika",
  home_service: "Uyga chiqish",
};

export default function AdminServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", type: "doctor_queue", price: "", dailyLimit: "",
    requiresSlot: false, requiresAddress: false, description: "",
  });

  useEffect(() => { fetchServices(); }, []);

  async function fetchServices() {
    setLoading(true);
    const token = localStorage.getItem("auth_token") || "";
    const res = await fetch("/api/admin/services", { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    if (json.success) setServices(json.data);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem("auth_token") || "";
    const payload = {
      ...form,
      price: parseFloat(form.price),
      dailyLimit: form.dailyLimit ? parseInt(form.dailyLimit) : null,
    };

    const url = editId ? `/api/admin/services/${editId}` : "/api/admin/services";
    const method = editId ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setShowForm(false);
      setEditId(null);
      setForm({ name: "", type: "doctor_queue", price: "", dailyLimit: "", requiresSlot: false, requiresAddress: false, description: "" });
      fetchServices();
    }
  }

  function startEdit(s: Service) {
    setForm({
      name: s.name, type: s.type, price: String(s.price),
      dailyLimit: s.dailyLimit !== null ? String(s.dailyLimit) : "",
      requiresSlot: s.requiresSlot, requiresAddress: s.requiresAddress, description: "",
    });
    setEditId(s.id);
    setShowForm(true);
  }

  async function updateLimit(id: string, limit: string) {
    const token = localStorage.getItem("auth_token") || "";
    await fetch(`/api/admin/services/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ dailyLimit: limit ? parseInt(limit) : null }),
    });
    fetchServices();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Xizmatlar</h1>
        <button onClick={() => { setShowForm(true); setEditId(null); }} className="btn-primary">
          + Yangi xizmat
        </button>
      </div>

      {showForm && (
        <div className="card mb-6">
          <h2 className="text-lg font-semibold mb-4">{editId ? "Xizmatni tahrirlash" : "Yangi xizmat"}</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nomi *</label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Turi *</label>
              <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="doctor_queue">Shifokor navbati</option>
                <option value="diagnostic">Diagnostika</option>
                <option value="home_service">Uyga chiqish</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Narxi (so'm) *</label>
              <input className="input" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kunlik limit (bo'sh = cheksiz)</label>
              <input className="input" type="number" value={form.dailyLimit} onChange={(e) => setForm({ ...form, dailyLimit: e.target.value })} placeholder="Masalan: 40" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tavsif</label>
              <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="flex gap-4 items-end">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.requiresSlot} onChange={(e) => setForm({ ...form, requiresSlot: e.target.checked })} />
                Uyacha kerak
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.requiresAddress} onChange={(e) => setForm({ ...form, requiresAddress: e.target.checked })} />
                Manzil kerak
              </label>
            </div>
            <div className="md:col-span-2 flex gap-3">
              <button type="submit" className="btn-primary">{editId ? "Saqlash" : "Qo'shish"}</button>
              <button type="button" className="btn-secondary" onClick={() => { setShowForm(false); setEditId(null); }}>Bekor</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-gray-400 text-sm text-center py-12">Yuklanmoqda...</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 font-medium text-gray-500">Xizmat</th>
                <th className="text-left py-2 font-medium text-gray-500">Turi</th>
                <th className="text-left py-2 font-medium text-gray-500">Narxi</th>
                <th className="text-left py-2 font-medium text-gray-500">Kunlik limit</th>
                <th className="text-left py-2 font-medium text-gray-500">Xususiyatlar</th>
                <th className="text-left py-2 font-medium text-gray-500">Amal</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 font-medium">{s.name}</td>
                  <td className="py-2">
                    <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                      {typeLabels[s.type] ?? s.type}
                    </span>
                  </td>
                  <td className="py-2">{s.price.toLocaleString()} so'm</td>
                  <td className="py-2">
                    <input
                      type="number"
                      className="input w-20 text-center"
                      defaultValue={s.dailyLimit ?? ""}
                      placeholder="∞"
                      onBlur={(e) => updateLimit(s.id, e.target.value)}
                    />
                  </td>
                  <td className="py-2 flex gap-1 flex-wrap">
                    {s.requiresSlot && <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded">Uyacha</span>}
                    {s.requiresAddress && <span className="bg-orange-50 text-orange-700 text-xs px-2 py-0.5 rounded">Manzil</span>}
                  </td>
                  <td className="py-2">
                    <button onClick={() => startEdit(s)} className="text-blue-600 hover:underline text-xs mr-3">Tahrirlash</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
