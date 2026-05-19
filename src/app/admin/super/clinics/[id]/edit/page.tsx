"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

interface Clinic {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  description: string | null;
  workingHours: string | null;
  logoUrl: string | null;
  isActive: boolean;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

export default function EditClinicPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [logoPreviewError, setLogoPreviewError] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/super/clinics/${id}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setClinic(j.data);
        else setFetchError(j.error?.message ?? "Klinika topilmadi");
      })
      .catch(() => setFetchError("Tarmoq xatosi"))
      .finally(() => setLoading(false));
  }, [id]);

  function set<K extends keyof Clinic>(key: K, value: Clinic[K]) {
    setClinic((prev) => prev ? { ...prev, [key]: value } : prev);
    if (key === "logoUrl") setLogoPreviewError(false);
  }

  async function handleSave() {
    if (!clinic) return;
    setSaving(true);
    setSaveError(null);
    setSuccess(false);

    try {
      const res = await fetch(`/api/admin/super/clinics/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: clinic.name,
          phone: clinic.phone,
          address: clinic.address,
          city: clinic.city,
          description: clinic.description,
          workingHours: clinic.workingHours,
          logoUrl: clinic.logoUrl,
          isActive: clinic.isActive,
        }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) {
        setSaveError(j.error?.message ?? j.error ?? "Xato yuz berdi");
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push("/admin/super/clinics"), 1500);
    } catch {
      setSaveError("Tarmoq xatosi");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-gray-400">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Yuklanmoqda...</span>
        </div>
      </div>
    );
  }

  if (fetchError || !clinic) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700 text-sm">
        {fetchError ?? "Klinika topilmadi."}
        <Link href="/admin/super/clinics" className="underline ml-2">Orqaga</Link>
      </div>
    );
  }

  const logoSrc = clinic.logoUrl?.trim() || null;

  return (
    <div className="max-w-2xl space-y-6">
      {/* Breadcrumb */}
      <div className="text-xs text-gray-400">
        <Link href="/admin/super/clinics" className="hover:text-gray-600">Klinikalar</Link>
        <span className="mx-1.5">/</span>
        <Link href={`/admin/super/clinics/${id}`} className="hover:text-gray-600">{clinic.name}</Link>
        <span className="mx-1.5">/</span>
        <span className="text-gray-600">Tahrirlash</span>
      </div>

      <h1 className="text-2xl font-bold text-gray-900">Klinikani tahrirlash</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        {/* Logo preview + URL */}
        <div className="flex items-start gap-4">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-blue-100 to-blue-200 border-2 border-gray-200 flex items-center justify-center flex-shrink-0">
            {logoSrc && !logoPreviewError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoSrc}
                alt={clinic.name}
                className="w-full h-full object-cover"
                onError={() => setLogoPreviewError(true)}
              />
            ) : (
              <span className="text-4xl">🏥</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <Field label="Logo URL">
              <input
                type="url"
                value={clinic.logoUrl ?? ""}
                onChange={(e) => set("logoUrl", e.target.value || null)}
                placeholder="https://example.com/logo.png"
                className="input w-full"
              />
            </Field>
            <p className="text-xs text-gray-400 mt-1">
              .jpg · .png · .webp · .svg — URL kiritgach darrov preview ko'rinadi
            </p>
            {logoPreviewError && logoSrc && (
              <p className="text-xs text-orange-500 mt-1">URL noto'g'ri yoki rasm yuklanmadi</p>
            )}
          </div>
        </div>

        {/* Klinika nomi */}
        <Field label="Klinika nomi *">
          <input
            value={clinic.name}
            onChange={(e) => set("name", e.target.value)}
            className="input w-full"
            placeholder="Klinika nomi"
          />
        </Field>

        {/* Telefon + Shahar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Telefon">
            <input
              value={clinic.phone ?? ""}
              onChange={(e) => set("phone", e.target.value || null)}
              className="input w-full"
              placeholder="+998 90 000 00 00"
            />
          </Field>
          <Field label="Shahar">
            <input
              value={clinic.city ?? ""}
              onChange={(e) => set("city", e.target.value || null)}
              className="input w-full"
              placeholder="Toshkent"
            />
          </Field>
        </div>

        {/* Manzil */}
        <Field label="Manzil">
          <input
            value={clinic.address ?? ""}
            onChange={(e) => set("address", e.target.value || null)}
            className="input w-full"
            placeholder="Ko'cha, uy"
          />
        </Field>

        {/* Ish vaqti */}
        <Field label="Ish vaqti">
          <input
            value={clinic.workingHours ?? ""}
            onChange={(e) => set("workingHours", e.target.value || null)}
            className="input w-full"
            placeholder="08:00 – 20:00"
          />
        </Field>

        {/* Tavsif */}
        <Field label="Tavsif">
          <textarea
            value={clinic.description ?? ""}
            onChange={(e) => set("description", e.target.value || null)}
            rows={3}
            className="input w-full resize-none"
            placeholder="Klinika haqida qisqacha ma'lumot"
          />
        </Field>

        {/* Holat */}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => set("isActive", !clinic.isActive)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
              clinic.isActive ? "bg-indigo-600" : "bg-gray-200"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                clinic.isActive ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <span className="text-sm text-gray-700">
            {clinic.isActive ? "Faol — foydalanuvchilar ko'ra oladi" : "Nofaol — yashirilgan"}
          </span>
        </div>
      </div>

      {/* Xato / Muvaffaqiyat */}
      {saveError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {saveError}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl px-4 py-3 text-sm">
          Saqlandi! Klinikalar ro'yxatiga qaytmoqda...
        </div>
      )}

      {/* Tugmalar */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving || !clinic.name.trim()}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-lg text-sm transition-colors"
        >
          {saving ? "Saqlanmoqda..." : "Saqlash"}
        </button>
        <button
          onClick={() => router.back()}
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-6 py-2.5 rounded-lg text-sm transition-colors"
        >
          Bekor
        </button>
      </div>
    </div>
  );
}
