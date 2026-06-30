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

// FIX XATO 1: tgId ni sessionStorage'ga darhol saqlash (URL o'zgarsa ham yo'qolmasin)
function captureTgId(): void {
  if (typeof window === 'undefined') return
  const urlTgId = new URLSearchParams(window.location.search).get('tgid')
  if (urlTgId) {
    sessionStorage.setItem('tgid', urlTgId)
    return
  }
  // Telegram WebApp API fallback (agar sessionStorage hali bo'sh bo'lsa)
  const tgWebApp = (window as any).Telegram?.WebApp
  if (tgWebApp?.initDataUnsafe?.user?.id && !sessionStorage.getItem('tgid')) {
    sessionStorage.setItem('tgid', String(tgWebApp.initDataUnsafe.user.id))
  }
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
          if (currentId) {
            // inline currentClinic — 2-chi round-trip yo'q (mudofaa: kelmasa eski yo'l)
            const loaded = (data.currentClinic ?? null) || await loadClinic(currentId)
            if (loaded) {
              setClinicState(loaded)
              if (typeof window !== 'undefined') {
                localStorage.setItem(STORAGE_KEY, loaded.id)
              }
              setLoading(false)
              return
            }
          }

          // 2. DB'da currentClinicId yo'q — URL param bor va membership'da
          //    FIX XATO 3: faqat KO'RSAT, DB'ga YOZMA (persistToDb olib tashlandi)
          const urlClinicId = searchParams.get(URL_PARAM) || searchParams.get('clinicId')
          if (urlClinicId && clinics.find((c) => c.id === urlClinicId)) {
            const loaded = await loadClinic(urlClinicId)
            if (loaded) {
              setClinicState(loaded)
              if (typeof window !== 'undefined') {
                localStorage.setItem(STORAGE_KEY, loaded.id)
              }
              // persistToDb OLIB TASHLANDI — URL'dagi clinicId avtomatik DB'ga yozilmaydi
              setLoading(false)
              return
            }
          }

          // 3. Birinchi membership klinikasi — faqat KO'RSAT
          //    FIX XATO 3: persistToDb olib tashlandi
          if (clinics.length > 0) {
            const loaded = await loadClinic(clinics[0].id)
            if (loaded) {
              setClinicState(loaded)
              if (typeof window !== 'undefined') {
                localStorage.setItem(STORAGE_KEY, loaded.id)
              }
              // persistToDb OLIB TASHLANDI
              setLoading(false)
              return
            }
          }

          // 4. Membership yo'q
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
    // FIX XATO 1: tgId ni birinchi bo'lib sessionStorage'ga saqlash
    captureTgId()
    initClinic()
  }, []) // mount-only

  // FIX XATO 2: URL sync effect BUTUNLAY OLIB TASHLANDI
  // Sabab: DB asosiy manba. URL sync tgid parametrini yo'qotishi va
  // searchParams bilan loop yaratishi mumkin edi.

  const setClinic = useCallback((c: Clinic) => {
    setClinicState(c)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, c.id)
      // persistToDb faqat bu yerda — foydalanuvchi intentional "Tanlash" bossa
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
