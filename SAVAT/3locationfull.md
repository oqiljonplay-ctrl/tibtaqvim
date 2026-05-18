🚀 Endi 2-bosqich: Frontend — 3 ta xarita tugmasi
Doktor/xodim panelida appointment ochilganda 3 ta xarita tugmasi kerak.
📂 1-fayl: Helper — URL yaratuvchi (yangi fayl)
Fayl: src/lib/locationLinks.ts (yoki src/utils/locationLinks.ts — sizdagi yo'lga qarab)
// src/lib/locationLinks.ts
// Manzil/koordinata bo'yicha xarita URL yaratish

export interface LocationLinks {
  yandex: string;
  twoGis: string;
  google: string;
}

/**
 * Aniq koordinata bo'yicha URL'lar (eng aniq, marshrut beradi)
 */
export function buildLocationLinks(lat: number, lng: number): LocationLinks {
  return {
    // Yandex Maps — O'zbekistonda eng aniq
    yandex: https://yandex.com/maps/?ll=${lng},${lat}&z=17&pt=${lng},${lat},
    // 2GIS — mahalliy biznes/manzil ma'lumotlari
    twoGis: https://2gis.uz/geo/${lng},${lat},
    // Google Maps — universal
    google: https://maps.google.com/?q=${lat},${lng},
  };
}

/**
 * Faqat manzil matni bo'lsa (koordinata yo'q) — qidirish URL'lari
 */
export function buildAddressSearchLinks(address: string): LocationLinks {
  const encoded = encodeURIComponent(address);
  return {
    yandex: https://yandex.com/maps/?text=${encoded},
    twoGis: https://2gis.uz/search/${encoded},
    google: https://maps.google.com/?q=${encoded},
  };
}

/**
 * Smart helper — koordinata bo'lsa aniq nuqta, bo'lmasa qidirish
 */
export function getLocationLinks(
  lat: number | null | undefined,
  lng: number | null | undefined,
  address: string | null | undefined
): { links: LocationLinks; isPrecise: boolean } | null {
  if (lat != null && lng != null) {
    return { links: buildLocationLinks(lat, lng), isPrecise: true };
  }
  if (address && address.trim().length >= 3) {
    return { links: buildAddressSearchLinks(address.trim()), isPrecise: false };
  }
  return null;
}
📂 2-fayl: React komponent (yangi fayl)
Fayl: src/components/LocationButtons.tsx
// src/components/LocationButtons.tsx
'use client';

import { getLocationLinks } from '@/lib/locationLinks';

interface LocationButtonsProps {
  locationLat?: number | null;
  locationLng?: number | null;
  address?: string | null;
}

export default function LocationButtons({ 
  locationLat, 
  locationLng, 
  address 
}: LocationButtonsProps) {
  const result = getLocationLinks(locationLat, locationLng, address);
  
  if (!result) {
    return (
      <div className="text-sm text-gray-500 italic">
        📍 Manzil ma'lumoti yo'q
      </div>
    );
  }
  
  const { links, isPrecise } = result;
  
  return (
    <div className="space-y-2">
      {/* Aniqlik holati */}
      <div className="flex items-center gap-2 text-sm">
        {isPrecise ? (
          <span className="text-green-600 flex items-center gap-1">
            ✅ Aniq koordinata (GPS)
          </span>
        ) : (
          <span className="text-yellow-600 flex items-center gap-1">
            ⚠️ Faqat manzil matni (qidirish)
          </span>
        )}
      </div>
      
      {/* Manzil matni (agar bo'lsa) */}
      {address && (
        <div className="text-sm text-gray-700">
          📍 {address}
        </div>
      )}
      
      {/* Koordinata (agar bo'lsa) */}
      {isPrecise && locationLat != null && locationLng != null && (
        <div className="text-xs text-gray-500 font-mono">
          GPS: {locationLat.toFixed(6)}, {locationLng.toFixed(6)}
        </div>
      )}
      
      {/* 3 ta xarita tugmasi */}
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
📂 3-fayl: Appointment kartasiga qo'shish
Doktor/xodim panelida appointment ko'rsatiladigan komponentni topib, shu komponentni qo'shasiz:
import LocationButtons from '@/components/LocationButtons';

// Appointment kartasi ichida — patientPhone yonida yoki alohida bo'limda:
{appointment.serviceName?.toLowerCase().includes('uyda') && (
  <div className="border-t pt-3 mt-3">
    <h3 className="font-semibold mb-2">🏠 Uyda bemor ko'rish — Manzil</h3>
    <LocationButtons 
      locationLat={appointment.locationLat}
      locationLng={appointment.locationLng}
      address={appointment.address}
    />
  </div>
)}
📋 Sizdan kerak
Vazifa
Holat
1. src/lib/locationLinks.ts yaratish
⏳ Siz
2. src/components/LocationButtons.tsx yaratish
⏳ Siz
3. Appointment kartasiga qo'shish (doktor/xodim panelida)
⏳ Siz
4. git push → Vercel deploy
⏳ Siz
🧪 Test sxemasi
Deploy bo'lgach:
Doktor sifatida login qiling
Nilufar opa yoki Aliyev vali'ning oxirgi uy bron'ini oching
Ko'rinishi kerak:
✅ Aniq koordinata (GPS)
📍 Buxoro viloyati juynav mfy / Gijduvon soktari 17/2
GPS: 40.109654, 64.679709
🗺️ Yandex / 📍 2GIS / 🌍 Google tugmalari
Yandex bosing → https://yandex.com/maps/?ll=64.679709,40.109654... ochiladi
Xaritada Buxoro viloyati Gijduvon atrofida nuqta ko'rinishi kerak
❓ Yordam kerakmi?
Doktor/xodim paneli qaysi sahifa/komponentda ekanligini bilmasangiz, lokal kompyuteringizda:
findstr /S /I /N "patientName" src\app\*.tsx src\components\*.tsx
findstr /S /I /N "appointment" src\app\(dashboard)\*.tsx
Natijani yuboring — men aniq qaysi faylga qaysi qatorga qo'shishni ko'rsataman.