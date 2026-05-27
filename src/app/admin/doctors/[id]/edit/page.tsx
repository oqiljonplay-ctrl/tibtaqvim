"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

interface ServiceItem {
  id: string;
  name: string;
  price: number;
  type: string;
}

interface Branch {
  id: string;
  name: string;
}

const emptyForm = {
  firstName: "", lastName: "", specialty: "", phone: "", photoUrl: "", branchId: "",
};

export default function EditDoctorPage() {
  const router = useRouter();
  const params = useParams();
  const doctorId = params.id as string;

  const [form, setForm] = useState(emptyForm);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const clinicId = localStorage.getItem("clinicId") || "";
    Promise.all([
      fetch(`/api/admin/doctors/${doctorId}`, { credentials: "include" }).then((r) => r.json()),
      fetch(`/api/admin/services${clinicId ? `?clinicId=${clinicId}` : ""}`, { credentials: "include" }).then((r) => r.json()),
      fetch("/api/admin/branches", { credentials: "include" }).then((r) => r.json()),
    ]).then(([doctorJson, servicesJson, branchesJson]) => {
      if (doctorJson.success) {
        const d = doctorJson.data;
        setForm({
          firstName: d.firstName,
          lastName: d.lastName,
          specialty: d.specialty,
          phone: d.phone ?? "",
          photoUrl: d.photoUrl ?? "",
          branchId: d.branchId ?? "",
        });
        setSelectedServiceIds(d.services.map((s: ServiceItem) => s.id));
      } else {
        setError("Shifokor ma'lumotlari topilmadi");
      }
      if (servicesJson.success) setServices(servicesJson.data);
      if (branchesJson.success) setBranches(branchesJson.data);
      setLoading(false);
    }).catch(() => {
      setError("Ma'lumotlarni yuklashda xatolik");
      setLoading(false);
    });
  }, [doctorId]);

  function toggleService(id: string, checked: boolean) {
    setSelectedServiceIds((prev) =>
      checked ? [...prev, id] : prev.filter((x) => x !== id)
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const finalServiceIds = [...selectedServiceIds];
      const matched = services.find((s) => s.name === form.specialty);
      if (matched && !finalServiceIds.includes(matched.id)) finalServiceIds.push(matched.id);

      const res = await fetch(`/api/admin/doctors/${doctorId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          branchId: form.branchId || null,
          photoUrl: form.photoUrl || null,
          phone: form.phone || null,
          serviceIds: finalServiceIds,
        }),
      });
      const json = await res.json();
      if (json.success) {
        router.push("/admin/doctors");
      } else {
        setError(json.error?.message || "Saqlashda xatolik");
      }
    } catch {
      setError("Server bilan bog'lanishda xatolik");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="text-gray-400 text-sm text-center py-12">Yuklanmoqda...</div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push("/admin/doctors")}
          className="text-gray-500 hover:text-gray-700 text-sm"
        >
          ← Orqaga
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Shifokorni tahrirlash</h1>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="card">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ism *</label>
            <input
              className="input"
              value={form.firstName}
              onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Familya *</label>
            <input
              className="input"
              value={form.lastName}
              onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Filial</label>
            <select
              className="input"
              value={form.branchId}
              onChange={(e) => setForm((p) => ({ ...p, branchId: e.target.value }))}
            >
              <option value="">-- Filial yo&apos;q --</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mutaxassislik *</label>
            <select
              className="input"
              value={form.specialty}
              onChange={(e) => {
                const val = e.target.value;
                setForm((p) => ({ ...p, specialty: val }));
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
              {form.specialty && !services.some((s) => s.name === form.specialty) && (
                <option value={form.specialty} disabled>
                  {form.specialty} (eski qiymat — yangilang)
                </option>
              )}
              {services.map((s) => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
            {form.specialty && (
              <p className="mt-1 text-xs text-gray-500">
                &quot;{form.specialty}&quot; xizmati avtomatik biriktiriladi.
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
            <input
              className="input"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              placeholder="+998 90 000 00 00"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Foto URL (ixtiyoriy)</label>
            <input
              className="input"
              type="url"
              value={form.photoUrl}
              onChange={(e) => setForm((p) => ({ ...p, photoUrl: e.target.value }))}
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
            <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
              {saving ? "Saqlanmoqda..." : "Saqlash"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => router.push("/admin/doctors")}
            >
              Bekor
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
