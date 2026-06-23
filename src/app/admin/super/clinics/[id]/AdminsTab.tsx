"use client";

import { useState, useEffect, useCallback } from "react";
import { CreateAdminModal } from "./CreateAdminModal";
import { ResetPasswordModal } from "./ResetPasswordModal";

type Admin = {
  id: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
};

function RenameLoginModal({
  admin,
  clinicId,
  onClose,
  onDone,
}: {
  admin: Admin;
  clinicId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [value, setValue] = useState(admin.username ?? "");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSave() {
    setErr(null);
    if (!/^tib_(b?admin)_[a-z0-9]+$/.test(value.trim())) {
      setErr("Format: tib_admin_… yoki tib_badmin_…");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/super/clinics/${clinicId}/admins/${admin.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: value.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErr(json.error?.message ?? "Xatolik yuz berdi");
      } else {
        onDone();
      }
    } catch {
      setErr("Serverga ulanishda xatolik");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <h3 className="text-base font-semibold text-gray-900">Loginni o&apos;zgartirish</h3>
        <p className="text-xs text-gray-500">
          Joriy login: <span className="font-mono">{admin.username ?? "—"}</span>
        </p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Yangi login</label>
          <input
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="tib_admin_yangi1"
            autoFocus
          />
          <p className="text-xs text-gray-400 mt-1">Format: tib_admin_[harf/raqam] yoki tib_badmin_[harf/raqam]</p>
          {err && <p className="text-red-500 text-xs mt-1">{err}</p>}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 min-h-[44px] border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors"
          >
            Bekor
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !value.trim()}
            className="flex-1 min-h-[44px] bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 transition-colors"
          >
            {loading ? "Saqlanmoqda..." : "Saqlash"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminsTab({ clinicId }: { clinicId: string }) {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [resetTarget, setResetTarget] = useState<Admin | null>(null);
  const [renameTarget, setRenameTarget] = useState<Admin | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/super/clinics/${clinicId}/admins`);
    const data = await res.json();
    setAdmins(data.data?.admins ?? []);
    setLoading(false);
  }, [clinicId]);

  useEffect(() => { load(); }, [load]);

  const handleToggleActive = async (admin: Admin) => {
    if (!confirm(admin.isActive ? "Adminni faolsizlantirmoqchimisiz?" : "Adminni faollashtirmoqchimisiz?")) return;
    await fetch(`/api/admin/super/clinics/${clinicId}/admins/${admin.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !admin.isActive }),
    });
    await load();
  };

  const handleDelete = async (admin: Admin) => {
    if (!confirm(`"${admin.firstName}" adminini o'chirmoqchimisiz? (Faolsizlantiriladi)`)) return;
    await fetch(`/api/admin/super/clinics/${clinicId}/admins/${admin.id}`, { method: "DELETE" });
    await load();
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Adminlar ({admins.length})</h2>
          <p className="text-sm text-gray-500">Klinikani boshqaradigan foydalanuvchilar</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 min-h-[44px] bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
        >
          + Admin qo&apos;shish
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Yuklanmoqda...</div>
      ) : admins.length === 0 ? (
        <div className="p-10 text-center bg-gray-50 rounded-xl text-gray-500 text-sm">
          Hali admin qo&apos;shilmagan
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-gray-100">
            {admins.map((admin) => (
              <div key={admin.id} className="p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div>
                    <button
                      onClick={() => setRenameTarget(admin)}
                      className="font-mono text-xs text-indigo-700 font-medium hover:underline text-left"
                      title="Loginni o'zgartirish"
                    >
                      {admin.username ?? "—"}
                    </button>
                    <div className="text-sm text-gray-900">{admin.firstName} {admin.lastName ?? ""}</div>
                    <div className="text-xs text-gray-400">{admin.phone ?? "—"}</div>
                  </div>
                  {admin.isActive ? (
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium flex-shrink-0">Faol</span>
                  ) : (
                    <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded-full font-medium flex-shrink-0">Nofaol</span>
                  )}
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setResetTarget(admin)}
                    className="flex-1 min-h-[44px] text-sm font-medium bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors"
                  >
                    Parol
                  </button>
                  <button
                    onClick={() => setRenameTarget(admin)}
                    className="flex-1 min-h-[44px] text-sm font-medium bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors"
                  >
                    Login
                  </button>
                  <button
                    onClick={() => handleToggleActive(admin)}
                    className="flex-1 min-h-[44px] text-sm font-medium bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    {admin.isActive ? "O'chirish" : "Yoqish"}
                  </button>
                  <button
                    onClick={() => handleDelete(admin)}
                    className="flex-1 min-h-[44px] text-sm font-medium bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    O&apos;chir
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <table className="w-full text-sm hidden md:table">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3 font-medium">Login</th>
                <th className="px-4 py-3 font-medium">Ism</th>
                <th className="px-4 py-3 font-medium">Telefon</th>
                <th className="px-4 py-3 font-medium">Holat</th>
                <th className="px-4 py-3 font-medium text-right">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {admins.map((admin) => (
                <tr key={admin.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setRenameTarget(admin)}
                      className="font-mono text-xs text-indigo-700 hover:underline"
                      title="Loginni o'zgartirish"
                    >
                      {admin.username ?? "—"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-900">{admin.firstName} {admin.lastName ?? ""}</td>
                  <td className="px-4 py-3 text-gray-500">{admin.phone ?? "—"}</td>
                  <td className="px-4 py-3">
                    {admin.isActive ? (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">Faol</span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded-full font-medium">Nofaol</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <button onClick={() => setResetTarget(admin)} className="text-indigo-600 hover:underline text-xs">
                      Parol
                    </button>
                    <button onClick={() => setRenameTarget(admin)} className="text-amber-600 hover:underline text-xs">
                      Login
                    </button>
                    <button onClick={() => handleToggleActive(admin)} className="text-gray-600 hover:underline text-xs">
                      {admin.isActive ? "O'chirish" : "Yoqish"}
                    </button>
                    <button onClick={() => handleDelete(admin)} className="text-red-600 hover:underline text-xs">
                      O&apos;chir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateAdminModal
          clinicId={clinicId}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}

      {resetTarget && (
        <ResetPasswordModal
          apiUrl={`/api/admin/super/clinics/${clinicId}/admins/${resetTarget.id}`}
          admin={resetTarget}
          onClose={() => { setResetTarget(null); load(); }}
        />
      )}

      {renameTarget && (
        <RenameLoginModal
          admin={renameTarget}
          clinicId={clinicId}
          onClose={() => setRenameTarget(null)}
          onDone={() => { setRenameTarget(null); load(); }}
        />
      )}
    </div>
  );
}
