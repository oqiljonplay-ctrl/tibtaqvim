"use client";

export function HistorySkeleton() {
  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-24 py-4 px-4 animate-pulse">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-6 h-4 bg-gray-200 rounded" />
        <div>
          <div className="h-5 bg-gray-200 rounded w-24 mb-1" />
          <div className="h-3 bg-gray-100 rounded w-32" />
        </div>
      </div>
      {/* Tabs */}
      <div className="flex bg-white rounded-xl p-1 mb-4 shadow-sm gap-1">
        <div className="flex-1 h-9 rounded-lg bg-gray-200" />
        <div className="flex-1 h-9 rounded-lg bg-gray-100" />
      </div>
      {/* 3 ta bron karta */}
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-xl p-4">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
            <div className="h-3 bg-gray-200 rounded w-2/3 mb-2" />
            <div className="h-3 bg-gray-200 rounded w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
