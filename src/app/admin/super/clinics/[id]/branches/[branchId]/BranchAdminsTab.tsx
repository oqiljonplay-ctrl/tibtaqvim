"use client";

import { useState, useEffect, useCallback } from "react";
import { CreateBranchAdminModal } from "./CreateBranchAdminModal";
import { ResetPasswordModal } from "../../ResetPasswordModal";

type Admin = {
  id: string;
  username: string | null;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
};

type Credentials = { username: string; password: string };

export function BranchAdminsTab({ clinicId, branchId }: { clinicId: string; branchId: string }) {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [resetTarget, setResetTarget] = useState<Admin | null>(null);
  const [newCredentials, setNewCredentials] = useState<Credentials | null>(null);

  const apiBase = `/api/admin/clinics/${clinicId}/branches/${branchId}/admins`;

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(apiBase);
    const data = await res.json();
    setAdmins(data.data?.admins ?? []);
    setLoading(false);
  }, [apiBase]);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (a: Admin) => {
    if (!confirm(a.isActive ? "Nofaollashtirasizmi?" : "Yoqasizmi?")) return;
    await fetch(`${apiBase}/${a.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !a.isActive }),
    });
    await load();
  };

  const handleDelete = async (a: Admin) => {
    if (!confirm(`"${a.firstName}" adminini o'chirasizmi?`)) return;
    await fetch(`${apiBase}/${a.id}`, { method: "DELETE" });
    await load();
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Filial adminlari ({admins.length})</h2>
          <p className="text-sm text-gray-500">Faqat shu filial bo&apos;yicha boshqaruv huquqi</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 min-h-[44px] bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
        >
          + Admin qo&apos;shish
        </button>
      </div>

      {/* Yangi yaratilgan credentials */}
      {newCredentials && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
          <p className="text-sm font-semibold text-yellow-800 mb-2">Yangi admin yaratildi — loginni saqlang:</p>
          <div className="space-y-1">
            <p className="text-sm"><span className="text-gray-500">Login:</span> <code className="bg-white px-2 py-0.5 rounded border font-mono">{newCredentials.username}</code></p>
            <p className="text-sm"><span className="text-gray-500">Parol:</span> <code className="bg-white px-2 py-0.5 rounded border font-mono">{newCredentials.password}</code></p>
          </div>
          <button
            onClick={() => navigator.clipboard.writeText(`Login: ${newCredentials.username}\nParol: ${newCredentials.password}`)}
            className="mt-2 text-sm text-indigo-600 hover:underline"
          >
            Nusxa olish
          </button>
          <button onClick={() => setNewCredentials(null)} className="ml-4 text-sm text-gray-400 hover:underline">
            Yopish
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Yuklanmoqda...</div>
      ) : admins.length === 0 ? (
        <div className="p-10 text-center bg-gray-50 rounded-xl text-gray-500 text-sm">
          Hali filial admini yo&apos;q
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-gray-100">
            {admins.map((a) => (
              <div key={a.id} className="p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div>
                    <div className="font-mono text-xs text-gray-700 font-medium">{a.username}</div>
                    <div className="text-sm text-gray-900">{a.firstName} {a.lastName ?? ""}</div>
                    <div className="text-xs text-gray-400">{a.phone ?? "—"}</div>
                  </div>
                  {a.isActive ? (
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium flex-shrink-0">Faol</span>
                  ) : (
                    <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded-full font-medium flex-shrink-0">Nofaol</span>
                  )}
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setResetTarget(a)}
                    className="flex-1 min-h-[44px] text-sm font-medium bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors"
                  >
                    Parol
                  </button>
                  <button
                    onClick={() => handleToggle(a)}
                    className="flex-1 min-h-[44px] text-sm font-medium bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    {a.isActive ? "O'chirish" : "Yoqish"}
                  </button>
                  <button
                    onClick={() => handleDelete(a)}
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
              {admins.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{a.username}</td>
                  <td className="px-4 py-3 text-gray-900">{a.firstName} {a.lastName ?? ""}</td>
                  <td className="px-4 py-3 text-gray-500">{a.phone ?? "—"}</td>
                  <td className="px-4 py-3">
                    {a.isActive ? (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full font-medium">Faol</span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded-full font-medium">Nofaol</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <button onClick={() => setResetTarget(a)} className="text-indigo-600 hover:underline text-xs">Parol</button>
                    <button onClick={() => handleToggle(a)} className="text-gray-600 hover:underline text-xs">
                      {a.isActive ? "O'chirish" : "Yoqish"}
                    </button>
                    <button onClick={() => handleDelete(a)} className="text-red-600 hover:underline text-xs">O&apos;chir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreateBranchAdminModal
          clinicId={clinicId}
          branchId={branchId}
          onClose={() => setShowCreate(false)}
          onCreated={(creds) => {
            setShowCreate(false);
            setNewCredentials(creds);
            load();
          }}
        />
      )}

      {resetTarget && (
        <ResetPasswordModal
          apiUrl={`${apiBase}/${resetTarget.id}`}
          admin={resetTarget}
          onClose={() => { setResetTarget(null); load(); }}
        />
      )}
    </div>
  );
}
