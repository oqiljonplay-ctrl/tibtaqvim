'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function SelectClinicPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const params = new URLSearchParams()
    const next = searchParams.get('next')
    if (next) params.set('next', next)
    const qs = params.size > 0 ? `?${params.toString()}` : ''
    router.replace(`/webapp/clinics${qs}`)
  }, [router, searchParams])

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-gray-50">
      <p className="text-gray-400 text-sm animate-pulse">Yo&apos;naltirilmoqda...</p>
    </div>
  )
}
