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

const ROTATE = 34;          // 3D burilish kuchaytirildi
const SCALE_DROP = 0.21;    // yon kartalar ozgina kichikroq → chuqurlik
const TRANSLATE_Z = 135;    // orqaga ko'proq surilish
const OPACITY_DROP = 0.40;  // yon kartalar ozgina xiraroq → chuqurlik
const WIDTH_CAP_RATIO = 0.98;

export function ShowcaseCoverflow({
  media,
  size,
  intensity = 0.5,
  intensityExplicit = false,
}: {
  media: ShowcaseMedia[];
  size: ShowcaseSize;
  intensity?: number;
  intensityExplicit?: boolean;
}) {
  const reduced = useReducedMotion();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rafRef = useRef<number | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [maxW, setMaxW] = useState(0);
  const activeIdxRef = useRef(0);
  const draggingRef = useRef(false);   // drag faol — onScroll'ni qulflaydi
  const animatingRef = useRef(false);  // rAF settle faol — onScroll'ni qulflaydi
  const animRafRef = useRef<number | null>(null);
  const idleRef = useRef<number | null>(null); // desktop scroll-idle snap

  const intensityRef = useRef(intensity);
  intensityRef.current = intensity;
  const explicitRef = useRef(intensityExplicit);
  explicitRef.current = intensityExplicit;

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

  // 1. applyTransforms — scrollLeft dan o'qib, har elementga inline style beradi
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

      const flat = k === 0 || (reduced && !explicitRef.current);
      if (flat) {
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
      el.style.transform = `perspective(1100px) rotateY(${rot.toFixed(1)}deg) translateZ(${tz.toFixed(1)}px) scale(${scale.toFixed(3)})`;
      el.style.opacity = opacity.toFixed(3);
      el.style.zIndex = String(100 - Math.round(ad * 20));
    });

    setActiveIdx((p) => {
      if (p !== nearest) activeIdxRef.current = nearest;
      return p !== nearest ? nearest : p;
    });
  }, [reduced]);

  // 2. animateTo — 0.5s easeOutQuart rAF settle, scrollTo o'rniga
  const animateTo = useCallback((i: number) => {
    const sc = scrollerRef.current;
    const el = itemRefs.current[i];
    if (!sc || !el) return;
    if (animRafRef.current != null) { cancelAnimationFrame(animRafRef.current); animRafRef.current = null; }

    const from = sc.scrollLeft;
    const to = el.offsetLeft + el.offsetWidth / 2 - sc.clientWidth / 2;
    const dist = to - from;

    if (Math.abs(dist) < 0.5) {
      sc.scrollLeft = to;
      applyTransforms();
      animatingRef.current = false;
      activeIdxRef.current = i;
      setActiveIdx(i);
      return;
    }

    const DURATION = 500; // 0.5s — SAQLANDI
    const t0 = performance.now();
    animatingRef.current = true;

    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / DURATION);
      const e = 1 - Math.pow(1 - t, 4); // easeOutQuart — silliqlik kuchaytirildi
      sc.scrollLeft = from + dist * e;
      applyTransforms();
      if (t < 1) {
        animRafRef.current = requestAnimationFrame(step);
      } else {
        animRafRef.current = null;
        animatingRef.current = false;
        activeIdxRef.current = i;
        setActiveIdx(i);
      }
    };
    animRafRef.current = requestAnimationFrame(step);
  }, [applyTransforms]);

  // 3. onScroll — drag/animating paytida o'tkazib yuboriladi; desktop idle snap
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onScroll = useCallback(() => {
    if (draggingRef.current || animatingRef.current) return;
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => { rafRef.current = null; applyTransforms(); });
    if (idleRef.current != null) clearTimeout(idleRef.current);
    idleRef.current = window.setTimeout(() => {
      if (draggingRef.current || animatingRef.current) return;
      animateTo(activeIdxRef.current);
    }, 140);
  }, [applyTransforms]); // animateTo dep'ga qo'shilmaydi — loop oldini olish uchun

  // 4. centerOn — smooth yo'li animateTo ga, instant yo'li to'g'ridan-to'g'ri
  const centerOn = useCallback((i: number, smooth: boolean) => {
    const el = itemRefs.current[i];
    const sc = scrollerRef.current;
    if (!el || !sc) return;
    if (smooth) { animateTo(i); return; }
    const target = el.offsetLeft + el.offsetWidth / 2 - sc.clientWidth / 2;
    sc.scrollLeft = target;
    applyTransforms();
    activeIdxRef.current = i;
    setActiveIdx(i);
  }, [animateTo, applyTransforms]);

  // Re-center: o'lcham/media/kenglik o'zgarsa (intensity'ga BOG'LIQ EMAS)
  useLayoutEffect(() => {
    if (!single) centerOn(0, false);
    applyTransforms();
  }, [applyTransforms, centerOn, size, media.length, maxW, single]);

  // Slider o'zgarsa: faqat transformlarni qayta qo'llash (re-center YO'Q)
  useEffect(() => { applyTransforms(); }, [intensity, intensityExplicit, applyTransforms]);

  // Cleanup: barcha rAF va timeout
  useEffect(() => () => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    if (animRafRef.current != null) cancelAnimationFrame(animRafRef.current);
    if (idleRef.current != null) clearTimeout(idleRef.current);
  }, []);

  // 5. Touch handlerlari — qat'iy ±1, startIdx touchstart da qullflangan
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    let startX = 0, startY = 0, startScroll = 0, startIdx = 0;
    let lowBound = 0, highBound = 0;
    let isHoriz: boolean | null = null;

    const scrollForIdx = (i: number) => {
      const it = itemRefs.current[i];
      if (!it) return el.scrollLeft;
      return it.offsetLeft + it.offsetWidth / 2 - el.clientWidth / 2;
    };

    const onStart = (e: TouchEvent) => {
      if (animRafRef.current != null) { cancelAnimationFrame(animRafRef.current); animRafRef.current = null; }
      animatingRef.current = false;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startScroll = el.scrollLeft;
      startIdx = activeIdxRef.current; // ← QULFLANDI (settle/drag drift'iga tegmaydi)
      const minus = scrollForIdx(Math.max(0, startIdx - 1));
      const plus  = scrollForIdx(Math.min(media.length - 1, startIdx + 1));
      lowBound = Math.min(minus, plus);
      highBound = Math.max(minus, plus);
      isHoriz = null;
    };

    const onMove = (e: TouchEvent) => {
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (isHoriz === null) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return; // mayda titrashga reaksiya yo'q
        isHoriz = Math.abs(dx) > Math.abs(dy);
      }
      if (!isHoriz) return; // vertikal — sahifa scroll'iga tegmaydi
      e.preventDefault();
      draggingRef.current = true;

      let target = startScroll - dx;
      // Rubber-band: startIdx∓1 chegarasidan tashqariga chiqmasin
      if (target < lowBound) target = lowBound - (lowBound - target) / 3;
      else if (target > highBound) target = highBound + (target - highBound) / 3;

      el.scrollLeft = target;
      applyTransforms(); // sinkron; onScroll guard tufayli ikkilanmaydi
    };

    const onEnd = (e: TouchEvent) => {
      const wasDragging = draggingRef.current;
      draggingRef.current = false;
      if (!isHoriz || !wasDragging) { isHoriz = null; return; }

      const dx = e.changedTouches[0].clientX - startX;
      let next = startIdx; // ← qulflangan startIdx'dan, JONLI holatdan EMAS
      if (Math.abs(dx) >= 25) {
        const dir = dx < 0 ? 1 : -1;
        next = Math.max(0, Math.min(media.length - 1, startIdx + dir)); // QAT'IY ±1
      }
      isHoriz = null;
      animateTo(next); // 0.5s glide markazgacha
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [animateTo, applyTransforms, media.length]);

  // Aniq markazlash uchun chet elementlar kengligi
  const firstW = media.length ? dims(media[0]).w : 0;
  const lastW = media.length ? dims(media[media.length - 1]).w : 0;

  return (
    <div className="relative">
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="flex items-center gap-2 overflow-x-auto scrollbar-hide"
        style={{
          scrollSnapType: "none",            // snap to'liq JS'da — native bilan kurashmaydi
          touchAction: "pan-y",              // gorizontalni biz boshqaramiz, vertikalni browser
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
                transition: "none",               // JS har frame'da boshqaradi — CSS transition qaltirash beradi
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
