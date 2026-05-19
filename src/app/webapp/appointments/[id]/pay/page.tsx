"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";

export default function PayPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const paymentReturn = searchParams.get("payment");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (paymentReturn === "return") {
      // Payme sahifasidan qaytib kelindi — sahifa holat ko'rsatadi
    }
  }, [paymentReturn]);

  async function handlePayWithPayme() {
    setLoading(true);
    setError(null);
    try {
      const returnUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/webapp/appointments/${params.id}?payment=return`
          : undefined;

      const res = await fetch("/api/payments/payme/create-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointmentId: params.id,
          returnUrl,
          lang: "uz",
        }),
      });

      const data = (await res.json()) as { url?: string; error?: string };

      if (!res.ok || !data.url) {
        setError(data.error ?? "Xato yuz berdi");
        setLoading(false);
        return;
      }

      window.location.href = data.url;
    } catch {
      setError("Tarmoq xatosi");
      setLoading(false);
    }
  }

  if (paymentReturn === "return") {
    return (
      <div className="p-6 space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <p className="text-green-700 font-medium text-lg">To'lov amalga oshirildi</p>
          <p className="text-green-600 text-sm mt-1">
            To'lov holati bir necha daqiqada yangilanadi
          </p>
        </div>
        <a
          href={`/webapp`}
          className="block text-center text-cyan-600 underline text-sm"
        >
          Bosh sahifaga qaytish
        </a>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold text-gray-800">To&apos;lov qilish</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <button
          onClick={handlePayWithPayme}
          disabled={loading}
          className="w-full bg-cyan-500 hover:bg-cyan-600 active:bg-cyan-700 text-white py-3 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Yuklanmoqda..." : "💳 Payme bilan to'lash"}
        </button>

        {/* Click — Sprint 3 da qo'shiladi */}
      </div>
    </div>
  );
}
