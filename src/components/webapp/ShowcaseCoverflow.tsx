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

const MAX_SCALE_DROP = 0.18;   // markaz 1.0 → chet 0.82
const MAX_ROTATE = 14;         // deg
const MAX_OPACITY_DROP = 0.35; // markaz 1.0 → chet 0.65

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

  const H = SHOWCASE_SIZE_PX[size];

  // Har elementga 3D transform berish (markazdan masofaga qarab)
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

    setActiveIdx((prev) => (prev !== nearest ? nearest : prev));
  }, [reduced]);

  const onScroll = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      applyTransforms();
    });
  }, [applyTransforms]);

  useLayoutEffect(() => {
    applyTransforms();
  }, [applyTransforms, size, media.length]);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const single = media.length === 1;

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="flex gap-3 overflow-x-auto scrollbar-hide"
        style={{
          scrollSnapType: single ? "none" : "x mandatory",
          touchAction: "pan-x",
          perspective: "1000px",
          paddingLeft: single ? 0 : "20%",
          paddingRight: single ? 0 : "20%",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {media.map((m, i) => {
          const ratio = showcaseAspectRatio(m);
          const W = Math.round(H * ratio);
          return (
            <div
              key={m.id}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              className="flex-shrink-0"
              style={{ width: W, height: H, scrollSnapAlign: "center" }}
            >
              {/* inner — 3D transform shu div ga beriladi */}
              <div
                className="h-full w-full"
                style={{
                  transition: reduced
                    ? undefined
                    : "transform 0.25s ease, opacity 0.25s ease",
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

      {/* Markazdagi element sarlavha/izohi — fade */}
      <div className="mt-2 text-center min-h-[20px]" aria-live="polite">
        {(() => {
          const m = media[activeIdx];
          if (!m) return null;
          const label = m.title || m.caption;
          if (!label) return null;
          return (
            <span
              key={m.id}
              className="text-sm text-gray-600 transition-opacity duration-300"
            >
              {label}
            </span>
          );
        })()}
      </div>
    </div>
  );
}
