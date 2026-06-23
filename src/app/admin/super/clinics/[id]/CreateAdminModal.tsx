"use client";

import { useState } from "react";
import { PhoneInput, isValidPhone } from "@/components/forms/PhoneInput";

type Props = {
  clinicId: string;
  onClose: () => void;
  onCreated: () => void;
};

type Credentials = { username: string; password: string };

export function CreateAdminModal({ clinicId, onClose, onCreated }: Props) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [autoPassword, setAutoPassword] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [created, setCreated] = useState<Credentials | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/super/clinics/${clinicId}/admins`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName: lastName || undefined,
          phone: phone || undefined,
          autoPassword,
          password: autoPassword ? undefined : password,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErr(data.error?.message ?? data.error ?? "Xato yuz berdi");
        return;
      }
      setCreated(data.data.credentials);
    } catch {
      setErr("Tarmoq xatosi");
    } finally {
      setLoading(false);
    }
  };

  const copy = (text: string) => navigator.clipboard.writeText(text);

  if (created) {
    return (
      <Modal onClose={onCreated}>
        <h2 className="text-xl font-bold mb-4 text-gray-900">Admin yaratildi</h2>
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
          <p className="text-sm text-yellow-800 font-semibold">
            Bu ma'lumotlar faqat shu safar ko'rsatiladi. Saqlab oling!
          </p>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500">Login (username)</label>
            <div className="flex gap-2 mt-1">
              <code className="flex-1 px-3 py-2 bg-gray-100 rounded font-mono text-sm">{created.username}</code>
              <button onClick={() => copy(created.username)} className="px-3 py-2 border rounded hover:bg-gray-50 text-sm">Nusxa</button>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">Parol</label>
            <div className="flex gap-2 mt-1">
              <code className="flex-1 px-3 py-2 bg-gray-100 rounded font-mono text-sm">{created.password}</code>
              <button onClick={() => copy(created.password)} className="px-3 py-2 border rounded hover:bg-gray-50 text-sm">Nusxa</button>
            </div>
          </div>
          <button
            onClick={() => copy(`Login: ${created.username}\nParol: ${created.password}`)}
            className="w-full px-3 py-2 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 text-sm"
          >
            Ikkalasini birga nusxa olish
          </button>
        </div>
        <button onClick={onCreated} className="mt-6 w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
          Yopish
        </button>
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="text-xl font-bold mb-4 text-gray-900">Yangi admin qo'shish</h2>
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Ism *</label>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="input" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Familiya</label>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="input" />
        </div>
        <div>
          <PhoneInput
            label="Telefon"
            value={phone}
            onChange={setPhone}
            error={phone && !isValidPhone(phone) ? "Raqamni to'liq kiriting" : undefined}
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={autoPassword} onChange={(e) => setAutoPassword(e.target.checked)} />
          <span className="text-sm">Parolni avtomatik yaratish</span>
        </label>
        {!autoPassword && (
          <div>
            <label className="block text-sm font-medium mb-1">Parol *</label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Kamida 8 belgi, 1 harf, 1 raqam"
              className="input font-mono"
            />
          </div>
        )}
        <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded">
          Username avtomatik yaratiladi: <code>tib_admin_xxxxxx</code>
        </div>
      </div>
      {err && <div className="mt-3 p-3 bg-red-50 text-red-700 rounded text-sm">{err}</div>}
      <div className="mt-6 flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={loading || !firstName}
          className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? "Yaratilmoqda..." : "Yaratish"}
        </button>
        <button onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
          Bekor
        </button>
      </div>
    </Modal>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
