"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { DoctorCard } from "@/components/DoctorCard";
import { PhoneInput, isValidPhone } from "@/components/forms/PhoneInput";

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
  isHidden: boolean;
  services: ServiceItem[];
  emId?: string | null;
}

interface Credentials {
  phone: string | null;
  password: string;
  name: string;
  emId?: string | null;
}

interface Branch {
  id: string;
  name: string;
}

const emptyForm = {
  firstName: "", lastName: "", specialty: "", phone: "", photoUrl: "",
  role: "doctor" as StaffRole,
  branchId: "",
};

function QueueModeSelector({
  doctorId,
  serviceId,
  serviceName,
  currentMode,
  onChange,
}: {
  doctorId: string;
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
            name={`queueMode-${doctorId}-${serviceId}`}
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
            name={`queueMode-${doctorId}-${serviceId}`}
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

function DoctorQueueModes({ doctor, onSaved }: { doctor: Doctor; onSaved?: () => void }) {
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
      // onSaved intentionally not called — local modes state is already correct after PATCH
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
            doctorId={doctor.id}
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
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [isBranchAdmin, setIsBranchAdmin] = useState(false);

  // ID bilan kiritish modal
  const [showAttach, setShowAttach] = useState(false);
  const [attachEmId, setAttachEmId] = useState("");
  const [attachRole, setAttachRole] = useState<"doctor" | "receptionist">("doctor");
  const [attachBranchId, setAttachBranchId] = useState("");
  const [attachServiceIds, setAttachServiceIds] = useState<string[]>([]);
  const [attachSubmitting, setAttachSubmitting] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchDoctors();
    fetchServices();
    fetchBranches();
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

  async function fetchBranches() {
    const role = localStorage.getItem("user_role");
    const myBranchId = localStorage.getItem("branchId");
    if (role === "branch_admin" && myBranchId) {
      setIsBranchAdmin(true);
      setForm((prev) => ({ ...prev, branchId: myBranchId }));
      return;
    }
    const res = await fetch("/api/admin/branches", { credentials: "include" });
    const json = await res.json();
    if (json.success) {
      setBranches(json.data);
      if (json.data.length === 1) {
        setForm((prev) => ({ ...prev, branchId: json.data[0].id }));
      }
    }
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
      if (!form.branchId) {
        alert("Filialni tanlang");
        return;
      }

      const payload: Record<string, unknown> = {
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        role: form.role,
        branchId: form.branchId,
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
        const defaultBranchId = isBranchAdmin
          ? (localStorage.getItem("branchId") || "")
          : branches.length === 1 ? branches[0].id : "";
        setForm({ ...emptyForm, branchId: defaultBranchId });
        setSelectedServiceIds([]);
        setCredentials({
          phone: json.data.phone,
          password: json.data.generatedPassword,
          name: `${form.firstName} ${form.lastName}`.trim(),
          emId: json.data.emId ?? null,
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

  async function toggleHidden(doctorId: string, currentHidden: boolean) {
    try {
      const res = await fetch(`/api/admin/doctors/${doctorId}/visibility`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isHidden: !currentHidden }),
      });
      const json = await res.json();
      if (json.success) {
        setDoctors((prev) =>
          prev.map((d) => (d.id === doctorId ? { ...d, isHidden: !currentHidden } : d))
        );
      } else {
        alert(json.error?.message || "Xatolik");
      }
    } catch {
      alert("Server bilan bog'lanishda xatolik");
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

  async function handleAttach(e: React.FormEvent) {
    e.preventDefault();
    if (attachSubmitting) return;
    if (!attachEmId.trim()) { setAttachError("EM ID kiriting"); return; }
    setAttachSubmitting(true);
    setAttachError(null);
    try {
      const endpoint = attachRole === "doctor" ? "/api/admin/doctors/attach" : "/api/admin/staff/attach";
      const payload: Record<string, unknown> = { emId: attachEmId.trim(), branchId: attachBranchId || null };
      if (attachRole === "doctor") payload.serviceIds = attachServiceIds;

      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        setShowAttach(false);
        setAttachEmId(""); setAttachServiceIds([]);
        if (json.data?.mutual) {
          // Ikkala tomon xohlagan — darhol ulandi
          alert("✅ Xodim ham so'rov yuborgan edi — darhol ulandi!");
          fetchDoctors();
        } else if (json.data?.invited) {
          // Taklif yuborildi — xodim tasdiqlashi kutilmoqda
          alert("📬 Taklif yuborildi. Xodim ilovada tasdiqlashi kutilmoqda.");
        } else {
          // Receptionist to'g'ridan ulangan
          fetchDoctors();
        }
      } else {
        setAttachError(json.error?.message || "Xatolik yuz berdi");
      }
    } catch {
      setAttachError("Server bilan bog'lanishda xatolik");
    } finally {
      setAttachSubmitting(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Shifokorlar</h1>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setAttachEmId(""); setAttachError(null);
              setAttachRole("doctor"); setAttachServiceIds([]);
              setAttachBranchId(isBranchAdmin ? (localStorage.getItem("branchId") || "") : branches.length === 1 ? branches[0].id : "");
              setShowAttach(true);
              setTimeout(() => attachInputRef.current?.focus(), 100);
            }}
            className="px-3 py-2 text-sm font-medium border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition"
          >
            🔗 ID bilan kiritish
          </button>
          <button
            onClick={() => {
              const defaultBranchId = isBranchAdmin
                ? (localStorage.getItem("branchId") || "")
                : branches.length === 1 ? branches[0].id : "";
              setForm({ ...emptyForm, branchId: defaultBranchId });
              setSelectedServiceIds([]);
              setShowForm(true);
            }}
            className="btn-primary"
          >
            + Yangi xodim
          </button>
        </div>
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

            {/* Filial tanlash — branch_admin uchun yashiriladi (avtomatik o'z filiali) */}
            {!isBranchAdmin && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Filial *</label>
                <select
                  className="input"
                  value={form.branchId}
                  onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                  required
                >
                  {branches.length !== 1 && <option value="">-- Filialni tanlang --</option>}
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                {branches.length === 0 && (
                  <p className="mt-1 text-xs text-red-600">⚠️ Hali filial qo&apos;shilmagan.</p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ism *</label>
              <input className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Familya</label>
              <input className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </div>

            <div>
              <PhoneInput
                label="Telefon (login) *"
                value={form.phone}
                onChange={(v) => setForm({ ...form, phone: v })}
                error={form.phone && !isValidPhone(form.phone) ? "Raqamni to'liq kiriting" : undefined}
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
              <button type="submit" disabled={submitting || (!isBranchAdmin && !form.branchId)} className="btn-primary disabled:opacity-50">
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
              <div key={d.id} className={`card relative ${d.isHidden ? "opacity-60 bg-gray-50" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <DoctorCard doctor={d} size="md" />
                  </div>
                  <details className="relative shrink-0 [&_summary::-webkit-details-marker]:hidden">
                    <summary
                      className="list-none cursor-pointer select-none p-1.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
                      title="Amallar"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <circle cx="12" cy="5" r="1.8" />
                        <circle cx="12" cy="12" r="1.8" />
                        <circle cx="12" cy="19" r="1.8" />
                      </svg>
                    </summary>
                    <div className="absolute right-0 top-full mt-1 z-30 w-52 rounded-xl border border-gray-200 bg-white shadow-lg py-1 text-sm">
                      <button
                        onClick={(e) => { (e.currentTarget.closest("details") as HTMLDetailsElement).open = false; toggleHidden(d.id, d.isHidden); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-gray-700 hover:bg-gray-50"
                      >
                        <span>{d.isHidden ? "👁️" : "🙈"}</span> {d.isHidden ? "Ko'rsatish" : "Yashirish"}
                      </button>
                      <button
                        onClick={(e) => { (e.currentTarget.closest("details") as HTMLDetailsElement).open = false; handleResetPassword(d.id, `${d.lastName} ${d.firstName}`); }}
                        disabled={resettingId === d.id}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                      >
                        <span>🔑</span> Parolni tiklash
                      </button>
                      <button
                        onClick={(e) => { (e.currentTarget.closest("details") as HTMLDetailsElement).open = false; router.push(`/admin/doctors/${d.id}/stats`); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-gray-700 hover:bg-gray-50"
                      >
                        <span>📉</span> Statistika
                      </button>
                      <button
                        onClick={(e) => { (e.currentTarget.closest("details") as HTMLDetailsElement).open = false; router.push(`/admin/doctors/${d.id}/edit`); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-gray-700 hover:bg-gray-50"
                      >
                        <span>✏️</span> Tahrirlash
                      </button>
                      <div className="my-1 border-t border-gray-100" />
                      <button
                        onClick={(e) => { (e.currentTarget.closest("details") as HTMLDetailsElement).open = false; setConfirmDeleteId(d.id); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-red-600 hover:bg-red-50"
                      >
                        <span>🗑️</span> Ishdan bo'shatish
                      </button>
                    </div>
                  </details>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {d.emId && (
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-mono">
                      {d.emId}
                    </span>
                  )}
                  {d.isHidden && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
                      🙈 Bemorga ko&apos;rinmaydi
                    </span>
                  )}
                </div>
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
                  &nbsp;— Ushbu tugma orqali xodimni olib tashlaganingiz rasman ishdan bo&apos;shatish bilan tenglashtiriladi. Qayta ishga qabul qilinganda statistika uchun yangi bo&apos;lim ochiladi. Eski ko&apos;rsatkichlar saqlanadi.
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

      {/* ID bilan kiritish modali */}
      {showAttach && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="font-semibold text-lg mb-1">🔗 EM ID bilan taklif yuborish</h3>
            <p className="text-sm text-gray-500 mb-4">
              {attachRole === "doctor"
                ? "Shifokorning EM ID'sini kiriting — taklif yuboriladi, xodim ilovada tasdiqlashi kerak bo'ladi."
                : "Qabulxona xodimining EM ID'sini kiriting — tizimga darhol biriktiriladi."}
            </p>
            <form onSubmit={handleAttach} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={attachRole === "doctor"} onChange={() => setAttachRole("doctor")} className="w-4 h-4 text-blue-600" />
                    <span className="text-sm">👨‍⚕️ Shifokor</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={attachRole === "receptionist"} onChange={() => setAttachRole("receptionist")} className="w-4 h-4 text-blue-600" />
                    <span className="text-sm">🏥 Qabulxona</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">EM ID *</label>
                <input
                  ref={attachInputRef}
                  className="input font-mono"
                  value={attachEmId}
                  onChange={(e) => setAttachEmId(e.target.value.toUpperCase())}
                  placeholder="EM000042"
                  required
                />
              </div>

              {!isBranchAdmin && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Filial</label>
                  <select className="input" value={attachBranchId} onChange={(e) => setAttachBranchId(e.target.value)}>
                    <option value="">-- Tanlang (ixtiyoriy) --</option>
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              )}

              {attachRole === "doctor" && services.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Xizmatlar (ixtiyoriy)</label>
                  <div className="grid grid-cols-1 gap-1 max-h-36 overflow-y-auto border rounded-lg p-2 bg-gray-50">
                    {services.map((svc) => (
                      <label key={svc.id} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={attachServiceIds.includes(svc.id)}
                          onChange={(e) => setAttachServiceIds((prev) => e.target.checked ? [...prev, svc.id] : prev.filter((x) => x !== svc.id))}
                        />
                        <span className="truncate">{svc.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {attachError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{attachError}</div>
              )}

              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={attachSubmitting} className="flex-1 btn-primary disabled:opacity-50">
                  {attachSubmitting
                    ? (attachRole === "doctor" ? "Yuklanmoqda..." : "Ulanmoqda...")
                    : (attachRole === "doctor" ? "Taklif yuborish" : "Ulash")}
                </button>
                <button type="button" className="flex-1 btn-secondary" onClick={() => setShowAttach(false)}>Bekor</button>
              </div>
            </form>
          </div>
        </div>
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
              <div className="mb-1">Parol: <span className="font-bold text-gray-900">{credentials.password}</span></div>
              {credentials.emId && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  Xodim ID: <span className="font-bold text-blue-700">{credentials.emId}</span>
                </div>
              )}
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
