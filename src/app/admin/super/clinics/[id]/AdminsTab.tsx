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

export function AdminsTab({ clinicId }: { clinicId: string }) {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [resetTarget, setResetTarget] = useState<Admin | null>(null);

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
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Adminlar ({admins.length})</h2>
          <p className="text-sm text-gray-500">Klinikani boshqaradigan foydalanuvchilar</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
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
          <table className="w-full text-sm">
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
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{admin.username}</td>
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
    </div>
  );
}
