"use client";

import { useState } from "react";

type Branch = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  workingHours: string | null;
  nearbyMetro: string | null;
  latitude: number | null;
  longitude: number | null;
  isActive: boolean;
};

export function BranchInfoTab({
  branch,
  clinicId,
  onUpdate,
}: {
  branch: Branch;
  clinicId: string;
  onUpdate: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: branch.name,
    address: branch.address ?? "",
    phone: branch.phone ?? "",
    workingHours: branch.workingHours ?? "",
    nearbyMetro: branch.nearbyMetro ?? "",
    latitude: branch.latitude?.toString() ?? "",
    longitude: branch.longitude?.toString() ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setErr(null);

    const payload: Record<string, unknown> = {
      name: form.name,
      address: form.address,
      phone: form.phone || null,
      workingHours: form.workingHours || null,
      nearbyMetro: form.nearbyMetro || null,
      latitude: form.latitude ? parseFloat(form.latitude) : null,
      longitude: form.longitude ? parseFloat(form.longitude) : null,
    };

    const res = await fetch(`/api/admin/clinics/${clinicId}/branches/${branch.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok || !data.success) {
      setErr(data.error?.message || "Xato yuz berdi");
      return;
    }
    setEditing(false);
    onUpdate();
  };

  if (!editing) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="space-y-3 mb-6">
          <InfoRow label="Nomi" value={branch.name} />
          <InfoRow label="Manzil" value={branch.address || "—"} />
          <InfoRow label="Telefon" value={branch.phone || "—"} />
          <InfoRow label="Ish vaqti" value={branch.workingHours || "—"} />
          <InfoRow label="Yaqin metro" value={branch.nearbyMetro || "—"} />
          <InfoRow
            label="Koordinatalar"
            value={
              branch.latitude && branch.longitude
                ? `${branch.latitude}, ${branch.longitude}`
                : "—"
            }
          />
        </div>
        <button
          onClick={() => setEditing(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
        >
          Tahrirlash
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
      <Field label="Nomi" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
      <Field label="Manzil" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
      <Field label="Telefon" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
      <Field label="Ish vaqti" value={form.workingHours} onChange={(v) => setForm({ ...form, workingHours: v })} placeholder="09:00–18:00, Du–Sh" />
      <Field label="Yaqin metro" value={form.nearbyMetro} onChange={(v) => setForm({ ...form, nearbyMetro: v })} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Latitude" value={form.latitude} onChange={(v) => setForm({ ...form, latitude: v })} placeholder="41.311" />
        <Field label="Longitude" value={form.longitude} onChange={(v) => setForm({ ...form, longitude: v })} placeholder="69.279" />
      </div>

      {err && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{err}</div>}

      <div className="flex gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
        >
          {saving ? "Saqlanmoqda..." : "Saqlash"}
        </button>
        <button
          onClick={() => setEditing(false)}
          className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm"
        >
          Bekor
        </button>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4">
      <div className="w-36 text-sm text-gray-500 flex-shrink-0">{label}:</div>
      <div className="text-sm font-medium text-gray-900">{value}</div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input"
      />
    </div>
  );
}
