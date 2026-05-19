'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useClinic, type Clinic } from '@/lib/clinic-context'
import { ClinicLogo } from '@/components/ClinicLogo'

export function ClinicSwitcher() {
  const { clinic } = useClinic()
  const [open, setOpen] = useState(false)

  if (!clinic) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full p-3 bg-white rounded-xl flex items-center gap-3 hover:bg-gray-50 transition active:scale-[0.98]"
      >
        <ClinicLogo src={clinic.logoUrl} name={clinic.name} size={40} />
        <div className="flex-1 text-left min-w-0">
          <div className="text-xs text-gray-500">Joriy klinika</div>
          <div className="font-semibold text-gray-900 truncate">{clinic.name}</div>
        </div>
        <div className="text-gray-400 text-xs">▼</div>
      </button>

      {open && <ClinicSwitcherSheet onClose={() => setOpen(false)} />}
    </>
  )
}

function ClinicSwitcherSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const { clinic: current, setClinic } = useClinic()
  const [myClinics, setMyClinics] = useState<Clinic[]>([])
  const [loading, setLoading] = useState(true)
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const tgId = typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('tgid')
      : null
    const url = tgId ? `/api/me/clinics?tgid=${tgId}` : '/api/me/clinics'
    fetch(url)
      .then((r) => r.json())
      .then((data) => setMyClinics(data.clinics ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSwitch = (c: Clinic) => {
    if (c.id === current?.id) {
      onClose()
      return
    }

    const hasDraft = typeof window !== 'undefined' && (
      localStorage.getItem('booking_draft') ||
      localStorage.getItem('cart') ||
      localStorage.getItem('selected_service')
    )

    if (hasDraft) {
      const ok = confirm(
        'Klinikani almashtirsangiz, joriy tanlovlaringiz bekor qilinadi. Davom etasizmi?'
      )
      if (!ok) return
    }

    setClinic(c)
    onClose()
    router.push('/')
  }

  const handleAddNew = () => {
    onClose()
    router.push('/webapp/select-clinic')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        ref={sheetRef}
        className="relative w-full max-w-md mx-auto bg-white rounded-t-2xl p-4 pb-8 max-h-[80vh] overflow-y-auto animate-slide-up"
        style={{ animation: 'slideUp 0.25s ease-out' }}
      >
        <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
        <h3 className="text-lg font-bold mb-1">Klinikani almashtirish</h3>
        <p className="text-sm text-gray-500 mb-4">
          Boshqa klinikadagi bronlaringizni ko'rish uchun tanlang
        </p>

        {loading ? (
          <div className="p-6 text-center text-gray-400 text-sm">Yuklanmoqda...</div>
        ) : (
          <>
            {myClinics.length > 0 && (
              <div className="space-y-2 mb-4">
                <div className="text-xs text-gray-500 uppercase tracking-wide px-2">
                  Mening klinikalarim
                </div>
                {myClinics.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleSwitch(c)}
                    className={`w-full p-3 rounded-xl flex items-center gap-3 transition ${
                      c.id === current?.id
                        ? 'bg-blue-50 border-2 border-blue-500'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <ClinicLogo src={c.logoUrl} name={c.name} size={48} />
                    <div className="flex-1 text-left min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{c.name}</div>
                      {c.city && (
                        <div className="text-sm text-gray-500 truncate">{c.city}</div>
                      )}
                    </div>
                    {c.id === current?.id && (
                      <div className="text-blue-600 text-sm font-bold">✓</div>
                    )}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={handleAddNew}
              className="w-full p-3 rounded-xl border-2 border-dashed border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400 transition text-sm"
            >
              + Boshqa klinika qo'shish
            </button>
          </>
        )}
      </div>

      <style jsx>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
