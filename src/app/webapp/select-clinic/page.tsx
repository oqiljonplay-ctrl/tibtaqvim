'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useClinic, type Clinic } from '@/lib/clinic-context'
import { ClinicLogo } from '@/components/ClinicLogo'
import { ResponsiveGrid } from '@/components/layout'

type ClinicListItem = Clinic & {
  description?: string | null
  ratingCount?: number
  branchCount?: number
  doctorCount?: number
  serviceCount?: number
}

export default function SelectClinicPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { setClinic } = useClinic()

  const [clinics, setClinics] = useState<ClinicListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selecting, setSelecting] = useState<string | null>(null)

  const nextPath = searchParams.get('next') || '/webapp'

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (query) params.set('search', query)
        const res = await fetch(`/api/clinics?${params}`)
        const data = await res.json()
        // API returns { data: { items: [...], total, limit, offset } }
        setClinics(data?.data?.items ?? [])
      } catch {}
      finally { setLoading(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  const handleSelect = (c: ClinicListItem) => {
    setSelecting(c.id)
    setClinic({
      id: c.id,
      name: c.name,
      city: c.city,
      logoUrl: c.logoUrl,
      address: c.address,
      phone: c.phone,
      rating: c.rating,
    })
    const target = nextPath.includes('?')
      ? `${nextPath}&clinic=${c.id}`
      : `${nextPath}?clinic=${c.id}`
    router.push(target)
  }

  return (
    <div className="w-full min-h-[100dvh] bg-gray-50">
      <div className="bg-blue-600 text-white pt-5 pb-6 px-4">
        <h1 className="font-bold text-xl">🏥 Klinikani tanlang</h1>
        <p className="text-blue-200 text-sm mt-0.5">
          Davolanmoqchi bo'lgan klinikani tanlang
        </p>
      </div>

      <div className="py-4 space-y-3 px-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Klinika nomi yoki shahar..."
          className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none min-h-[44px]"
        />

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 bg-white rounded-2xl animate-pulse shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-xl bg-gray-200 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : clinics.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl text-gray-400 shadow-sm">
            {query ? 'Topilmadi' : 'Hozircha klinika yo\'q'}
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-400">{clinics.length} ta klinika</p>
            <ResponsiveGrid cols={{ base: 1, sm: 2 }} gap={3}>
              {clinics.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleSelect(c)}
                  disabled={!!selecting}
                  className="w-full p-4 bg-white rounded-2xl shadow-sm border border-gray-100 text-left flex items-start gap-3 hover:shadow-md active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  <ClinicLogo src={c.logoUrl} name={c.name} size={64} />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{c.name}</h3>
                    {c.rating != null && c.rating > 0 && (
                      <p className="text-xs text-amber-600 mt-0.5">
                        ⭐ {c.rating.toFixed(1)}
                        {c.ratingCount ? ` (${c.ratingCount})` : ''}
                      </p>
                    )}
                    {c.address && (
                      <p className="text-xs text-gray-500 mt-1 truncate">📍 {c.address}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {c.doctorCount ? (
                        <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">
                          👨‍⚕️ {c.doctorCount} shifokor
                        </span>
                      ) : null}
                      {c.serviceCount ? (
                        <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full">
                          🏷 {c.serviceCount} xizmat
                        </span>
                      ) : null}
                      {c.branchCount && c.branchCount > 1 ? (
                        <span className="text-xs px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full">
                          🏥 {c.branchCount} filial
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {selecting === c.id ? (
                    <div className="text-blue-500 text-sm animate-pulse mt-1">...</div>
                  ) : (
                    <span className="text-gray-300 mt-1 flex-shrink-0">→</span>
                  )}
                </button>
              ))}
            </ResponsiveGrid>
          </>
        )}
      </div>
    </div>
  )
}
