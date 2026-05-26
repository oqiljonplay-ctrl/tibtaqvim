'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useClinic, type Clinic } from '@/lib/clinic-context'
import { ClinicLogo } from '@/components/ClinicLogo'
import { Container, Stack } from '@/components/layout'

export default function MyClinicsPage() {
  const router = useRouter()
  const { clinic: current, setClinic } = useClinic()
  const [clinics, setClinics] = useState<Clinic[]>([])
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState<string | null>(null)

  useEffect(() => {
    const tgId =
      (typeof window !== 'undefined' &&
        (new URLSearchParams(window.location.search).get('tgid') ||
          sessionStorage.getItem('tgid'))) ||
      null
    const url = tgId ? `/api/me/clinics?tgid=${tgId}` : '/api/me/clinics'
    fetch(url)
      .then((r) => r.json())
      .then((data) => setClinics(data.clinics ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function handleSelect(c: Clinic) {
    if (c.id === current?.id) {
      router.push('/webapp')
      return
    }
    setSwitching(c.id)
    setClinic(c)
    router.push('/webapp')
  }

  return (
    <Container size="sm" className="min-h-[100dvh] bg-gray-50 pb-8">
      {/* Header */}
      <div className="bg-white shadow-sm py-3 px-4 sticky top-0 z-10 flex items-center gap-3 -mx-4 sm:-mx-6 lg:-mx-8">
        <button
          onClick={() => router.back()}
          className="text-blue-600 text-sm px-1"
        >
          ←
        </button>
        <h1 className="text-lg font-bold flex-1">Mening klinikalarim</h1>
      </div>

      <Stack gap={4} className="pt-4">
        {loading ? (
          <div className="space-y-3 mt-2">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-4 animate-pulse flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gray-100 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-2/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : clinics.length === 0 ? (
          <div className="mt-12 flex flex-col items-center text-center px-4">
            <div className="text-5xl mb-4">🏥</div>
            <p className="font-semibold text-gray-700 mb-1">Hali klinikaga yozilmagansiz</p>
            <p className="text-sm text-gray-400 mb-6">
              Birinchi broningizdan keyin klinika bu yerda ko'rinadi
            </p>
            <button
              onClick={() => router.push('/webapp/clinics')}
              className="px-6 py-3 rounded-2xl bg-blue-600 text-white text-sm font-semibold active:scale-95 transition-all"
            >
              Klinika qo'shish
            </button>
          </div>
        ) : (
          <div className="space-y-3 mt-2">
            {clinics.map((c) => {
              const isCurrent = c.id === current?.id
              const isLoading = switching === c.id
              return (
                <div
                  key={c.id}
                  className={`bg-white rounded-2xl p-4 flex items-center gap-3 shadow-sm border-2 transition-all ${
                    isCurrent ? 'border-blue-500' : 'border-transparent'
                  }`}
                >
                  <ClinicLogo src={c.logoUrl} name={c.name} size={48} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{c.name}</p>
                    {c.city && (
                      <p className="text-sm text-gray-500 truncate">{c.city}</p>
                    )}
                  </div>
                  {isCurrent ? (
                    <span className="shrink-0 text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full">
                      Joriy
                    </span>
                  ) : (
                    <button
                      onClick={() => handleSelect(c)}
                      disabled={isLoading}
                      className="shrink-0 text-sm font-semibold text-white bg-blue-600 px-4 py-2 rounded-xl active:scale-95 transition-all disabled:opacity-50"
                    >
                      {isLoading ? '...' : 'Tanlash'}
                    </button>
                  )}
                </div>
              )
            })}

            <button
              onClick={() => router.push('/webapp/clinics')}
              className="w-full p-4 rounded-2xl border-2 border-dashed border-gray-300 text-gray-600 text-sm hover:bg-gray-50 hover:border-gray-400 transition active:scale-95"
            >
              + Boshqa klinika qo'shish
            </button>
          </div>
        )}
      </Stack>
    </Container>
  )
}
