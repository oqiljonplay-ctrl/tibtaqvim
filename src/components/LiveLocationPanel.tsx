'use client';

import { useState, useEffect } from 'react';
import LiveMapModal from './LiveMapModal';

interface LiveLocationPanelProps {
  appointmentId: string;
  patientName: string;
  liveLat: number;
  liveLng: number;
  liveStartedAt: string | Date;
  liveExpiresAt: string | Date;
  liveLastUpdatedAt: string | Date;
  liveStatus: string;
}

export default function LiveLocationPanel({
  appointmentId,
  patientName,
  liveLat,
  liveLng,
  liveExpiresAt,
  liveLastUpdatedAt,
  liveStatus,
}: LiveLocationPanelProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(timer);
  }, []);

  if (liveStatus !== 'active') return null;

  const expiresAt = new Date(liveExpiresAt);
  const lastUpdatedAt = new Date(liveLastUpdatedAt);

  const isExpired = now > expiresAt;
  if (isExpired) return null;

  const remainingMs = expiresAt.getTime() - now.getTime();
  const remainingHours = Math.floor(remainingMs / 3_600_000);
  const remainingMinutes = Math.floor((remainingMs % 3_600_000) / 60_000);
  const remainingText =
    remainingHours > 0
      ? `${remainingHours} soat ${remainingMinutes} daqiqa`
      : `${remainingMinutes} daqiqa`;

  const updatedAgoSec = Math.round((now.getTime() - lastUpdatedAt.getTime()) / 1000);
  const updatedText =
    updatedAgoSec < 30
      ? 'Hozirgina yangilandi'
      : updatedAgoSec < 60
      ? `${updatedAgoSec} sekund avval`
      : updatedAgoSec < 3600
      ? `${Math.floor(updatedAgoSec / 60)} daqiqa avval`
      : `${Math.floor(updatedAgoSec / 3600)} soat avval`;

  const isStale = updatedAgoSec > 180;

  return (
    <>
      <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <span className="relative flex h-3 w-3">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
                isStale ? 'bg-amber-400' : 'bg-emerald-400'
              } opacity-75`}
            />
            <span
              className={`relative inline-flex rounded-full h-3 w-3 ${
                isStale ? 'bg-amber-500' : 'bg-emerald-500'
              }`}
            />
          </span>
          <span className={`font-semibold text-sm ${isStale ? 'text-amber-700' : 'text-emerald-700'}`}>
            {isStale ? '⚠️ JONLI (yangilanmaydi)' : '🟢 JONLI JOYLASHUV AKTIV'}
          </span>
        </div>

        <div className="text-xs text-gray-700 space-y-1 mb-3">
          <div>⏱️ {updatedText}</div>
          <div>⏰ Qolgan vaqt: {remainingText}</div>
          <div className="font-mono text-gray-500">
            GPS: {liveLat.toFixed(6)}, {liveLng.toFixed(6)}
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-medium transition flex items-center justify-center gap-2"
        >
          🗺️ Jonli xaritani ochish
        </button>
      </div>

      {isModalOpen && (
        <LiveMapModal
          appointmentId={appointmentId}
          patientName={patientName}
          initialLat={liveLat}
          initialLng={liveLng}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
}
