'use client'

import { useClinic } from '@/lib/clinic-context'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'

const PUBLIC_PATHS = ['/webapp/select-clinic', '/webapp/clinics']

export function ClinicGuard({ children }: { children: React.ReactNode }) {
  const { clinic, loading } = useClinic()
  const pathname = usePathname()
  const router = useRouter()

  const isPublicPath = PUBLIC_PATHS.some((p) => pathname?.startsWith(p))

  useEffect(() => {
    if (loading) return
    if (!clinic && !isPublicPath) {
      router.replace('/webapp/select-clinic')
    }
  }, [clinic, loading, isPublicPath, router])

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

  if (!clinic && !isPublicPath) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400 text-sm">Klinika tanlanmoqda...</p>
      </div>
    )
  }

  return <>{children}</>
}
