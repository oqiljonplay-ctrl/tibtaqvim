"use client";
import { useEffect, useState } from "react";

interface Doctor {
  id: string;
  firstName: string;
  lastName: string;
  specialty: string;
  phone: string | null;
  branch: { name: string } | null;
  isActive: boolean;
}

export default function AdminDoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", specialty: "", phone: "" });

  useEffect(() => { fetchDoctors(); }, []);

  async function fetchDoctors() {
    setLoading(true);
    const token = localStorage.getItem("auth_token") || "";
    const clinicId = localStorage.getItem("clinicId") || "";
    const res = await fetch(`/api/admin/doctors${clinicId ? `?clinicId=${clinicId}` : ""}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (json.success) setDoctors(json.data);
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const token = localStorage.getItem("auth_token") || "";
    const res = await fetch("/api/admin/doctors", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowForm(false);
      setForm({ firstName: "", lastName: "", specialty: "", phone: "" });
      fetchDoctors();
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Shifokorlar</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary">+ Yangi shifokor</button>
      </div>

      {showForm && (
        <div className="card mb-6">
          <h2 className="text-lg font-semibold mb-4">Yangi shifokor qo'shish</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ism *</label>
              <input className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Familya *</label>
              <input className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mutaxassislik *</label>
              <input className="input" value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} required placeholder="Terapevt, Kardiolog..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
              <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+998 90 000 00 00" />
            </div>
            <div className="md:col-span-2 flex gap-3">
              <button type="submit" className="btn-primary">Qo'shish</button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Bekor</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-gray-400 text-sm text-center py-12">Yuklanmoqda...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {doctors.map((d) => (
            <div key={d.id} className="card">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-lg flex-shrink-0">
                  {d.firstName[0]}{d.lastName[0]}
                </div>
                <div>
                  <div className="font-semibold text-gray-900">{d.firstName} {d.lastName}</div>
                  <div className="text-sm text-blue-600">{d.specialty}</div>
                  {d.phone && <div className="text-xs text-gray-400 mt-1">{d.phone}</div>}
                  {d.branch && <div className="text-xs text-gray-400">{d.branch.name}</div>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
