'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useClinic } from '@/lib/clinic-context'
import { AppointmentCard, type HistoryAppointment } from '@/components/webapp/AppointmentCard'
import { HistoryFilters, type FilterState } from './HistoryFilters'
import { Container, ResponsiveGrid } from '@/components/layout'

type Scope = 'current' | 'all'

function getTelegramId(): string | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const fromParam = params.get('tgid')
  if (fromParam) return fromParam
  try {
    const tg = (window as any).Telegram?.WebApp
    if (tg?.initDataUnsafe?.user?.id) return String(tg.initDataUnsafe.user.id)
  } catch {}
  return null
}

export default function HistoryPage() {
  const { clinic, clinicId, loading: clinicLoading } = useClinic()

  const [scope, setScope] = useState<Scope>('current')
  const [appointments, setAppointments] = useState<HistoryAppointment[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [telegramId, setTelegramId] = useState<string | null>(null)

  const [filters, setFilters] = useState<FilterState>({
    statuses: [],
    dateFrom: '',
    dateTo: '',
    sort: 'desc',
  })

  const appointmentsRef = useRef(appointments)
  appointmentsRef.current = appointments
  const nextCursorRef = useRef(nextCursor)
  nextCursorRef.current = nextCursor

  useEffect(() => {
    setTelegramId(getTelegramId())
  }, [])

  const buildQuery = useCallback(
    (cursor?: string | null) => {
      const params = new URLSearchParams()
      if (telegramId) params.set('telegramId', telegramId)
      params.set('scope', scope)
      if (scope === 'current' && clinicId) params.set('clinicId', clinicId)
      if (filters.statuses.length > 0) params.set('status', filters.statuses.join(','))
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
      if (filters.dateTo) params.set('dateTo', filters.dateTo)
      params.set('sort', filters.sort)
      if (cursor) params.set('cursor', cursor)
      return params.toString()
    },
    [scope, clinicId, filters, telegramId]
  )

  const fetchData = useCallback(
    async (reset = true) => {
      if (!telegramId) { setLoading(false); return }
      if (scope === 'current' && !clinicId) { setLoading(false); return }

      if (reset) {
        setLoading(true)
        setAppointments([])
        setNextCursor(null)
      } else {
        setLoadingMore(true)
      }
      setError(null)

      try {
        const cursor = reset ? null : nextCursorRef.current
        const res = await fetch(`/api/me/appointments?${buildQuery(cursor)}`)
        const data = await res.json()

        if (!res.ok) {
          setError(data.error || 'Xato yuz berdi')
          return
        }

        setAppointments(reset ? data.appointments : [...appointmentsRef.current, ...data.appointments])
        setNextCursor(data.nextCursor)
        if (reset) setTotal(data.total)
      } catch {
        setError('Tarmoq xatosi')
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [scope, clinicId, filters, telegramId, buildQuery]
  )

  useEffect(() => {
    if (telegramId !== null) {
      fetchData(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, clinicId, filters, telegramId])

  if (clinicLoading) {
    return (
      <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center">
        <div className="text-center p-6 text-gray-400">
          <div className="text-4xl mb-3">🏥</div>
          <p className="text-sm animate-pulse">Yuklanmoqda...</p>
        </div>
      </div>
    )
  }

  if (!clinic) {
    return (
      <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center">
        <div className="text-center p-6 text-gray-500">
          <div className="text-3xl mb-2">🏥</div>
          <p>Klinika tanlanmagan</p>
        </div>
      </div>
    )
  }

  return (
    <Container size="full" className="min-h-[100dvh] bg-gray-50 pb-24 py-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                const params = new URLSearchParams(window.location.search)
                const qs = new URLSearchParams()
                const cId = params.get('clinic')
                const tgid = params.get('tgid')
                if (cId) qs.set('clinic', cId)
                if (tgid) qs.set('tgid', tgid)
                qs.set('mode', 'dashboard')
                window.location.href = `/webapp?${qs}`
              }
            }}
            className="text-blue-600 text-sm"
          >
            ←
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">📋 Tarix</h1>
            {scope === 'current' && (
              <p className="text-xs text-gray-500">{clinic.name}</p>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-white rounded-xl p-1 mb-4 shadow-sm">
          <TabButton active={scope === 'current'} onClick={() => setScope('current')}>
            Shu klinika
          </TabButton>
          <TabButton active={scope === 'all'} onClick={() => setScope('all')}>
            Barcha klinikalar
          </TabButton>
        </div>

        {/* Filters */}
        <HistoryFilters value={filters} onChange={setFilters} />

        {/* Total */}
        {total !== null && total > 0 && (
          <div className="text-xs text-gray-500 mb-3">Jami: {total} ta bron</div>
        )}

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-2/3 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-5 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>
        ) : appointments.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-xl text-gray-500">
            <div className="text-3xl mb-2">📭</div>
            <p className="font-medium">
              {scope === 'current' ? 'Bu klinikada hali bron yo\'q' : 'Sizda hali bron yo\'q'}
            </p>
          </div>
        ) : (
          <>
            <ResponsiveGrid cols={{ base: 1, sm: 2 }} gap={3}>
              {appointments.map((a) => (
                <AppointmentCard
                  key={a.id}
                  appointment={a}
                  showClinic={scope === 'all'}
                />
              ))}
            </ResponsiveGrid>

            {nextCursor && (
              <button
                onClick={() => fetchData(false)}
                disabled={loadingMore}
                className="w-full mt-4 py-3 bg-white rounded-xl border border-gray-200 text-gray-700 text-sm hover:bg-gray-50 disabled:opacity-50 transition"
              >
                {loadingMore ? 'Yuklanmoqda...' : 'Yana yuklash'}
              </button>
            )}
          </>
        )}
      </Container>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 px-3 rounded-lg font-medium text-sm transition ${
        active ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
  )
}
