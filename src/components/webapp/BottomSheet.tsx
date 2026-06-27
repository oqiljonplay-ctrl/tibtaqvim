"use client";
import { useEffect, useRef, useState } from "react";

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  keepOpenRefs?: React.RefObject<HTMLElement | null>[];
  initialPct?: number;
  minPct?: number;
  maxPct?: number;
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  keepOpenRefs = [],
  initialPct = 50,
  minPct = 25,
  maxPct = 80,
}: BottomSheetProps) {
  const [pct, setPct] = useState(initialPct);
  const [dragging, setDragging] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    startY: number;
    startPct: number;
    lastY: number;
    lastT: number;
    v: number;
  } | null>(null);
  const prevOpen = useRef(false);

  // Ochilganda balandlikni initialPct ga reset
  useEffect(() => {
    if (open && !prevOpen.current) setPct(initialPct);
    prevOpen.current = open;
  }, [open, initialPct]);

  // Telegram vertikal-swipe konflikti — sheet ochiq paytda o'chiramiz
  useEffect(() => {
    const tg = (window as { Telegram?: { WebApp?: { isVersionAtLeast?: (v: string) => boolean; disableVerticalSwipes?: () => void; enableVerticalSwipes?: () => void } } }).Telegram?.WebApp;
    if (!tg) return;
    const supported = tg.isVersionAtLeast?.("7.7");
    if (open && supported) tg.disableVerticalSwipes?.();
    return () => {
      if (supported) tg.enableVerticalSwipes?.();
    };
  }, [open]);

  // Tashqi bosishni yutib yopish — faqat ochiq paytda
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (sheetRef.current?.contains(t)) return;
      if (keepOpenRefs.some((r) => r.current?.contains(t))) return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    document.addEventListener("click", onDocClick, true);
    return () => document.removeEventListener("click", onDocClick, true);
  }, [open, onClose, keepOpenRefs]);

  // Drag — FAQAT handle'da
  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = {
      startY: e.clientY,
      startPct: pct,
      lastY: e.clientY,
      lastT: performance.now(),
      v: 0,
    };
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const vh = window.innerHeight || 1;
    const now = performance.now();
    d.v = (d.lastY - e.clientY) / Math.max(1, now - d.lastT);
    d.lastY = e.clientY;
    d.lastT = now;
    const deltaPct = ((d.startY - e.clientY) / vh) * 100;
    setPct(clamp(d.startPct + deltaPct, 0, maxPct));
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d) return;
    if (pct < minPct || d.v < -0.6) {
      onClose();
      return;
    }
    setPct(clamp(pct, minPct, maxPct));
  };

  return (
    <div
      ref={sheetRef}
      className="fixed inset-x-0 bottom-0 z-50 mx-auto w-full max-w-md bg-white rounded-t-[28px] shadow-2xl flex flex-col"
      style={{
        height: `${pct}%`,
        transform: open ? "translateY(0)" : "translateY(100%)",
        transition: dragging ? "none" : "transform 260ms ease, height 200ms ease",
        pointerEvents: open ? "auto" : "none",
        touchAction: "none",
      }}
      aria-hidden={!open}
    >
      {/* Tortgich (handle) — resize faqat shu yerdan */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="shrink-0 pt-2 pb-3 flex flex-col items-center cursor-grab active:cursor-grabbing select-none"
        style={{ touchAction: "none" }}
      >
        <div className="w-10 h-1.5 rounded-full bg-gray-300" />
        {title && (
          <div className="mt-2 font-semibold text-gray-800 text-base">{title}</div>
        )}
      </div>

      {/* Kontent — mustaqil scroll */}
      <div
        className="flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(16px+env(safe-area-inset-bottom))]"
        style={{ touchAction: "pan-y", overscrollBehavior: "contain" }}
      >
        {children}
      </div>
    </div>
  );
}
