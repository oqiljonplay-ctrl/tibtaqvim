'use client'

import {
  createContext, useContext, useState, useEffect, useCallback, ReactNode,
} from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'

const STORAGE_KEY = 'tibtaqvim_clinic'
const URL_PARAM = 'clinic'

export type Clinic = {
  id: string
  name: string
  city: string | null
  logoUrl: string | null
  address?: string | null
  phone?: string | null
  rating?: number | null
}

type ClinicContextValue = {
  clinic: Clinic | null
  clinicId: string | null
  loading: boolean
  setClinic: (clinic: Clinic) => void
  clearClinic: () => void
  refresh: () => Promise<void>
}

const ClinicContext = createContext<ClinicContextValue | null>(null)

export function useClinic() {
  const ctx = useContext(ClinicContext)
  if (!ctx) throw new Error('useClinic must be used within ClinicProvider')
  return ctx
}

function getTgId(): string | null {
  if (typeof window === 'undefined') return null
  return (
    sessionStorage.getItem('tgid') ||
    new URLSearchParams(window.location.search).get('tgid') ||
    null
  )
}

function persistToDb(clinicId: string) {
  const tgId = getTgId()
  if (!tgId) return
  fetch(`/api/webapp/clinics/${clinicId}/select?tgid=${encodeURIComponent(tgId)}`, {
    method: 'POST',
  }).catch(() => {})
}

export function ClinicProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [clinic, setClinicState] = useState<Clinic | null>(null)
  const [loading, setLoading] = useState(true)

  const loadClinic = useCallback(async (id: string): Promise<Clinic | null> => {
    try {
      const res = await fetch(`/api/clinics/${id}`)
      if (!res.ok) return null
      const data = await res.json()
      const c = data?.data
      if (!c?.id) return null
      return {
        id: c.id,
        name: c.name,
        city: c.city ?? null,
        logoUrl: c.logoUrl ?? null,
        address: c.address ?? null,
        phone: c.phone ?? null,
        rating: typeof c.rating === 'number' ? c.rating : null,
      }
    } catch {
      return null
    }
  }, [])

  const initClinic = useCallback(async () => {
    setLoading(true)

    const tgId = getTgId()

    // ── TELEGRAM USER: DB yagona haqiqat manbai ─────────────────────────────
    if (tgId) {
      try {
        const res = await fetch(`/api/me/clinics?tgid=${encodeURIComponent(tgId)}`)
        if (res.ok) {
          const data = await res.json()
          const currentId: string | null = data?.currentClinicId ?? null
          const clinics: { id: string }[] = data?.clinics ?? []

          // 1. BEMOR TANLOVI USTUN: DB'da isCurrent=true bor
          //    Bot deeplink (?clinic=...) ni E'TIBORGA OLMA — u har bot xabarida bor
          if (currentId) {
            const loaded = await loadClinic(currentId)
            if (loaded) {
              setClinicState(loaded)
              if (typeof window !== 'undefined') {
                localStorage.setItem(STORAGE_KEY, loaded.id)
              }
              setLoading(false)
              return
            }
          }

          // 2. DB'da currentClinicId yo'q (yangi user, hech qachon tanlamagan)
          //    URL param bor va u membership'da → uni ishlatib DB'ga yoz
          const urlClinicId = searchParams.get(URL_PARAM) || searchParams.get('clinicId')
          if (urlClinicId && clinics.find((c) => c.id === urlClinicId)) {
            const loaded = await loadClinic(urlClinicId)
            if (loaded) {
              setClinicState(loaded)
              if (typeof window !== 'undefined') {
                localStorage.setItem(STORAGE_KEY, loaded.id)
              }
              persistToDb(loaded.id)
              setLoading(false)
              return
            }
          }

          // 3. Birinchi membership klinikasi default
          if (clinics.length > 0) {
            const loaded = await loadClinic(clinics[0].id)
            if (loaded) {
              setClinicState(loaded)
              if (typeof window !== 'undefined') {
                localStorage.setItem(STORAGE_KEY, loaded.id)
              }
              persistToDb(loaded.id)
              setLoading(false)
              return
            }
          }

          // 4. Membership yo'q — klinika tanlash sahifasiga
          setClinicState(null)
          setLoading(false)
          return
        }
      } catch {}
    }

    // ── TELEGRAM ID YO'Q (brauzerda to'g'ridan kirgan) ──────────────────────
    // URL param → localStorage tartibida

    const urlClinicId = searchParams.get(URL_PARAM) || searchParams.get('clinicId')
    if (urlClinicId) {
      const loaded = await loadClinic(urlClinicId)
      if (loaded) {
        setClinicState(loaded)
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, loaded.id)
        }
        setLoading(false)
        return
      }
      // Topilmadi — URL'ni tozala
      const newParams = new URLSearchParams(searchParams.toString())
      newParams.delete(URL_PARAM)
      newParams.delete('clinicId')
      router.replace(`${pathname}?${newParams.toString()}`)
    }

    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const loaded = await loadClinic(stored)
        if (loaded) {
          setClinicState(loaded)
          setLoading(false)
          return
        }
        localStorage.removeItem(STORAGE_KEY)
      }
    }

    setClinicState(null)
    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    initClinic()
  }, []) // mount-only

  // Clinic.id ni URL `?clinic=` parametriga sync qilish
  useEffect(() => {
    if (!clinic || typeof window === 'undefined') return
    if (pathname === '/webapp/my-clinics') return
    const currentParam = searchParams.get(URL_PARAM)
    if (currentParam !== clinic.id) {
      const newParams = new URLSearchParams(searchParams.toString())
      newParams.delete('clinicId')
      newParams.set(URL_PARAM, clinic.id)
      router.replace(`${pathname}?${newParams.toString()}`)
    }
  }, [clinic]) // eslint-disable-line react-hooks/exhaustive-deps

  const setClinic = useCallback((c: Clinic) => {
    setClinicState(c)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, c.id)
      // DB'ga saqlash (fire-and-forget) — sessiyalar orasida saqlanadi
      persistToDb(c.id)
      ;['booking_draft', 'cart', 'selected_service', 'selected_doctor', 'selected_slot'].forEach(
        (k) => localStorage.removeItem(k),
      )
    }
  }, [])

  const clearClinic = useCallback(() => {
    setClinicState(null)
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  const refresh = useCallback(async () => {
    if (!clinic) return
    const fresh = await loadClinic(clinic.id)
    if (fresh) setClinicState(fresh)
  }, [clinic, loadClinic])

  return (
    <ClinicContext.Provider value={{
      clinic,
      clinicId: clinic?.id ?? null,
      loading,
      setClinic,
      clearClinic,
      refresh,
    }}>
      {children}
    </ClinicContext.Provider>
  )
}
