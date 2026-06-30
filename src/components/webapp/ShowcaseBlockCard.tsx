"use client";

import { useRouter } from "next/navigation";
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
          <span key={i} className="relative inline-block w-3.5 h-3.5">
            <svg viewBox="0 0 24 24" className="absolute inset-0 w-3.5 h-3.5" style={{ fill: "var(--border)" }} aria-hidden="true">
              <path d="M12 17.27l5.18 3.04-1.37-5.88 4.55-3.94-6-.51L12 4l-2.36 5.97-6 .51 4.55 3.94-1.37 5.88z" />
            </svg>
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" style={{ fill: "var(--star)" }} aria-hidden="true">
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
  intensity,
  intensityExplicit,
}: {
  block: ShowcaseBlock;
  clinicId: string;
  size: ShowcaseSize;
  intensity: number;
  intensityExplicit: boolean;
}) {
  const router = useRouter();
  const gallery = block.media.filter((m) => isGalleryKind(m.kind));
  const rest = block.media.filter((m) => !isGalleryKind(m.kind));

  // FIX 3: subtitle faqat em-source bloklarda (mutaxassislik). service/manual — yashiriladi
  const showSubtitle = block.source === "em" && !!block.subtitle;

  const onBook = () => {
    const tgid = getTgid();
    if (block.cta === "auto" && block.serviceId) {
      // Xizmat oldindan tanlangan — to'g'ridan booking
      const qs = new URLSearchParams({ clinic: clinicId, mode: "booking", serviceId: block.serviceId });
      if (tgid) qs.set("tgid", tgid);
      window.location.href = `/webapp?${qs.toString()}`;
    } else {
      router.push(`/webapp/clinics/${clinicId}?intent=booking`);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 mb-2">
      {/* HEADER: [Ism+mutaxassislik] · [baho + Band qilish] */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-gray-900 truncate">{block.title}</h3>
          {showSubtitle && (
            <p className="text-xs text-gray-500 truncate">{block.subtitle}</p>
          )}
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {block.rating && (
            <span className="flex items-center gap-0.5">
              <ShowcaseRatingStars value={block.rating.value} />
              {block.rating.count > 0 && (
                <span className="text-[10px] text-gray-400">({block.rating.count})</span>
              )}
            </span>
          )}
          {block.cta !== "none" && (
            <button
              type="button"
              onClick={onBook}
              className="shrink-0 inline-flex items-center justify-center bg-blue-600 text-white text-xs font-medium px-3 py-1.5 rounded-full active:bg-blue-700 transition-colors"
            >
              Band qilish
            </button>
          )}
        </div>
      </div>

      {/* Gallereya — coverflow (matn media ichida) */}
      {gallery.length > 0 && (
        <div className="mb-1">
          <ShowcaseCoverflow media={gallery} size={size} intensity={intensity} intensityExplicit={intensityExplicit} />
        </div>
      )}

      {/* Telegram/pdf/audio — vertikal stack */}
      {rest.length > 0 && (
        <div className="flex flex-col gap-2">
          {rest.map((m) => (
            <ShowcaseMediaRenderer key={m.id} media={m} />
          ))}
        </div>
      )}
    </div>
  );
}
