"use client";
import { useEffect } from "react";
import Link from "next/link";

export default function AdminPanelError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[AdminPanel Error]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4 text-center px-4">
      <p className="text-4xl">⚠️</p>
      <h2 className="text-lg font-semibold text-gray-800">Xatolik yuz berdi</h2>
      <p className="text-sm text-gray-500 max-w-sm">{error.message ?? "Noma'lum xato"}</p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
        >
          Qayta urinish
        </button>
        <Link href="/admin" className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors">
          Dashboard'ga qaytish
        </Link>
      </div>
    </div>
  );
}
