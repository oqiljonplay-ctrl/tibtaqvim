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

const MAX_SCALE_DROP = 0.18;    // markaz 1.0 → chet 0.82
const MAX_ROTATE = 14;          // deg
const MAX_OPACITY_DROP = 0.35;  // markaz 1.0 → chet 0.65
const WIDTH_CAP_RATIO = 0.92;   // element kengligi konteynerning 92%idan oshmaydi

export function ShowcaseCoverflow({
  media,
  size,
}: {
  media: ShowcaseMedia[];
  size: ShowcaseSize;
}) {
  const reduced = useReducedMotion();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rafRef = useRef<number | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [maxW, setMaxW] = useState(0);

  const H = SHOWCASE_SIZE_PX[size];
  const single = media.length === 1;

  // Konteyner kengligini o'lchash (overflow cheki uchun)
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const measure = () => setMaxW(el.clientWidth);
    measure();
    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // Element o'lchami: balandlik H, kenglik = H*aspect, lekin konteyner 92%idan oshmaydi
  const dims = useCallback(
    (m: ShowcaseMedia): { w: number; h: number } => {
      const ratio = showcaseAspectRatio(m);
      let w = Math.round(H * ratio);
      let h = H;
      const cap = maxW ? Math.round(maxW * WIDTH_CAP_RATIO) : Infinity;
      if (w > cap) {
        w = cap;
        h = Math.round(cap / ratio);
      }
      return { w, h };
    },
    [H, maxW]
  );

  const applyTransforms = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const center = scroller.scrollLeft + scroller.clientWidth / 2;
    let nearest = 0;
    let nearestDist = Infinity;

    itemRefs.current.forEach((el, i) => {
      if (!el) return;
      const itemCenter = el.offsetLeft + el.offsetWidth / 2;
      const w = el.offsetWidth || 1;
      const dist = (itemCenter - center) / w;
      const adist = Math.min(Math.abs(dist), 1.5);
      if (Math.abs(dist) < nearestDist) {
        nearestDist = Math.abs(dist);
        nearest = i;
      }
      const inner = el.firstElementChild as HTMLElement | null;
      if (!inner) return;
      if (reduced) {
        inner.style.transform = "";
        inner.style.opacity = "1";
        inner.style.willChange = "";
        return;
      }
      const clamped = Math.max(-1, Math.min(1, dist));
      const scale = 1 - Math.min(adist, 1) * MAX_SCALE_DROP;
      const rotateY = -clamped * MAX_ROTATE;
      const opacity = 1 - Math.min(adist, 1) * MAX_OPACITY_DROP;
      inner.style.transform = `scale(${scale.toFixed(3)}) rotateY(${rotateY.toFixed(1)}deg)`;
      inner.style.opacity = opacity.toFixed(3);
      inner.style.willChange = adist < 1.2 ? "transform" : "";
    });

    setActiveIdx((p) => (p !== nearest ? nearest : p));
  }, [reduced]);

  const onScroll = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      applyTransforms();
    });
  }, [applyTransforms]);

  const centerOn = useCallback((i: number, smooth: boolean) => {
    const el = itemRefs.current[i];
    const sc = scrollerRef.current;
    if (!el || !sc) return;
    const target = el.offsetLeft + el.offsetWidth / 2 - sc.clientWidth / 2;
    if (smooth) sc.scrollTo({ left: target, behavior: "smooth" });
    else sc.scrollLeft = target;
  }, []);

  // Mount / o'lcham / media o'zgarsa: item[0] ni markazga (instant) + transformlar
  useLayoutEffect(() => {
    if (!single) centerOn(0, false);
    applyTransforms();
  }, [applyTransforms, centerOn, size, media.length, maxW, single]);

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    },
    []
  );

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="flex items-center gap-3 overflow-x-auto scrollbar-hide"
        style={{
          scrollSnapType: single ? "none" : "x mandatory",
          touchAction: "pan-x pan-y",        // FIX 1: vertikal scroll parentga o'tadi
          overflowY: "hidden",               // FIX 1: vertikal o'qni egallamaydi → chain
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
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
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

      {/* Markazdagi element sarlavha/izohi */}
      <div className="mt-2 text-center min-h-[20px]" aria-live="polite">
        {(() => {
          const m = media[activeIdx];
          const label = m?.title || m?.caption;
          return label ? <span className="text-sm text-gray-600">{label}</span> : null;
        })()}
      </div>

      {/* FIX 3: pozitsiya indikatori (nuqtalar) */}
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
              className={`h-1.5 rounded-full transition-all ${
                i === activeIdx ? "w-4 bg-blue-600" : "w-1.5 bg-gray-300"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
