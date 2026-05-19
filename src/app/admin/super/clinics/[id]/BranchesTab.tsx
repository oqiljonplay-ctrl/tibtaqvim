"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { CreateBranchModal } from "./CreateBranchModal";

type Branch = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  workingHours: string | null;
  isActive: boolean;
  sortOrder: number;
  _count: { admins: number };
};

export function BranchesTab({ clinicId }: { clinicId: string }) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/clinics/${clinicId}/branches`);
    const data = await res.json();
    setBranches(data.data?.branches || []);
    setLoading(false);
  }, [clinicId]);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (b: Branch) => {
    if (b.isActive) {
      if (!confirm("Filialni o'chirishni xohlaysizmi? Uning adminlari ham nofaol bo'ladi.")) return;
      await fetch(`/api/admin/clinics/${clinicId}/branches/${b.id}`, { method: "DELETE" });
    } else {
      if (!confirm("Filialni qayta yoqasizmi?")) return;
      await fetch(`/api/admin/clinics/${clinicId}/branches/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
    }
    await load();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Filiallar ({branches.length})</h2>
          <p className="text-sm text-gray-500">Klinika filiallari va ularning adminlari</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
        >
          + Filial qo&apos;shish
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Yuklanmoqda...</div>
      ) : branches.length === 0 ? (
        <div className="p-10 text-center bg-gray-50 rounded-xl text-gray-500 text-sm">
          Hali filial qo&apos;shilmagan
        </div>
      ) : (
        <div className="space-y-3">
          {branches.map((b) => (
            <div
              key={b.id}
              className={`p-4 border border-gray-200 rounded-xl bg-white ${!b.isActive ? "opacity-60" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-gray-900">{b.name}</h3>
                    {!b.isActive && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                        Nofaol
                      </span>
                    )}
                  </div>
                  {b.address && <p className="text-sm text-gray-500">📍 {b.address}</p>}
                  {b.phone && <p className="text-sm text-gray-500">📞 {b.phone}</p>}
                  {b.workingHours && <p className="text-sm text-gray-500">🕐 {b.workingHours}</p>}
                  <p className="text-xs text-gray-400 mt-1.5">
                    Adminlar: <span className="font-medium text-gray-600">{b._count.admins}</span>
                  </p>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <Link
                    href={`/admin/super/clinics/${clinicId}/branches/${b.id}`}
                    className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-center font-medium text-gray-700"
                  >
                    Boshqarish
                  </Link>
                  <button
                    onClick={() => handleToggle(b)}
                    className={`px-3 py-1.5 text-sm border rounded-lg ${
                      b.isActive
                        ? "border-red-200 text-red-600 hover:bg-red-50"
                        : "border-green-200 text-green-600 hover:bg-green-50"
                    }`}
                  >
                    {b.isActive ? "O’chirish" : "Yoqish"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateBranchModal
          clinicId={clinicId}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}
    </div>
  );
}
