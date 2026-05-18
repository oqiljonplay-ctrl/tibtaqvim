"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface ClinicItem {
  id: string;
  name: string;
  description: string | null;
  phone: string | null;
  address: string | null;
  logoUrl: string | null;
  city: string | null;
  workingHours: string | null;
  rating: number;
  ratingCount: number;
  branchCount: number;
  doctorCount: number;
  serviceCount: number;
}

export default function ClinicsPage() {
  const router = useRouter();
  const [clinics, setClinics] = useState<ClinicItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchClinics = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`/api/clinics?${params}`, { cache: "no-store" });
      const json = await res.json();
      if (json.success) setClinics(json.data.items ?? []);
    } catch {}
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(fetchClinics, 300);
    return () => clearTimeout(t);
  }, [fetchClinics]);

  function handleSelect(clinicId: string) {
    router.push(`/webapp/clinics/${clinicId}`);
  }

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto">
      <div className="bg-blue-600 text-white px-4 pt-5 pb-6">
        <h1 className="font-bold text-xl">🏥 TibTaqvim</h1>
        <p className="text-blue-200 text-sm mt-0.5">Klinikani tanlang</p>
      </div>

      <div className="p-4 space-y-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Klinika qidirish..."
          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
        />

        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm animate-pulse">Yuklanmoqda...</div>
        ) : clinics.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">Klinikalar topilmadi</div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-400">{clinics.length} ta klinika</p>
            {clinics.map((c) => (
              <button
                key={c.id}
                onClick={() => handleSelect(c.id)}
                className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-left hover:shadow-md active:scale-[0.98] transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-14 h-14 bg-gradient-to-br from-blue-100 to-blue-200 rounded-xl flex items-center justify-center text-2xl">
                    {c.logoUrl
                      ? <img src={c.logoUrl} alt="" className="w-14 h-14 rounded-xl object-cover" />
                      : "🏥"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{c.name}</h3>
                    {c.rating > 0 && (
                      <p className="text-xs text-amber-600 mt-0.5">⭐ {c.rating.toFixed(1)} ({c.ratingCount})</p>
                    )}
                    {c.address && (
                      <p className="text-xs text-gray-500 mt-1 truncate">📍 {c.address}</p>
                    )}
                    {c.workingHours && (
                      <p className="text-xs text-gray-500 mt-0.5">🕐 {c.workingHours}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">
                        👨‍⚕️ {c.doctorCount} shifokor
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full">
                        🏷 {c.serviceCount} xizmat
                      </span>
                      {c.branchCount > 1 && (
                        <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full">
                          🏥 {c.branchCount} filial
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-gray-300 mt-1">→</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
