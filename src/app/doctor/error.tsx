"use client";

export default function DoctorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-8 max-w-lg w-full">
        <h2 className="text-xl font-bold text-red-700 mb-2">Sahifada xatolik yuz berdi</h2>
        <p className="text-sm text-gray-600 mb-4">
          {error?.message || "Noma'lum xatolik"}
        </p>
        {error?.digest && (
          <p className="text-xs text-gray-400 mb-4 font-mono">ID: {error.digest}</p>
        )}
        <button
          onClick={reset}
          className="btn-primary text-sm px-4 py-2"
        >
          Qayta urinib ko'ring
        </button>
      </div>
    </div>
  );
}
