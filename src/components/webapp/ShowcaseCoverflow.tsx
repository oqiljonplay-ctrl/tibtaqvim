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

const ROTATE = 28;       // prototip
const SCALE_DROP = 0.18;
const TRANSLATE_Z = 110;
const OPACITY_DROP = 0.36;
const WIDTH_CAP_RATIO = 0.98;

export function ShowcaseCoverflow({
  media,
  size,
  intensity = 0.5,
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
    const k = Math.max(0, Math.min(1, intensityRef.current));
    let nearest = 0;
    let nearestDist = Infinity;

    itemRefs.current.forEach((el, i) => {
      if (!el) return;
      const itemCenter = el.offsetLeft + el.offsetWidth / 2;
      const w = el.offsetWidth || 1;
      const dist = (itemCenter - center) / w;
      const ad = Math.min(Math.abs(dist), 2);
      if (Math.abs(dist) < nearestDist) { nearestDist = Math.abs(dist); nearest = i; }

      if (reduced || k === 0) {
        el.style.transform = "";
        el.style.opacity = "1";
        el.style.zIndex = "0";
        return;
      }
      const clamped = Math.max(-2, Math.min(2, dist));
      const rot = -clamped * ROTATE * k;
      const scale = 1 - Math.min(ad, 1) * SCALE_DROP * k;
      const tz = -ad * TRANSLATE_Z * k;
      const opacity = 1 - Math.min(ad, 1) * OPACITY_DROP;
      el.style.transform = `perspective(1150px) rotateY(${rot.toFixed(1)}deg) translateZ(${tz.toFixed(1)}px) scale(${scale.toFixed(3)})`;
      el.style.opacity = opacity.toFixed(3);
      el.style.zIndex = String(100 - Math.round(ad * 20));
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

  // Re-center: o'lcham/media/kenglik o'zgarsa (intensity'ga BOG'LIQ EMAS)
  useLayoutEffect(() => {
    if (!single) centerOn(0, false);
    applyTransforms();
  }, [applyTransforms, centerOn, size, media.length, maxW, single]);

  // Slider o'zgarsa: faqat transformlarni qayta qo'llash (re-center YO'Q)
  useEffect(() => { applyTransforms(); }, [intensity, applyTransforms]);

  useEffect(() => () => { if (rafRef.current != null) cancelAnimationFrame(rafRef.current); }, []);

  // Aniq markazlash uchun chet elementlar kengligi (FIX 1)
  const firstW = media.length ? dims(media[0]).w : 0;
  const lastW = media.length ? dims(media[media.length - 1]).w : 0;

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="flex items-center gap-2 overflow-x-auto scrollbar-hide"
        style={{
          scrollSnapType: single ? "none" : "x mandatory",
          touchAction: "pan-x pan-y",
          overflowY: "hidden",
          overscrollBehaviorX: "contain",
          paddingLeft: `calc(50% - ${firstW / 2}px)`,
          paddingRight: `calc(50% - ${lastW / 2}px)`,
          height: H + 8,
          WebkitOverflowScrolling: "touch",
        }}
      >
        {media.map((m, i) => {
          const { w, h } = dims(m);
          const circle = m.shape === "circle";
          return (
            <div
              key={m.id}
              ref={(el) => { itemRefs.current[i] = el; }}
              className="flex-shrink-0 flex items-center justify-center"
              style={{
                width: w,
                height: H,
                scrollSnapAlign: "center",
                transition: reduced ? undefined : "transform 0.25s ease, opacity 0.25s ease",
                willChange: "transform, opacity",
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
              }}
            >
              <div className="relative w-full" style={{ height: h }}>
                {/* media — box'ni to'ldiradi */}
                <div className={`relative w-full h-full ${circle ? "" : "rounded-xl overflow-hidden"}`}>
                  <ShowcaseMediaRenderer media={m} fill active={i === activeIdx} />

                  {/* MEDIA ICHIDA MATN — doira'dan tashqari (prototipdan) */}
                  {!circle && m.title && (
                    <div className="absolute inset-x-0 top-0 px-2 pt-1.5 pb-4 bg-gradient-to-b from-black/55 to-transparent pointer-events-none">
                      <span className="block text-white text-xs font-semibold leading-tight line-clamp-2" style={{ textShadow: "0 1px 4px rgba(0,0,0,.6)" }}>
                        {m.title}
                      </span>
                    </div>
                  )}
                  {!circle && m.caption && (
                    <div className="absolute inset-x-0 bottom-0 px-2 pb-1.5 pt-5 bg-gradient-to-t from-black/65 to-transparent pointer-events-none">
                      <span className="block text-white text-[11px] leading-snug line-clamp-2" style={{ textShadow: "0 1px 4px rgba(0,0,0,.6)" }}>
                        {m.caption}
                      </span>
                    </div>
                  )}
                </div>

                {/* DOIRA: matn shakldan tashqarida (kichik, pastda) */}
                {circle && m.title && (
                  <div className="mt-1 text-center text-[11px] text-gray-500 leading-tight line-clamp-1">
                    {m.title}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pozitsiya indikatori (nuqtalar) */}
      {!single && media.length > 1 && (
        <div className="mt-1.5 flex items-center justify-center gap-1.5" role="tablist" aria-label="Media pozitsiyasi">
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
