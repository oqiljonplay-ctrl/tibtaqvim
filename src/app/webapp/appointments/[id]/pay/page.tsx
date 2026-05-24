"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Container, Stack } from "@/components/layout";

interface AppointmentInfo {
  id: string;
  patientName: string;
  date: string;
  serviceName: string;
  amount: number;
  amountFormatted: string;
  paymentStatus: string;
  providers: {
    payme: boolean;
    click: boolean;
  };
}

export default function PayPage() {
  const params = useParams<{ id: string }>();
  const [info, setInfo] = useState<AppointmentInfo | null>(null);
  const [loading, setLoading] = useState<"payme" | "click" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/appointments/${params.id}/payment-info`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setFetchError(data.error);
        else setInfo(data);
      })
      .catch(() => setFetchError("Yuklash xatosi"));
  }, [params.id]);

  async function handlePay(provider: "payme" | "click") {
    setLoading(provider);
    setError(null);
    try {
      const returnUrl = `${window.location.origin}/webapp/appointments/${params.id}?payment=return`;
      const res = await fetch(`/api/payments/${provider}/create-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId: params.id,
          returnUrl,
          ...(provider === "payme" ? { lang: "uz" } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error || "Xato yuz berdi");
        setLoading(null);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Tarmoq xatosi");
      setLoading(null);
    }
  }

  if (!info && !fetchError) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (fetchError && !info) {
    return (
      <div className="p-4">
        <div className="bg-red-50 text-red-700 p-3 rounded-lg">{fetchError}</div>
      </div>
    );
  }

  if (!info) return null;

  if (info.paymentStatus === "paid") {
    return (
      <Container size="sm" className="py-4">
        <Stack gap={4}>
          <div className="bg-green-50 border border-green-200 text-green-700 p-4 rounded-xl text-center">
            <div className="text-2xl mb-2">✅</div>
            <p className="font-medium">To&apos;lov amalga oshirilgan</p>
          </div>
          <a
            href="/webapp"
            className="block text-center text-cyan-600 underline text-sm"
          >
            Bosh sahifaga qaytish
          </a>
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="sm" className="py-4 pb-8">
      <Stack gap={4}>
      {/* Appointment info */}
      <div className="bg-gray-50 p-4 rounded-xl space-y-2">
        <div className="text-xs text-gray-500">Xizmat</div>
        <div className="font-semibold text-gray-900">{info.serviceName}</div>
        <div className="text-sm text-gray-500">
          {info.patientName} · {info.date}
        </div>
        <div className="text-2xl font-bold text-cyan-700 pt-1">
          {info.amountFormatted}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm">{error}</div>
      )}

      <div className="text-sm text-gray-600 font-medium">To&apos;lov usulini tanlang:</div>

      {info.providers.payme && (
        <button
          onClick={() => handlePay("payme")}
          disabled={loading !== null}
          className="w-full bg-[#00CFFF] hover:bg-[#00b8e6] text-white py-4 rounded-xl font-medium flex items-center justify-center gap-3 disabled:opacity-50 transition-colors"
        >
          {loading === "payme" ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Yuklanmoqda...
            </span>
          ) : (
            <>
              <span className="text-lg font-bold">P</span>
              <span>Payme bilan to&apos;lash</span>
            </>
          )}
        </button>
      )}

      {info.providers.click && (
        <button
          onClick={() => handlePay("click")}
          disabled={loading !== null}
          className="w-full bg-[#1A73E8] hover:bg-[#1665c6] text-white py-4 rounded-xl font-medium flex items-center justify-center gap-3 disabled:opacity-50 transition-colors"
        >
          {loading === "click" ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Yuklanmoqda...
            </span>
          ) : (
            <>
              <span className="text-lg font-bold">C</span>
              <span>Click bilan to&apos;lash</span>
            </>
          )}
        </button>
      )}

      {!info.providers.payme && !info.providers.click && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-xl text-sm">
          Bu klinika hozircha onlayn to&apos;lov qabul qilmaydi.
        </div>
      )}

      <p className="text-xs text-gray-400 text-center pt-2">
        To&apos;lovdan keyin avtomatik bu sahifaga qaytasiz
      </p>
      </Stack>
    </Container>
  );
}
