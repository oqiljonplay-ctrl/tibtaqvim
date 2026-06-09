'use client'

import { useClinic } from '@/lib/clinic-context'

// ClinicGuard: faqat loading holati uchun spinner ko'rsatadi.
// Redirect QILINMAYDI — bosh sahifa klinikasiz ham to'liq ko'rinishi kerak.
// Klinika tanlash faqat: (a) "Klinikalar" tugmasi, (b) "Yangi bron" birinchi qadami.
export function ClinicGuard({ children }: { children: React.ReactNode }) {
  const { loading } = useClinic()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-4xl mb-3">🏥</div>
          <p className="text-gray-400 text-sm animate-pulse">Yuklanmoqda...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
