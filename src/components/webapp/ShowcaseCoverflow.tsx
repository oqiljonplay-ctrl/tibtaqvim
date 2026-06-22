"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ShowcaseMediaRenderer } from "@/components/webapp/ShowcaseMediaRenderer";
import { useReducedMotion } from "@/lib/webapp/use-reduced-motion";
import {
  type ShowcaseMedia,
  type ShowcaseSize,
  SHOWCASE_SIZE_PX,
  showcaseAspectRatio,
} from "@/lib/showcase/types";

const BASE_SCALE_DROP = 0.18;
const BASE_ROTATE = 14;
const BASE_OPACITY_DROP = 0.35;
const INTENSITY_GAIN = 1.8; // intensity=1 → kuchli 3D (default 0.55 ≈ hozirgi)
const WIDTH_CAP_RATIO = 0.92;

export function ShowcaseCoverflow({
  media,
  size,
  intensity = 0.55,
}: {
  media: ShowcaseMedia[];
  size: ShowcaseSize;
  intensity?: number; // 0..1
}) {
  const reduced = useReducedMotion();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rafRef = useRef<number | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [maxW, setMaxW] = useState(0);

  // intensity ni ref orqali — applyTransforms identifikatori barqaror, drag'da re-center yo'q
  const intensityRef = useRef(intensity);
  intensityRef.current = intensity;

  const H = SHOWCASE_SIZE_PX[size];
  const single = media.length === 1;

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const measure = () => setMaxW(el.clientWidth);
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener("resize", measure);
    return () => { ro?.disconnect(); window.removeEventListener("resize", measure); };
  }, []);

  const dims = useCallback(
    (m: ShowcaseMedia): { w: number; h: number } => {
      const ratio = showcaseAspectRatio(m);
      let w = Math.round(H * ratio);
      let h = H;
      const cap = maxW ? Math.round(maxW * WIDTH_CAP_RATIO) : Infinity;
      if (w > cap) { w = cap; h = Math.round(cap / ratio); }
      return { w, h };
    },
    [H, maxW]
  );

  const applyTransforms = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const center = scroller.scrollLeft + scroller.clientWidth / 2;
    const k = Math.max(0, Math.min(1, intensityRef.current)) * INTENSITY_GAIN;
    let nearest = 0;
    let nearestDist = Infinity;

    itemRefs.current.forEach((el, i) => {
      if (!el) return;
      const itemCenter = el.offsetLeft + el.offsetWidth / 2;
      const w = el.offsetWidth || 1;
      const dist = (itemCenter - center) / w;
      const adist = Math.min(Math.abs(dist), 1.5);
      if (Math.abs(dist) < nearestDist) { nearestDist = Math.abs(dist); nearest = i; }

      const inner = el.firstElementChild as HTMLElement | null;
      if (!inner) return;
      if (reduced || k === 0) {
        inner.style.transform = "";
        inner.style.opacity = "1";
        inner.style.willChange = "";
        return;
      }
      const clamped = Math.max(-1, Math.min(1, dist));
      const scale = 1 - Math.min(adist, 1) * BASE_SCALE_DROP * k;
      const rotateY = -clamped * BASE_ROTATE * k;
      const opacity = 1 - Math.min(adist, 1) * BASE_OPACITY_DROP * k;
      inner.style.transform = `scale(${scale.toFixed(3)}) rotateY(${rotateY.toFixed(1)}deg)`;
      inner.style.opacity = opacity.toFixed(3);
      inner.style.willChange = adist < 1.2 ? "transform" : "";
    });

    setActiveIdx((p) => (p !== nearest ? nearest : p));
  }, [reduced]);

  const onScroll = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => { rafRef.current = null; applyTransforms(); });
  }, [applyTransforms]);

  const centerOn = useCallback((i: number, smooth: boolean) => {
    const el = itemRefs.current[i];
    const sc = scrollerRef.current;
    if (!el || !sc) return;
    const target = el.offsetLeft + el.offsetWidth / 2 - sc.clientWidth / 2;
    if (smooth) sc.scrollTo({ left: target, behavior: "smooth" });
    else sc.scrollLeft = target;
  }, []);

  // Re-center: faqat o'lcham/media/kenglik o'zgarsa (intensity'ga BOG'LIQ EMAS)
  useLayoutEffect(() => {
    if (!single) centerOn(0, false);
    applyTransforms();
  }, [applyTransforms, centerOn, size, media.length, maxW, single]);

  // Slider o'zgarsa: faqat transformlarni qayta qo'llash (re-center YO'Q → scroll sakramaydi)
  useEffect(() => { applyTransforms(); }, [intensity, applyTransforms]);

  useEffect(() => () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); }, []);

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="flex items-center gap-3 overflow-x-auto scrollbar-hide"
        style={{
          scrollSnapType: single ? "none" : "x mandatory",
          touchAction: "pan-x pan-y",
          overflowY: "hidden",
          overscrollBehaviorX: "contain",
          perspective: "1000px",
          paddingLeft: single ? 0 : "50%",
          paddingRight: single ? 0 : "50%",
          height: H,
          WebkitOverflowScrolling: "touch",
        }}
      >
        {media.map((m, i) => {
          const { w, h } = dims(m);
          return (
            <div
              key={m.id}
              ref={(el) => { itemRefs.current[i] = el; }}
              className="flex-shrink-0 flex items-center justify-center"
              style={{ width: w, height: H, scrollSnapAlign: "center" }}
            >
              <div
                className="w-full"
                style={{
                  height: h,
                  transition: reduced ? undefined : "transform 0.25s ease, opacity 0.25s ease",
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                  contain: "layout style paint",
                }}
              >
                <ShowcaseMediaRenderer media={m} fill active={i === activeIdx} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-1.5 text-center min-h-[18px]" aria-live="polite">
        {(() => {
          const m = media[activeIdx];
          const label = m?.title || m?.caption;
          return label ? <span className="text-sm text-gray-600">{label}</span> : null;
        })()}
      </div>

      {!single && media.length > 1 && (
        <div className="mt-1 flex items-center justify-center gap-1.5" role="tablist" aria-label="Media pozitsiyasi">
          {media.map((m, i) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={i === activeIdx}
              aria-label={`${i + 1}-media`}
              onClick={() => centerOn(i, true)}
              className={`h-1.5 rounded-full transition-all ${i === activeIdx ? "w-4 bg-blue-600" : "w-1.5 bg-gray-300"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
