'use client';

import { useState, useEffect, useCallback } from 'react';

interface LiveMapModalProps {
  appointmentId: string;
  patientName: string;
  initialLat: number;
  initialLng: number;
  onClose: () => void;
}

interface LiveData {
  liveLat: number | null;
  liveLng: number | null;
  liveLastUpdatedAt: string | null;
  liveStatus: string | null;
}

export default function LiveMapModal({
  appointmentId,
  patientName,
  initialLat,
  initialLng,
  onClose,
}: LiveMapModalProps) {
  const [lat, setLat] = useState(initialLat);
  const [lng, setLng] = useState(initialLng);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [now, setNow] = useState(() => new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLatest = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/appointments/${appointmentId}/live`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: LiveData = await res.json();

      if (data.liveStatus !== 'active') {
        setError('Jonli joylashuv tugagan');
        return;
      }
      if (data.liveLat != null && data.liveLng != null) {
        setLat(data.liveLat);
        setLng(data.liveLng);
        if (data.liveLastUpdatedAt) {
          setLastUpdated(new Date(data.liveLastUpdatedAt));
        }
      }
    } catch {
      setError("Yangilab bo'lmadi");
    } finally {
      setIsLoading(false);
    }
  }, [appointmentId]);

  useEffect(() => {
    const timer = setInterval(fetchLatest, 15_000);
    return () => clearInterval(timer);
  }, [fetchLatest]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 5_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const updatedAgoSec = Math.round((now.getTime() - lastUpdated.getTime()) / 1000);
  const updatedText =
    updatedAgoSec < 30
      ? 'Hozirgina yangilandi'
      : updatedAgoSec < 60
      ? `${updatedAgoSec} sekund avval`
      : `${Math.floor(updatedAgoSec / 60)} daqiqa avval`;

  const yandexEmbedUrl = `https://yandex.com/map-widget/v1/?ll=${lng},${lat}&z=16&pt=${lng},${lat},pm2rdm`;
  const yandexLink = `https://yandex.com/maps/?ll=${lng},${lat}&z=17&pt=${lng},${lat}`;
  const twoGisLink = `https://2gis.uz/geo/${lng},${lat}`;
  const googleLink = `https://maps.google.com/?q=${lat},${lng}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </span>
            <div>
              <div className="font-semibold">{patientName}</div>
              <div className="text-xs text-gray-500">
                {error ? <span className="text-red-500">{error}</span> : updatedText}
                {isLoading && <span className="ml-2 text-blue-500">⟳</span>}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none px-2"
            aria-label="Yopish"
          >
            ×
          </button>
        </div>

        {/* Iframe xarita */}
        <div className="flex-1 min-h-[400px] bg-gray-100">
          <iframe
            key={`${lat}-${lng}`}
            src={yandexEmbedUrl}
            className="w-full h-full border-0 min-h-[400px]"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* Footer */}
        <div className="p-3 border-t bg-gray-50 space-y-2">
          <div className="flex flex-wrap gap-2 justify-center">
            <a
              href={yandexLink}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-md text-sm font-medium"
            >
              🗺️ Yandex
            </a>
            <a
              href={twoGisLink}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium"
            >
              📍 2GIS
            </a>
            <a
              href={googleLink}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-medium"
            >
              🌍 Google
            </a>
            <button
              onClick={fetchLatest}
              disabled={isLoading}
              className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md text-sm font-medium disabled:opacity-50"
            >
              🔄 Yangilash
            </button>
          </div>
          <div className="text-xs text-gray-500 text-center font-mono">
            GPS: {lat.toFixed(6)}, {lng.toFixed(6)}
          </div>
        </div>
      </div>
    </div>
  );
}
