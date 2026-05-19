'use client'

import { useState } from 'react'

export type FilterState = {
  statuses: string[]
  dateFrom: string
  dateTo: string
  sort: 'asc' | 'desc'
}

const STATUS_OPTIONS = [
  { value: 'booked',    label: 'Kutilmoqda' },
  { value: 'arrived',   label: 'Keldi' },
  { value: 'missed',    label: 'Kelmadi' },
  { value: 'cancelled', label: 'Bekor qilindi' },
]

export function HistoryFilters({
  value,
  onChange,
}: {
  value: FilterState
  onChange: (v: FilterState) => void
}) {
  const [expanded, setExpanded] = useState(false)

  const toggleStatus = (s: string) => {
    const has = value.statuses.includes(s)
    onChange({
      ...value,
      statuses: has ? value.statuses.filter((x) => x !== s) : [...value.statuses, s],
    })
  }

  const clearAll = () => {
    onChange({ statuses: [], dateFrom: '', dateTo: '', sort: 'desc' })
  }

  const activeCount =
    value.statuses.length + (value.dateFrom ? 1 : 0) + (value.dateTo ? 1 : 0)

  return (
    <div className="bg-white rounded-xl mb-3 overflow-hidden shadow-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Filterlar</span>
          {activeCount > 0 && (
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
              {activeCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {value.sort === 'desc' ? 'Yangi → Eski' : 'Eski → Yangi'}
          </span>
          <span className="text-gray-400 text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="p-3 pt-0 border-t border-gray-100 space-y-3">
          {/* Saralash */}
          <div>
            <div className="text-xs text-gray-500 mb-1">Saralash</div>
            <div className="flex gap-2">
              {(['desc', 'asc'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => onChange({ ...value, sort: s })}
                  className={`flex-1 py-2 rounded-lg text-sm border transition ${
                    value.sort === s
                      ? 'bg-blue-50 border-blue-500 text-blue-700'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {s === 'desc' ? 'Yangi → Eski' : 'Eski → Yangi'}
                </button>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <div className="text-xs text-gray-500 mb-1">Holat</div>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((s) => {
                const active = value.statuses.includes(s.value)
                return (
                  <button
                    key={s.value}
                    onClick={() => toggleStatus(s.value)}
                    className={`px-3 py-1.5 rounded-full text-xs border transition ${
                      active
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'border-gray-200 text-gray-600'
                    }`}
                  >
                    {s.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Sana oralig'i */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-xs text-gray-500 mb-1">Boshlanish</div>
              <input
                type="date"
                value={value.dateFrom}
                onChange={(e) => onChange({ ...value, dateFrom: e.target.value })}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Tugash</div>
              <input
                type="date"
                value={value.dateTo}
                onChange={(e) => onChange({ ...value, dateTo: e.target.value })}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          </div>

          {activeCount > 0 && (
            <button
              onClick={clearAll}
              className="w-full py-2 text-sm text-red-600 hover:underline"
            >
              Tozalash
            </button>
          )}
        </div>
      )}
    </div>
  )
}
