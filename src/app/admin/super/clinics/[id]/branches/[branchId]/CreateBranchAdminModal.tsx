"use client";

import { useState } from "react";
import { PhoneInput, isValidPhone } from "@/components/forms/PhoneInput";

type Props = {
  clinicId: string;
  branchId: string;
  onClose: () => void;
  onCreated: (credentials: { username: string; password: string }) => void;
};

export function CreateBranchAdminModal({ clinicId, branchId, onClose, onCreated }: Props) {
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "" });
  const [autoPassword, setAutoPassword] = useState(true);
  const [manualPassword, setManualPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setErr(null);

    const res = await fetch(`/api/admin/clinics/${clinicId}/branches/${branchId}/admins`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: form.firstName,
        lastName: form.lastName || undefined,
        phone: form.phone || undefined,
        autoPassword,
        password: autoPassword ? undefined : manualPassword,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok || !data.success) {
      setErr(data.error?.message || "Xato yuz berdi");
      return;
    }
    onCreated(data.data.credentials);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-md w-full">
        <h2 className="text-xl font-bold text-gray-900 mb-1">Yangi filial admini</h2>
        <p className="text-xs text-gray-500 mb-4">Login: <code className="bg-gray-100 px-1 rounded">tib_badmin_xxxxxxx</code></p>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ism *</label>
            <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="input" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Familiya</label>
            <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="input" />
          </div>
          <div>
            <PhoneInput
              label="Telefon"
              value={form.phone}
              onChange={(v) => setForm({ ...form, phone: v })}
              error={form.phone && !isValidPhone(form.phone) ? "Raqamni to'liq kiriting" : undefined}
            />
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input type="checkbox" checked={autoPassword} onChange={(e) => setAutoPassword(e.target.checked)} />
              <span className="text-sm">Parolni avtomatik yaratish</span>
            </label>
            {!autoPassword && (
              <input
                value={manualPassword}
                onChange={(e) => setManualPassword(e.target.value)}
                placeholder="Parol (8+ belgi, 1 harf, 1 raqam)"
                className="input font-mono"
              />
            )}
          </div>
        </div>

        {err && <div className="mt-3 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{err}</div>}

        <div className="mt-6 flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={loading || !form.firstName.trim()}
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
