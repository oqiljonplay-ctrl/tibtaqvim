"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DoctorCard } from "@/components/DoctorCard";

type QueueMode = "live" | "online" | "slot";
type StaffRole = "doctor" | "receptionist";

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

interface Credentials {
  phone: string | null;
  password: string;
  name: string;
}

const emptyForm = {
  firstName: "", lastName: "", specialty: "", phone: "", photoUrl: "",
  role: "doctor" as StaffRole,
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

  if (doctor.services.length === 0) {
    return (
      <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-sm text-amber-800 font-medium">
          ⚠️ Hali biror xizmatga biriktirilmagan
        </p>
        <p className="text-xs text-amber-700 mt-1">
          Bemorlar uchun ko&apos;rinmaydi.
        </p>
      </div>
    );
  }

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
  const [submitting, setSubmitting] = useState(false);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);

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
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        role: form.role,
      };

      if (form.role === "doctor") {
        payload.specialty = form.specialty;
        payload.photoUrl = form.photoUrl || null;
        payload.serviceIds = (() => {
          const ids = [...selectedServiceIds];
          const matched = services.find((s) => s.name === form.specialty);
          if (matched && !ids.includes(matched.id)) ids.push(matched.id);
          return ids;
        })();
      }

      const res = await fetch("/api/admin/staff", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        setShowForm(false);
        setForm(emptyForm);
        setSelectedServiceIds([]);
        setCredentials({
          phone: json.data.phone,
          password: json.data.generatedPassword,
          name: `${form.firstName} ${form.lastName}`.trim(),
        });
        if (form.role === "doctor") fetchDoctors();
      } else {
        alert(json.error?.message || "Saqlashda xatolik");
      }
    } catch {
      alert("Server bilan bog'lanishda xatolik");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword(doctorId: string, doctorName: string) {
    setResettingId(doctorId);
    try {
      const res = await fetch(`/api/admin/doctors/${doctorId}/reset-password`, {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json();
      if (json.success) {
        setCredentials({
          phone: json.data.phone,
          password: json.data.newPassword,
          name: json.data.name || doctorName,
        });
      } else {
        alert(json.error?.message || "Parolni tiklashda xatolik");
      }
    } catch {
      alert("Server bilan bog'lanishda xatolik");
    } finally {
      setResettingId(null);
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
          + Yangi xodim
        </button>
      </div>

      {showForm && (
        <div className="card mb-6">
          <h2 className="text-lg font-semibold mb-4">Yangi xodim qo&apos;shish</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Rol tanlash */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Rol *</label>
              <div className="flex gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    value="doctor"
                    checked={form.role === "doctor"}
                    onChange={() => setForm({ ...form, role: "doctor", specialty: "" })}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm">👨‍⚕️ Shifokor</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="role"
                    value="receptionist"
                    checked={form.role === "receptionist"}
                    onChange={() => setForm({ ...form, role: "receptionist", specialty: "", photoUrl: "" })}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm">🏥 Qabulxona</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ism *</label>
              <input className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Familya</label>
              <input className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefon (login) *</label>
              <input
                className="input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+998 90 000 00 00"
                required
              />
            </div>

            {form.role === "doctor" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mutaxassislik *</label>
                <select
                  className="input"
                  value={form.specialty}
                  onChange={(e) => {
                    const val = e.target.value;
                    setForm({ ...form, specialty: val });
                    if (val) {
                      const matched = services.find((s) => s.name === val);
                      if (matched && !selectedServiceIds.includes(matched.id)) {
                        setSelectedServiceIds((prev) => [...prev, matched.id]);
                      }
                    }
                  }}
                  required
                >
                  <option value="">-- Mutaxassislikni tanlang --</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
                {services.length === 0 && (
                  <p className="mt-1 text-xs text-amber-600">
                    ⚠️ Hech qanday xizmat topilmadi.{" "}
                    <a href="/admin/services" className="underline">Xizmatlar sahifasida</a> xizmat qo&apos;shing.
                  </p>
                )}
                {form.specialty && (
                  <p className="mt-1 text-xs text-gray-500">
                    &quot;{form.specialty}&quot; xizmati avtomatik biriktiriladi.
                  </p>
                )}
              </div>
            )}

            {form.role === "doctor" && (
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
            )}

            {form.role === "doctor" && services.length > 0 && (
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

            <div className="md:col-span-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs text-blue-700">
                🔑 Login uchun parol avtomatik generatsiya qilinadi va qo&apos;shishdan so&apos;ng bir marta ko&apos;rsatiladi.
              </p>
            </div>

            <div className="md:col-span-2 flex gap-3">
              <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-50">
                {submitting ? "Saqlanmoqda..." : "Qo'shish"}
              </button>
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
                    onClick={() => handleResetPassword(d.id, `${d.lastName} ${d.firstName}`)}
                    disabled={resettingId === d.id}
                    className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition disabled:opacity-40"
                    title="Parolni tiklash"
                  >
                    🔑
                  </button>
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
                {d.branch ? (
                  <p className="text-xs text-gray-500 mt-1">🏥 {d.branch.name}</p>
                ) : (
                  <p className="text-xs text-amber-600 mt-1">⚠️ Filial belgilanmagan</p>
                )}

                <DoctorQueueModes doctor={d} onSaved={fetchDoctors} />
              </div>
            ))}
          </div>

          {/* Shifokor o'chirish modali */}
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

      {/* Credentials modali — yangi xodim yoki parol tiklash */}
      {credentials && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-xl">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">🔑</span>
              <h3 className="font-semibold text-lg">
                {credentials.phone ? "Xodim qo’shildi" : "Parol tiklandi"}
              </h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">{credentials.name}</p>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 font-mono text-sm mb-3 select-all">
              {credentials.phone && (
                <div className="mb-1">Login: <span className="font-bold text-gray-900">{credentials.phone}</span></div>
              )}
              <div>Parol: <span className="font-bold text-gray-900">{credentials.password}</span></div>
            </div>
            <div className="flex items-start gap-2 mb-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <span className="flex-shrink-0">⚠️</span>
              <p className="text-amber-800 text-xs">Bu parol qayta ko&apos;rsatilmaydi. Hoziroq saqlab qo&apos;ying.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const text = credentials.phone
                    ? `Login: ${credentials.phone}\nParol: ${credentials.password}`
                    : `Parol: ${credentials.password}`;
                  navigator.clipboard.writeText(text);
                }}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              >
                Nusxalash
              </button>
              <button
                onClick={() => setCredentials(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
