"use client";

export function ClinicDetailSkeleton() {
  return (
    <div className="min-h-[100dvh] bg-gray-50">
      {/* Blue header skeleton */}
      <div className="bg-blue-600 pt-5 pb-6 px-4 animate-pulse">
        <div className="flex items-center justify-between mb-2">
          <div className="w-6 h-4 bg-blue-400 rounded" />
          <div className="w-6 h-6 bg-blue-400 rounded" />
        </div>
        <div className="h-5 bg-blue-400 rounded w-3/4 mb-1" />
        <div className="h-3 bg-blue-400 rounded w-1/3" />
      </div>

      <div className="py-4 space-y-3 px-4">
        {/* Sarlavha */}
        <div className="h-3.5 bg-gray-200 rounded w-40 animate-pulse" />
        {/* 2 ta filial karta */}
        {[1, 2].map((i) => (
          <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 animate-pulse">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl bg-gray-200 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-2/3" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
                <div className="h-3 bg-blue-100 rounded w-1/3" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
