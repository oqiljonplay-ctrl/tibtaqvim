"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { Container } from "@/components/layout";
import { useTelegramBack } from "@/lib/use-telegram-back";
import { ClinicDetailSkeleton } from "@/components/webapp/skeletons/ClinicDetailSkeleton";

interface BranchItem {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  workingHours: string | null;
  nearbyMetro: string | null;
  latitude: number | null;
  longitude: number | null;
  doctorCount: number;
}

interface ClinicDetail {
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
  doctorCount: number;
  serviceCount: number;
  branches: BranchItem[];
}

export default function ClinicDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const intent = searchParams.get("intent") || "booking";   // aniq niyat
  const [autoRedirected, setAutoRedirected] = useState(false);

  const { data: clinicRes, isLoading } = useSWR<{ success: boolean; data: ClinicDetail }>(
    `/api/clinics/${id}`
  );
  const clinic = clinicRes?.success ? clinicRes.data : null;
  const loading = isLoading && !clinicRes;

  const goBack = () => {
    router.push(`/webapp?mode=dashboard`);
  };
  const goHome = () => {
    sessionStorage.removeItem("branch_shown");
    router.push(`/webapp?mode=dashboard&clinicId=${id}`);
  };
  const nativeBackOk = useTelegramBack(goBack, true);

  // Avtomatik redirect: intent=select → home (mudofaa); intent=booking + 1 filial → skip:
  useEffect(() => {
    if (!clinic || autoRedirected) return;

    if (intent === "select") {
      setAutoRedirected(true);
      router.replace("/webapp?mode=dashboard");
      return;
    }

    if (clinic.branches.length === 1) {
      setAutoRedirected(true);
      sessionStorage.setItem("selectedClinicId", id);
      sessionStorage.setItem("selectedBranchId", clinic.branches[0].id);
      sessionStorage.setItem("branch_shown", "0");
      router.replace(`/webapp/clinics/${id}/branches/${clinic.branches[0].id}?intent=booking`);
    }
  }, [clinic, id, router, autoRedirected, intent]);

  function selectBranch(branchId: string) {
    sessionStorage.setItem("selectedClinicId", id);
    sessionStorage.setItem("selectedBranchId", branchId);
    sessionStorage.setItem("branch_shown", "1");
    router.push(`/webapp/clinics/${id}/branches/${branchId}`);
  }

  if (loading) {
    return <ClinicDetailSkeleton />;
  }

  if (!clinic) {
    return (
      <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center flex-col gap-3">
        <p className="text-gray-500">Klinika topilmadi</p>
        <Link href="/webapp/clinics" className="text-blue-600 text-sm">← Orqaga</Link>
      </div>
    );
  }

  // select niyati yoki 1 filial bo'lsa — yo'naltirish ekrani (useEffect redirect qiladi):
  if (intent === "select" || clinic.branches.length === 1) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p style={{ color: "var(--text-muted)" }} className="text-sm animate-pulse">Yo&apos;naltirilmoqda...</p>
      </div>
    );
  }

  return (
    <Container size="sm" className="min-h-[100dvh] bg-gray-50">
      <div className="bg-blue-600 text-white pt-5 pb-6 px-4">
        <div className="flex items-center justify-between mb-2">
          {!nativeBackOk ? (
            <button onClick={goBack} aria-label="Orqaga" className="text-blue-200 hover:text-white text-sm">←</button>
          ) : <span />}
          <button onClick={goHome} aria-label="Bosh sahifa" className="text-blue-200 hover:text-white text-base leading-none">🏠</button>
        </div>
        <h1 className="font-bold text-xl">{clinic.name}</h1>
        {clinic.workingHours && (
          <p className="text-blue-200 text-xs mt-0.5">🕐 {clinic.workingHours}</p>
        )}
      </div>

      <div className="py-4 space-y-3 px-4">
        {clinic.description && (
          <div className="bg-white rounded-xl p-4 shadow-sm text-sm text-gray-700">
            {clinic.description}
          </div>
        )}

        <h2 className="text-sm font-semibold text-gray-600">
          Filialni tanlang ({clinic.branches.length})
        </h2>

        {clinic.branches.map((b) => (
          <button
            key={b.id}
            onClick={() => selectBranch(b.id)}
            className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-left hover:shadow-md active:scale-[0.98] transition-all"
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-emerald-100 to-emerald-200 rounded-xl flex items-center justify-center text-xl">
                🏥
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900">{b.name}</h3>
                {b.address && <p className="text-xs text-gray-500 mt-1 truncate">📍 {b.address}</p>}
                {b.nearbyMetro && <p className="text-xs text-gray-500 mt-0.5">🚇 {b.nearbyMetro}</p>}
                {b.workingHours && <p className="text-xs text-gray-500 mt-0.5">🕐 {b.workingHours}</p>}
                <p className="text-xs text-blue-600 mt-1.5">👨‍⚕️ {b.doctorCount} shifokor</p>
              </div>
              <span className="text-gray-300 mt-1">→</span>
            </div>
          </button>
        ))}
      </div>
    </Container>
  );
}
