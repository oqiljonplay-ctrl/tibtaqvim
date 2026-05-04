'use client';

import { getLocationLinks } from '@/lib/locationLinks';

interface LocationButtonsProps {
  locationLat?: number | null;
  locationLng?: number | null;
  address?: string | null;
}

export default function LocationButtons({ locationLat, locationLng, address }: LocationButtonsProps) {
  const result = getLocationLinks(locationLat, locationLng, address);

  if (!result) {
    return <div className="text-sm text-gray-500 italic">📍 Manzil ma'lumoti yo'q</div>;
  }

  const { links, isPrecise } = result;

  return (
    <div className="space-y-2">
      <div className="text-sm">
        {isPrecise ? (
          <span className="text-green-600">✅ Aniq koordinata (GPS)</span>
        ) : (
          <span className="text-yellow-600">⚠️ Faqat manzil matni (qidirish)</span>
        )}
      </div>

      {address && (
        <div className="text-sm text-gray-700">📍 {address}</div>
      )}

      {isPrecise && locationLat != null && locationLng != null && (
        <div className="text-xs text-gray-500 font-mono">
          GPS: {locationLat.toFixed(6)}, {locationLng.toFixed(6)}
        </div>
      )}

      <div className="flex flex-wrap gap-2 mt-2">
        <a
          href={links.yandex}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-md text-sm font-medium transition"
        >
          🗺️ Yandex
        </a>
        <a
          href={links.twoGis}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium transition"
        >
          📍 2GIS
        </a>
        <a
          href={links.google}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md text-sm font-medium transition"
        >
          🌍 Google Maps
        </a>
      </div>
    </div>
  );
}
