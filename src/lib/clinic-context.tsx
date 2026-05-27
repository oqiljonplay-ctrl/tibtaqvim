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
      // /api/clinics/[id] wraps in { data: { id, name, ... } }
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

    // 1. URL param — support both `clinic` and legacy `clinicId`
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
      // Inactive / not found — clean URL param
      const newParams = new URLSearchParams(searchParams.toString())
      newParams.delete(URL_PARAM)
      newParams.delete('clinicId')
      router.replace(`${pathname}?${newParams.toString()}`)
    }

    // 2. localStorage
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

    // 3. API — last booked clinic (via telegramId from URL)
    try {
      const tgId = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('tgid')
        : null
      const url = tgId ? `/api/me/clinics?tgid=${tgId}` : '/api/me/clinics'
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        const lastId = data?.lastClinicId
        if (lastId) {
          const loaded = await loadClinic(lastId)
          if (loaded) {
            setClinicState(loaded)
            if (typeof window !== 'undefined') {
              localStorage.setItem(STORAGE_KEY, loaded.id)
            }
            setLoading(false)
            return
          }
        }
      }
    } catch {}

    // 4. Nothing found
    setClinicState(null)
    setLoading(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    initClinic()
  }, []) // mount-only

  // Sync clinic.id into URL `?clinic=` param
  useEffect(() => {
    if (!clinic || typeof window === 'undefined') return
    if (pathname === '/webapp/my-clinics') return
    const currentParam = searchParams.get(URL_PARAM)
    if (currentParam !== clinic.id) {
      const newParams = new URLSearchParams(searchParams.toString())
      newParams.delete('clinicId') // remove legacy param
      newParams.set(URL_PARAM, clinic.id)
      router.replace(`${pathname}?${newParams.toString()}`)
    }
  }, [clinic]) // eslint-disable-line react-hooks/exhaustive-deps

  const setClinic = useCallback((c: Clinic) => {
    setClinicState(c)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, c.id)
      // Clear any in-progress booking state
      ;['booking_draft', 'cart', 'selected_service', 'selected_doctor', 'selected_slot'].forEach(
        (k) => localStorage.removeItem(k)
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
