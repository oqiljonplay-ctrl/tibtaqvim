'use client'

import { useClinic } from '@/lib/clinic-context'

// ClinicGuard: faqat loading holati uchun spinner ko'rsatadi.
// Redirect QILINMAYDI — bosh sahifa klinikasiz ham to'liq ko'rinishi kerak.
// Klinika tanlash faqat: (a) "Klinikalar" tugmasi, (b) "Yangi bron" birinchi qadami.
export function ClinicGuard({ children }: { children: React.ReactNode }) {
  const { loading } = useClinic()

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-[var(--bg,#f9fafb)] animate-pulse overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-10 h-10 rounded-full bg-gray-200 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="h-3.5 w-28 bg-gray-200 rounded-full mb-1.5" />
            <div className="h-2.5 w-20 bg-gray-100 rounded-full" />
          </div>
        </div>
        <div className="mx-4 mt-1 h-28 rounded-2xl bg-gray-200" />
        <div className="mx-4 mt-3 flex gap-3">
          <div className="flex-1 h-16 rounded-xl bg-gray-200" />
          <div className="flex-1 h-16 rounded-xl bg-gray-100" />
        </div>
        <div className="mx-4 mt-4 space-y-2.5">
          <div className="h-16 rounded-xl bg-gray-200" />
          <div className="h-16 rounded-xl bg-gray-100" />
          <div className="h-16 rounded-xl bg-gray-200" />
        </div>
        <div className="fixed bottom-0 inset-x-0 flex justify-around items-center p-3 bg-[var(--bg,#f9fafb)] border-t border-gray-100">
          <div className="w-10 h-8 rounded-lg bg-gray-200" />
          <div className="w-10 h-8 rounded-lg bg-gray-200" />
          <div className="w-10 h-8 rounded-lg bg-gray-200" />
        </div>
      </div>
    )
  }

  return <>{children}</>
}
