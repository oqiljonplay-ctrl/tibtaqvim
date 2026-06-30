"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { useClinic } from "@/lib/clinic-context";
import { ClinicLogo } from "@/components/ClinicLogo";
import { ResponsiveGrid } from "@/components/layout";
import { useTelegramBack } from "@/lib/use-telegram-back";

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
  const searchParams = useSearchParams();
  const { setClinic } = useClinic();

  const [search, setSearch] = useState("");
  const [selecting, setSelecting] = useState<string | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const nextPath = searchParams.get("next");
  const intent = searchParams.get("intent") || "booking";   // aniq niyat; default booking
  const tgid = searchParams.get("tgid");

  const goHome = () => { router.push(`/webapp?mode=dashboard`); };
  const nativeBackOk = useTelegramBack(goHome, true);

  // Debounce search for SWR key (300ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const clinicsUrl = debouncedSearch
    ? `/api/clinics?search=${encodeURIComponent(debouncedSearch)}`
    : `/api/clinics`;
  const { data: clinicsData, isLoading } = useSWR<{ success: boolean; data: { items: ClinicItem[] } }>(clinicsUrl);
  const clinics = clinicsData?.data?.items ?? [];
  const loading = isLoading && !clinicsData;

  function handleSelect(c: ClinicItem) {
    setSelecting(c.id);
    setClinic({
      id: c.id,
      name: c.name,
      city: c.city,
      logoUrl: c.logoUrl,
      address: c.address,
      phone: c.phone,
      rating: c.rating,
    });
    const tgq = tgid ? `&tgid=${encodeURIComponent(tgid)}` : "";
    if (intent === "select") {
      router.push(`/webapp?mode=dashboard${tgq}`);
    } else {
      router.push(`/webapp/clinics/${c.id}?intent=booking${tgq}`);
    }
  }

  return (
    <div className="w-full min-h-[100dvh] bg-gray-50">
      <div className="bg-blue-600 text-white pt-5 pb-6 px-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-bold text-xl">🏥 Klinikani tanlang</h1>
            <p className="text-blue-200 text-sm mt-0.5">Davolanmoqchi bo&apos;lgan klinikani tanlang</p>
          </div>
          <button onClick={goHome} aria-label="Bosh sahifa" className="text-blue-200 hover:text-white text-base leading-none shrink-0">🏠</button>
        </div>
      </div>

      <div className="py-4 space-y-3 px-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Klinika qidirish..."
          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none min-h-[44px]"
        />

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 bg-white rounded-2xl animate-pulse shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl bg-gray-200 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : clinics.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">
            {search ? "Topilmadi" : "Klinikalar topilmadi"}
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-400">{clinics.length} ta klinika</p>
            <ResponsiveGrid cols={{ base: 1, sm: 2 }} gap={3}>
              {clinics.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleSelect(c)}
                  disabled={!!selecting}
                  className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-left hover:shadow-md active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  <div className="flex items-start gap-3">
                    <ClinicLogo src={c.logoUrl} name={c.name} size={56} className="rounded-xl" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{c.name}</h3>
                      {c.rating > 0 && (
                        <p className="text-xs text-amber-600 mt-0.5">
                          ⭐ {c.rating.toFixed(1)} ({c.ratingCount})
                        </p>
                      )}
                      {c.address && (
                        <p className="text-xs text-gray-500 mt-1 truncate">📍 {c.address}</p>
                      )}
                      {c.workingHours && (
                        <p className="text-xs text-gray-500 mt-0.5">🕐 {c.workingHours}</p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {c.doctorCount > 0 && (
                          <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">
                            👨‍⚕️ {c.doctorCount} shifokor
                          </span>
                        )}
                        {c.serviceCount > 0 && (
                          <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full">
                            🏷 {c.serviceCount} xizmat
                          </span>
                        )}
                        {c.branchCount > 1 && (
                          <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full">
                            🏥 {c.branchCount} filial
                          </span>
                        )}
                      </div>
                    </div>
                    {selecting === c.id ? (
                      <div className="text-blue-500 text-sm animate-pulse mt-1 shrink-0">...</div>
                    ) : (
                      <span className="text-gray-300 mt-1 shrink-0">→</span>
                    )}
                  </div>
                </button>
              ))}
            </ResponsiveGrid>
          </>
        )}
      </div>
    </div>
  );
}
