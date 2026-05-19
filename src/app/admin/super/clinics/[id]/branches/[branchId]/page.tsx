"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { BranchInfoTab } from "./BranchInfoTab";
import { BranchAdminsTab } from "./BranchAdminsTab";

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
  clinicId: string;
};

type Tab = "info" | "admins";

export default function BranchDetailPage() {
  const params = useParams();
  const clinicId = params.id as string;
  const branchId = params.branchId as string;

  const [branch, setBranch] = useState<Branch | null>(null);
  const [tab, setTab] = useState<Tab>("info");
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/admin/clinics/${clinicId}/branches/${branchId}`);
    const data = await res.json();
    setBranch(data.data?.branch ?? null);
    setLoading(false);
  }, [clinicId, branchId]);

  useEffect(() => { reload(); }, [reload]);

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

  if (!branch) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700 text-sm">
        Filial topilmadi.{" "}
        <Link href={`/admin/super/clinics/${clinicId}?tab=branches`} className="underline">
          Orqaga
        </Link>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "info", label: "Ma'lumotlar" },
    { key: "admins", label: "Adminlar" },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div>
        <div className="text-xs text-gray-400 mb-2">
          <Link href="/admin/super/clinics" className="hover:text-gray-600">Klinikalar</Link>
          <span className="mx-1.5">/</span>
          <Link href={`/admin/super/clinics/${clinicId}`} className="hover:text-gray-600">Klinika</Link>
          <span className="mx-1.5">/</span>
          <span className="text-gray-600">{branch.name}</span>
        </div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{branch.name}</h1>
          {!branch.isActive && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-red-100 text-red-700 font-medium">
              Nofaol
            </span>
          )}
        </div>
        {branch.address && <p className="text-sm text-gray-500 mt-1">📍 {branch.address}</p>}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "info" && <BranchInfoTab branch={branch} clinicId={clinicId} onUpdate={reload} />}
      {tab === "admins" && <BranchAdminsTab clinicId={clinicId} branchId={branchId} />}
    </div>
  );
}
