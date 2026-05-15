"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DoctorCard } from "@/components/DoctorCard";

type QueueMode = "live" | "online" | "slot";

interface ServiceItem {
  id: string;
  name: string;
  price: number;
  type: string;
  queueMode: QueueMode;
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

function QueueModeSelector({
  serviceId,
  serviceName,
  currentMode,
  onChange,
}: {
  serviceId: string;
  serviceName: string;
  currentMode: QueueMode;
  onChange: (mode: QueueMode) => void;
}) {
  return (
    <div className="border rounded-lg p-3 bg-gray-50">
      <p className="text-sm font-medium text-gray-700 mb-2">{serviceName}</p>
      <div className="space-y-1.5">
        <label className="flex items-center justify-between p-2 bg-white rounded cursor-pointer hover:bg-blue-50 transition">
          <div>
            <span className="text-sm font-medium">💵 Kunlik ro&apos;yxatga kirish</span>
            <p className="text-xs text-gray-500 mt-0.5">Kassa orqali jonli navbat oladi</p>
          </div>
          <input
            type="radio"
            name={`queueMode-${serviceId}`}
            checked={currentMode === "live"}
            onChange={() => onChange("live")}
            className="w-4 h-4 text-blue-600"
          />
        </label>
        <label className="flex items-center justify-between p-2 bg-white rounded cursor-pointer hover:bg-blue-50 transition">
          <div>
            <span className="text-sm font-medium">🎫 Masofaviy jonli navbat</span>
            <p className="text-xs text-gray-500 mt-0.5">Online navbat raqami beriladi</p>
          </div>
          <input
            type="radio"
            name={`queueMode-${serviceId}`}
            checked={currentMode === "online"}
            onChange={() => onChange("online")}
            className="w-4 h-4 text-blue-600"
          />
        </label>
        <label className="flex items-center justify-between p-2 bg-gray-100 rounded opacity-60 cursor-not-allowed">
          <div>
            <span className="text-sm font-medium">🕐 Aniq vaqt sloti</span>
            <p className="text-xs text-gray-500 mt-0.5">Tez orada qo&apos;shiladi</p>
          </div>
          <input type="radio" disabled className="w-4 h-4" />
        </label>
      </div>
    </div>
  );
}

function DoctorQueueModes({ doctor, onSaved }: { doctor: Doctor; onSaved: () => void }) {
  const [modes, setModes] = useState<Record<string, QueueMode>>(
    Object.fromEntries(doctor.services.map((s) => [s.id, s.queueMode]))
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const serviceQueueModes = Object.entries(modes).map(([serviceId, queueMode]) => ({
        serviceId,
        queueMode,
      }));
      const res = await fetch(`/api/admin/doctors/${doctor.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceQueueModes }),
      });
      const json = await res.json();
      if (!json.success) {
        alert(json.error?.message || "Saqlashda xatolik");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved();
    } catch {
      alert("Server xatosi");
    } finally {
      setSaving(false);
    }
  }

  if (doctor.services.length === 0) return null;

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <p className="text-xs font-semibold text-gray-600 mb-2">📋 Navbat rejimlari</p>
      <div className="space-y-2">
        {doctor.services.map((svc) => (
          <QueueModeSelector
            key={svc.id}
            serviceId={svc.id}
            serviceName={`${svc.name} — ${Number(svc.price).toLocaleString()} so'm`}
            currentMode={modes[svc.id] ?? "online"}
            onChange={(mode) => setModes((prev) => ({ ...prev, [svc.id]: mode }))}
          />
        ))}
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className={`mt-2 w-full py-1.5 rounded-lg text-sm font-medium transition ${
          saved
            ? "bg-green-600 text-white"
            : "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        }`}
      >
        {saving ? "Saqlanmoqda..." : saved ? "✓ Saqlandi" : "Rejimlarni saqlash"}
      </button>
    </div>
  );
}

export default function AdminDoctorsPage() {
  const router = useRouter();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchDoctors();
    fetchServices();
  }, []);

  async function fetchDoctors() {
    setLoading(true);
    const clinicId = localStorage.getItem("clinicId") || "";
    const res = await fetch(`/api/admin/doctors${clinicId ? `?clinicId=${clinicId}` : ""}`, {
      credentials: "include",
    });
    const json = await res.json();
    if (json.success) setDoctors(json.data);
    setLoading(false);
  }

  async function fetchServices() {
    const clinicId = localStorage.getItem("clinicId") || "";
    const res = await fetch(`/api/admin/services${clinicId ? `?clinicId=${clinicId}` : ""}`, {
      credentials: "include",
    });
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
      credentials: "include",
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

  async function handleDelete(doctorId: string) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/doctors/${doctorId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json();
      if (json.success) {
        setDoctors((prev) => prev.filter((d) => d.id !== doctorId));
      } else {
        alert(json.error?.message || "O'chirishda xatolik");
      }
    } catch {
      alert("Server bilan bog'lanishda xatolik");
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Shifokorlar</h1>
        <button
          onClick={() => { setForm(emptyForm); setSelectedServiceIds([]); setShowForm(true); }}
          className="btn-primary"
        >
          + Yangi shifokor
        </button>
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
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {doctors.map((d) => (
              <div key={d.id} className="card relative">
                <div className="absolute top-3 right-3 flex gap-1">
                  <button
                    onClick={() => router.push(`/admin/doctors/${d.id}/edit`)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                    title="Tahrirlash"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(d.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                    title="O'chirish"
                  >
                    🗑️
                  </button>
                </div>

                <DoctorCard doctor={d} size="md" />
                {d.phone && <p className="text-xs text-gray-400 mt-2 ml-15">{d.phone}</p>}
                {d.branch && <p className="text-xs text-gray-400">{d.branch.name}</p>}

                <DoctorQueueModes doctor={d} onSaved={fetchDoctors} />
              </div>
            ))}
          </div>

          {confirmDeleteId && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-xl">
                <h3 className="font-semibold text-lg mb-2">Shifokorni o&apos;chirish</h3>
                <p className="text-gray-600 text-sm mb-4">
                  {(() => {
                    const d = doctors.find((x) => x.id === confirmDeleteId);
                    return d ? `${d.lastName} ${d.firstName}` : "";
                  })()}
                  &nbsp;ni o&apos;chirmoqchimisiz? Bu amal aktiv holatdan chiqaradi.
                </p>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    disabled={deleting}
                    className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
                  >
                    Bekor qilish
                  </button>
                  <button
                    onClick={() => handleDelete(confirmDeleteId)}
                    disabled={deleting}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
                  >
                    {deleting ? "O'chirilmoqda..." : "Ha, o'chirish"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
