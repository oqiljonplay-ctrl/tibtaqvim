"use client";

export function ProfileSkeleton() {
  return (
    <div className="min-h-[100dvh] bg-gray-50">
      {/* Sticky header */}
      <div className="bg-white shadow-sm py-3 sticky top-0 z-10 flex items-center gap-3 px-4">
        <div className="w-6 h-4 bg-gray-200 rounded animate-pulse" />
        <div className="h-5 bg-gray-200 rounded w-36 animate-pulse flex-1" />
        <div className="h-5 bg-gray-100 rounded w-16 animate-pulse" />
      </div>

      <div className="py-4 space-y-4 px-4">
        {/* Ma'lumotlarim karta */}
        <div className="bg-white rounded-xl p-4 shadow-sm animate-pulse">
          <div className="flex items-center justify-between mb-3">
            <div className="h-3.5 bg-gray-200 rounded w-28" />
            <div className="h-3.5 bg-gray-100 rounded w-16" />
          </div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded w-3/4" />
            <div className="h-3 bg-gray-100 rounded w-1/2" />
            <div className="h-3 bg-gray-100 rounded w-2/3" />
          </div>
        </div>

        {/* Qaramog'imdagilar karta */}
        <div className="bg-white rounded-xl p-4 shadow-sm animate-pulse">
          <div className="h-3.5 bg-gray-200 rounded w-40 mb-3" />
          <div className="h-3 bg-gray-100 rounded w-1/2 mb-4" />
          <div className="w-full h-12 rounded-xl border-2 border-dashed border-gray-200" />
        </div>
      </div>
    </div>
  );
}
