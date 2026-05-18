📋 Aniq vazifa
Faqat 2 ta yangi fayl + 1 ta mavjud faylga 1 satr import qo'shish.
Mavjud:
✅ LocationButtons.tsx — TEGMAYDI (oddiy joylashuv 3 ta tugma)
✅ locationLinks.ts — TEGMAYDI
✅ Bot kodi — TEGMAYDI
✅ DB sxema — TEGMAYDI
Yangi:
🆕 LiveLocationPanel.tsx — alohida komponent (live ko'rsatish)
🆕 LiveMapModal.tsx — modal xarita
✏️ Doktor/qabulxona sahifasiga bitta qator qo'shish (faqat live aktiv bo'lsa ko'rinsin)
📂 FAYL 1: src/components/LiveLocationPanel.tsx (yangi)
Bu mustaqil komponent — LocationButtons'dan alohida ishlaydi.
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

/**
 * Jonli joylashuv paneli — faqat liveStatus='active' bo'lganda render qilinadi.
 * Mavjud LocationButtons'dan butunlay alohida ishlaydi (oddiy joylashuvga tegmaydi).
 */
export default function LiveLocationPanel({
  appointmentId,
  patientName,
  liveLat,
  liveLng,
  liveStartedAt,
  liveExpiresAt,
  liveLastUpdatedAt,
  liveStatus,
}: LiveLocationPanelProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());

  // Har 10 sekundda joriy vaqtni yangilaymiz (relative time uchun)
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(timer);
  }, []);

  // liveStatus 'active' bo'lmasa — hech narsa render qilmaymiz
  if (liveStatus !== 'active') return null;

  const expiresAt = new Date(liveExpiresAt);
  const lastUpdatedAt = new Date(liveLastUpdatedAt);

  // Muddati tugaganmi?
  const isExpired = now > expiresAt;
  if (isExpired) return null; // tugagan — ko'rsatmaymiz (server tomondan ham 'expired' yangilanadi)

  // Qolgan vaqt
  const remainingMs = expiresAt.getTime() - now.getTime();
  const remainingHours = Math.floor(remainingMs / 3_600_000);
  const remainingMinutes = Math.floor((remainingMs % 3_600_000) / 60_000);
  const remainingText =
    remainingHours > 0
      ? ${remainingHours} soat ${remainingMinutes} daqiqa
      : ${remainingMinutes} daqiqa;

  // Oxirgi yangilanish (relative)
  const updatedAgoMs = now.getTime() - lastUpdatedAt.getTime();
  const updatedAgoSec = Math.round(updatedAgoMs / 1000);
  const updatedText =
    updatedAgoSec < 30
      ? 'Hozirgina yangilandi'
      : updatedAgoSec < 60
      ? ${updatedAgoSec} sekund avval
      : updatedAgoSec < 3600
      ? ${Math.floor(updatedAgoSec / 60)} daqiqa avval
      : ${Math.floor(updatedAgoSec / 3600)} soat avval;

  // Stale ekanmi (>3 daqiqa yangilanmagan)?
  const isStale = updatedAgoSec > 180;

  return (
    <>
      <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <span className="relative flex h-3 w-3">
            <span
              className={animate-ping absolute inline-flex h-full w-full rounded-full ${
                isStale ? 'bg-amber-400' : 'bg-emerald-400'
              } opacity-75}
            />
            <span
              className={relative inline-flex rounded-full h-3 w-3 ${
                isStale ? 'bg-amber-500' : 'bg-emerald-500'
              }}
            />
          </span>
          <span className={font-semibold text-sm ${isStale ? 'text-amber-700' : 'text-emerald-700'}}>
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
📂 FAYL 2: src/components/LiveMapModal.tsx (yangi)
Modal xarita — har 15 sekundda DB'dan yangi koordinata oladi.
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

  // Yangi koordinatani DB'dan olish
  const fetchLatest = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(/api/appointments/${appointmentId}/live, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(HTTP ${res.status});
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
    } catch (err) {
      setError('Yangilab bo\'lmadi');
    } finally {
      setIsLoading(false);
    }
  }, [appointmentId]);

  // Har 15 sekundda yangilash
  useEffect(() => {
    const timer = setInterval(fetchLatest, 15_000);
    return () => clearInterval(timer);
  }, [fetchLatest]);

  // Joriy vaqt (relative timer uchun)
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 5_000);
    return () => clearInterval(timer);
  }, []);

  // ESC tugmasi modal yopadi
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
      ? ${updatedAgoSec} sekund avval
      : ${Math.floor(updatedAgoSec / 60)} daqiqa avval;

  // Yandex iframe URL — eng aniq O'zbekiston manzillari
  const yandexEmbedUrl = https://yandex.com/map-widget/v1/?ll=${lng},${lat}&z=16&pt=${lng},${lat},pm2rdm;
  const yandexLink = https://yandex.com/maps/?ll=${lng},${lat}&z=17&pt=${lng},${lat};
  const twoGisLink = https://2gis.uz/geo/${lng},${lat};
  const googleLink = https://maps.google.com/?q=${lat},${lng};

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
            key={${lat}-${lng}} // koordinata o'zgarsa qaytadan yuklanadi
            src={yandexEmbedUrl}
            className="w-full h-full border-0 min-h-[400px]"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* Footer — tugmalar */}
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
📂 FAYL 3: src/app/api/appointments/[id]/live/route.ts (yangi)
Modal har 15 sek shu endpoint'ni chaqiradi. Yengil — faqat live maydonlarini qaytaradi (butun appointment emas).
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      select: {
        liveLat: true,
        liveLng: true,
        liveLastUpdatedAt: true,
        liveStatus: true,
        liveExpiresAt: true,
      },
    });

    if (!appointment) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Server tomondan auto-expire — agar muddati tugagan bo'lsa 'expired' belgilaymiz
    if (
      appointment.liveStatus === 'active' &&
      appointment.liveExpiresAt &&
      appointment.liveExpiresAt < new Date()
    ) {
      await prisma.appointment.update({
        where: { id },
        data: { liveStatus: 'expired' },
      });
      return NextResponse.json({
        liveLat: appointment.liveLat,
        liveLng: appointment.liveLng,
        liveLastUpdatedAt: appointment.liveLastUpdatedAt,
        liveStatus: 'expired',
      });
    }

    return NextResponse.json(appointment);
  } catch (err) {
    console.error('[/api/appointments/[id]/live] error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
⚠️ Eslatma: Yo'l src/app/api/appointments/[id]/live/route.ts. Agar [id]/route.ts mavjud bo'lsa TEGMAYDI — bu yangi alohida endpoint.
📂 FAYL 4: Doktor va qabulxona panelida integratsiya (mavjud fayllar)
Bu bitta qator import + bitta JSX qator har bir panelda. Mavjud LocationButtons o'z holicha qoladi.
Doktor paneli (AppointmentCard komponenti yoki shunga o'xshash)
import LiveLocationPanel from '@/components/LiveLocationPanel'; // ← yangi import

// JSX ichida — LocationButtons yonida (lekin alohida):
<LocationButtons 
  locationLat={appointment.locationLat}
  locationLng={appointment.locationLng}
  address={appointment.address}
/>

{/* ⬇️ YANGI — faqat live aktiv bo'lsa render qilinadi */}
<LiveLocationPanel
  appointmentId={appointment.id}
  patientName={appointment.patientName}
  liveLat={appointment.liveLat}
  liveLng={appointment.liveLng}
  liveStartedAt={appointment.liveStartedAt}
  liveExpiresAt={appointment.liveExpiresAt}
  liveLastUpdatedAt={appointment.liveLastUpdatedAt}
  liveStatus={appointment.liveStatus}
/>
Qabulxona paneli (table row)
Xuddi shu — LocationButtons yonida LiveLocationPanel qo'shing. Mavjud table row va LocationButtons o'zgarmaydi.
⚠️ Tip safety: TypeScript xato beradi agar liveLat va h.k. null | undefined bo'lsa. LiveLocationPanel ichida if (liveStatus !== 'active') return null shartni o'tib bo'lmagani uchun, props level'ida tekshirish ham kerak. Eng oson yo'l:
{appointment.liveStatus === 'active' && 
 appointment.liveLat != null && 
 appointment.liveLng != null && (
  <LiveLocationPanel
    appointmentId={appointment.id}
    patientName={appointment.patientName}
    liveLat={appointment.liveLat}
    liveLng={appointment.liveLng}
    liveStartedAt={appointment.liveStartedAt!}
    liveExpiresAt={appointment.liveExpiresAt!}
    liveLastUpdatedAt={appointment.liveLastUpdatedAt!}
    liveStatus={appointment.liveStatus}
  />
)}
📋 Yakuniy ish ro'yxati
Vazifa
Fayl
Status
1. LiveLocationPanel.tsx yangi fayl
src/components/
⏳ Siz
2. LiveMapModal.tsx yangi fayl
src/components/
⏳ Siz
3. live/route.ts yangi API endpoint
src/app/api/appointments/[id]/live/
⏳ Siz
4. Doktor panelida 1 satr import + JSX blok
mavjud fayl
⏳ Siz
5. Qabulxona panelida 1 satr import + JSX blok
mavjud fayl
⏳ Siz
6. git push
terminal
⏳ Siz
✅ Tekshirish — TEGILMAYDIGAN narsalar
Komponent
Tegamizmi?
LocationButtons.tsx
❌ TEGMAYDI
locationLinks.ts
❌ TEGMAYDI
Bot kodi (har qanday fayl)
❌ TEGMAYDI
DB sxema (Prisma model)
❌ TEGMAYDI
bigint-fix.ts
❌ TEGMAYDI
Mavjud /api/appointments endpoint
❌ TEGMAYDI
Doktor panelida boshqa qismlar
❌ TEGMAYDI
Qabulxona table'ning boshqa ustunlari
❌ TEGMAYDI
🧪 Test sxemasi (deploy bo'lgach)
Doktor sifatida login qiling
Aliyev vali bron'ini oching (uning live'i hali aktiv 07:19'dan boshlangan, 8 soatlik)
Ko'rishingiz kerak:
Mavjud Yandex/2GIS/Google tugmalari (tegmaydi)
Pastida 🟢 JONLI JOYLASHUV AKTIV yashil pulsatsion belgi
"Hozirgina yangilandi"
"Qolgan vaqt: 7 soat XX daqiqa"
"🗺️ Jonli xaritani ochish" tugmasi
Tugmani bosing → modal ochiladi
Modal ichida Yandex xarita ko'rinadi (Aliyev valining hozirgi joyi)
15 sekund kutib turing → konsolda yangi /live so'rov ko'rinadi
ESC bosing → modal yopiladi
❓ Yordam kerak bo'lsa
AppointmentCard qaysi faylda ekanligini topishda:
findstr /S /I /N "LocationButtons" src\app\*.tsx src\components\*.tsx
Topgan natijani yuboring — men aniq fayl + qator ko'rsataman.
Boshlang VS Code'da. Tayyor bo'lgach "qildim" deysiz — Vercel deploy va DB'ni tekshiraman.