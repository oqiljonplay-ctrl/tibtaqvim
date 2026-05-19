'use client'

import { ClinicLogo } from '@/components/ClinicLogo'

export type HistoryAppointment = {
  id: string
  date: string          // ISO date from DB
  status: 'booked' | 'arrived' | 'missed' | 'cancelled'
  queueNumber: number | null
  patientName: string
  clinic: {
    id: string
    name: string
    logoUrl: string | null
    city: string | null
  }
  branch?: { id: string; name: string; address: string | null } | null
  service: {
    id: string
    name: string
    type: string
    price: unknown   // Decimal from Prisma — toString() ile
  }
  doctor?: {
    id: string
    firstName: string
    lastName: string | null
    specialty: string | null
    photoUrl: string | null
  } | null
  slot?: { startTime: string; endTime: string } | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  booked:    { label: 'Kutilmoqda',    color: 'bg-blue-100 text-blue-700' },
  arrived:   { label: 'Keldi',         color: 'bg-green-100 text-green-700' },
  missed:    { label: 'Kelmadi',       color: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Bekor qilindi', color: 'bg-gray-100 text-gray-500' },
}

export function AppointmentCard({
  appointment,
  showClinic = true,
}: {
  appointment: HistoryAppointment
  showClinic?: boolean
}) {
  const date = new Date(appointment.date)
  const statusInfo = STATUS_CONFIG[appointment.status] || {
    label: appointment.status,
    color: 'bg-gray-100 text-gray-500',
  }

  const dateStr = date.toLocaleDateString('uz-UZ', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  const price = appointment.service.price
    ? Number(appointment.service.price).toLocaleString('uz-UZ')
    : null

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      {/* Klinika header — faqat "Barcha klinikalar" tabida */}
      {showClinic && (
        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-100">
          <ClinicLogo src={appointment.clinic.logoUrl} name={appointment.clinic.name} size={32} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">{appointment.clinic.name}</div>
            {appointment.branch && (
              <div className="text-xs text-gray-500 truncate">{appointment.branch.name}</div>
            )}
          </div>
        </div>
      )}

      {/* Status + sana */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1">
          <div className="text-xs text-gray-500">{dateStr}</div>
          {appointment.slot && (
            <div className="text-base font-semibold">
              🕐 {appointment.slot.startTime} — {appointment.slot.endTime}
            </div>
          )}
          {appointment.queueNumber && !appointment.slot && (
            <div className="text-base font-semibold text-blue-600">
              Navbat #{appointment.queueNumber}
            </div>
          )}
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium shrink-0 ${statusInfo.color}`}>
          {statusInfo.label}
        </span>
      </div>

      {/* Xizmat */}
      <div className="mb-2">
        <div className="font-semibold text-gray-900">{appointment.service.name}</div>
      </div>

      {/* Doktor */}
      {appointment.doctor && (
        <div className="flex items-center gap-1.5 mb-2 text-sm text-gray-600">
          <span>👨‍⚕️</span>
          <span>
            {appointment.doctor.firstName} {appointment.doctor.lastName || ''}
          </span>
          {appointment.doctor.specialty && (
            <span className="text-gray-400">· {appointment.doctor.specialty}</span>
          )}
        </div>
      )}

      {/* Narx */}
      {price && (
        <div className="text-sm font-semibold text-gray-700">💰 {price} so'm</div>
      )}

      {/* Filial — faqat "Shu klinika" tabida pastda */}
      {!showClinic && appointment.branch && (
        <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
          📍 {appointment.branch.name}
          {appointment.branch.address ? ` — ${appointment.branch.address}` : ''}
        </div>
      )}
    </div>
  )
}
