"use client";

import { useState } from "react";

type Props = {
  clinicId: string;
  onClose: () => void;
  onCreated: () => void;
};

export function CreateBranchModal({ clinicId, onClose, onCreated }: Props) {
  const [form, setForm] = useState({
    name: "",
    address: "",
    phone: "",
    workingHours: "",
    nearbyMetro: "",
    latitude: "",
    longitude: "",
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setErr(null);

    const payload: Record<string, unknown> = {
      name: form.name,
      address: form.address,
      phone: form.phone || undefined,
      workingHours: form.workingHours || undefined,
      nearbyMetro: form.nearbyMetro || undefined,
    };
    if (form.latitude) payload.latitude = parseFloat(form.latitude);
    if (form.longitude) payload.longitude = parseFloat(form.longitude);

    const res = await fetch(`/api/admin/clinics/${clinicId}/branches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok || !data.success) {
      setErr(data.error?.message || "Xato yuz berdi");
      return;
    }
    onCreated();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Yangi filial</h2>

        <div className="space-y-3">
          <Field label="Filial nomi *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Field label="Manzil *" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
          <Field label="Telefon" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="+998 71 123 45 67" />
          <Field label="Ish vaqti" value={form.workingHours} onChange={(v) => setForm({ ...form, workingHours: v })} placeholder="09:00–18:00, Du–Sh" />
          <Field label="Yaqin metro" value={form.nearbyMetro} onChange={(v) => setForm({ ...form, nearbyMetro: v })} placeholder="Mustaqillik" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude" value={form.latitude} onChange={(v) => setForm({ ...form, latitude: v })} placeholder="41.311" />
            <Field label="Longitude" value={form.longitude} onChange={(v) => setForm({ ...form, longitude: v })} placeholder="69.279" />
          </div>
        </div>

        {err && <div className="mt-3 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{err}</div>}

        <div className="mt-6 flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={loading || !form.name.trim() || !form.address.trim()}
            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
          >
            {loading ? "Yaratilmoqda..." : "Yaratish"}
          </button>
          <button onClick={onClose} className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">
            Bekor
          </button>
        </div>
      </div>
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
