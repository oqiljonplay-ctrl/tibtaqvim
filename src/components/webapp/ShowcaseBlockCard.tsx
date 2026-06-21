"use client";

import { ShowcaseCoverflow } from "@/components/webapp/ShowcaseCoverflow";
import { ShowcaseMediaRenderer } from "@/components/webapp/ShowcaseMediaRenderer";
import { type ShowcaseBlock, type ShowcaseSize, isGalleryKind } from "@/lib/showcase/types";

function ShowcaseRatingStars({ value }: { value: number }) {
  const v = Math.max(0, Math.min(5, value));
  return (
    <span className="inline-flex items-center" aria-label={`Reyting ${v.toFixed(1)} / 5`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, v - i));
        return (
          <span key={i} className="relative inline-block w-4 h-4">
            <svg viewBox="0 0 24 24" className="absolute inset-0 w-4 h-4" fill="#E5E7EB" aria-hidden="true">
              <path d="M12 17.27l5.18 3.04-1.37-5.88 4.55-3.94-6-.51L12 4l-2.36 5.97-6 .51 4.55 3.94-1.37 5.88z" />
            </svg>
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="#F59E0B" aria-hidden="true">
                <path d="M12 17.27l5.18 3.04-1.37-5.88 4.55-3.94-6-.51L12 4l-2.36 5.97-6 .51 4.55 3.94-1.37 5.88z" />
              </svg>
            </span>
          </span>
        );
      })}
    </span>
  );
}

function getTgid(): string | null {
  if (typeof window === "undefined") return null;
  try { return sessionStorage.getItem("tgid"); } catch { return null; }
}

export function ShowcaseBlockCard({
  block,
  clinicId,
  size,
}: {
  block: ShowcaseBlock;
  clinicId: string;
  size: ShowcaseSize;
}) {
  const gallery = block.media.filter((m) => isGalleryKind(m.kind));
  const rest = block.media.filter((m) => !isGalleryKind(m.kind));

  const onBook = () => {
    const tgid = getTgid();
    if (block.cta === "auto" && block.serviceId) {
      const qs = new URLSearchParams({
        clinic: clinicId,
        mode: "booking",
        serviceId: block.serviceId,
      });
      if (tgid) qs.set("tgid", tgid);
      window.location.href = `/webapp?${qs.toString()}`;
    } else {
      window.location.href = `/webapp/clinics/${clinicId}`;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-3">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-gray-900 truncate">{block.title}</h3>
          {block.subtitle && (
            <p className="text-sm text-gray-500 mt-0.5 truncate">{block.subtitle}</p>
          )}
        </div>
        {block.rating && (
          <div className="shrink-0">
            {block.rating.count > 0 ? (
              <div className="flex items-center gap-1">
                <ShowcaseRatingStars value={block.rating.value} />
                <span className="text-xs text-gray-400">({block.rating.count} baho)</span>
              </div>
            ) : (
              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                Yangi
              </span>
            )}
          </div>
        )}
      </div>

      {/* Gallereya — coverflow (image/gif/youtube/video) */}
      {gallery.length > 0 && (
        <div className="mb-3">
          <ShowcaseCoverflow media={gallery} size={size} />
        </div>
      )}

      {/* Qolgan media (telegram/pdf/audio) — vertikal stack */}
      {rest.length > 0 && (
        <div className="flex flex-col gap-3 mb-3">
          {rest.map((m) => (
            <ShowcaseMediaRenderer key={m.id} media={m} />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onBook}
        className="w-full min-h-[44px] rounded-xl bg-blue-600 text-white text-sm font-medium active:bg-blue-700 transition-colors"
      >
        Band qilish
      </button>
    </div>
  );
}
