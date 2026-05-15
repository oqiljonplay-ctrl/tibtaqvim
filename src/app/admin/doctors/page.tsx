"use client";
import { useEffect, useState } from "react";
import { DoctorCard } from "@/components/DoctorCard";

interface ServiceItem {
  id: string;
  name: string;
  price: number;
  type: string;
}

interface Doctor {
  id: string;
  firstName: string;
  lastName: string;
  specialty: string;
  phone: string | null;
  photoUrl: string | null;
  branch: { name: string } | null;
  isActive: boolean;
  services: ServiceItem[];
}

const emptyForm = {
  firstName: "", lastName: "", specialty: "", phone: "", photoUrl: "",
};

export default function AdminDoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);

  useEffect(() => {
    fetchDoctors();
    fetchServices();
  }, []);

  async function fetchDoctors() {
    setLoading(true);
    const clinicId = localStorage.getItem("clinicId") || "";
    const res = await fetch(`/api/admin/doctors${clinicId ? `?clinicId=${clinicId}` : ""}`);
    const json = await res.json();
    if (json.success) setDoctors(json.data);
    setLoading(false);
  }

  async function fetchServices() {
    const clinicId = localStorage.getItem("clinicId") || "";
    const res = await fetch(`/api/admin/services${clinicId ? `?clinicId=${clinicId}` : ""}`);
    const json = await res.json();
    if (json.success) setServices(json.data);
  }

  function toggleService(id: string, checked: boolean) {
    setSelectedServiceIds((prev) =>
      checked ? [...prev, id] : prev.filter((x) => x !== id)
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/doctors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        photoUrl: form.photoUrl || null,
        phone: form.phone || null,
        serviceIds: selectedServiceIds,
      }),
    });
    if (res.ok) {
      setShowForm(false);
      setForm(emptyForm);
      setSelectedServiceIds([]);
      fetchDoctors();
    }
  }

  function openForm() {
    setForm(emptyForm);
    setSelectedServiceIds([]);
    setShowForm(true);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Shifokorlar</h1>
        <button onClick={openForm} className="btn-primary">+ Yangi shifokor</button>
      </div>

      {showForm && (
        <div className="card mb-6">
          <h2 className="text-lg font-semibold mb-4">Yangi shifokor qo&apos;shish</h2>
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
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Foto URL (ixtiyoriy)</label>
              <input
                className="input"
                type="url"
                value={form.photoUrl}
                onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
                placeholder="https://example.com/photo.jpg"
              />
              {form.photoUrl && (
                <img
                  src={form.photoUrl}
                  alt="preview"
                  className="w-16 h-16 rounded-full object-cover mt-2 border"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              )}
            </div>

            {services.length > 0 && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Qatnashadigan xizmatlar</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-lg p-3 bg-gray-50">
                  {services.map((svc) => (
                    <label key={svc.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedServiceIds.includes(svc.id)}
                        onChange={(e) => toggleService(svc.id, e.target.checked)}
                      />
                      <span className="truncate">{svc.name} — {Number(svc.price).toLocaleString()} so&apos;m</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="md:col-span-2 flex gap-3">
              <button type="submit" className="btn-primary">Qo&apos;shish</button>
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
              <DoctorCard doctor={d} size="md" />
              {d.phone && <p className="text-xs text-gray-400 mt-2 ml-15">{d.phone}</p>}
              {d.branch && <p className="text-xs text-gray-400">{d.branch.name}</p>}
              {d.services.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500 mb-1">Xizmatlar:</p>
                  <div className="flex flex-wrap gap-1">
                    {d.services.map((svc) => (
                      <span key={svc.id} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                        {svc.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
