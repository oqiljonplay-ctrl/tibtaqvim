"use client";
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useThemeCtx } from "@/components/webapp/WebAppThemeProvider";

const OPTS = [
  { k: "auto" as const, icon: "🖥️", label: "Avto" },
  { k: "light" as const, icon: "🌞", label: "Kun" },
  { k: "dark" as const, icon: "🌘", label: "Tun" },
];

export function ThemeToggle() {
  const { mode, effective, setMode } = useThemeCtx();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => { window.removeEventListener("scroll", close, true); window.removeEventListener("resize", close); };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label="Mavzu"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-sm leading-none"
      >
        {effective === "dark" ? "🌘" : "🌞"}
      </button>

      {open && pos && typeof document !== "undefined" &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[998]" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
            <div
              className="fixed z-[999] rounded-xl p-1 flex flex-col min-w-[128px]"
              style={{ top: pos.top, right: pos.right, background: "var(--elevated)", border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)" }}
            >
              {OPTS.map((o) => (
                <button
                  key={o.k}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setMode(o.k); setOpen(false); }}
                  className="px-3 py-2 rounded-lg text-sm font-semibold text-left flex items-center gap-2"
                  style={{ color: "var(--text)", background: mode === o.k ? "var(--surface)" : "transparent" }}
                >
                  <span>{o.icon}</span> {o.label}
                </button>
              ))}
            </div>
          </>,
          document.body
        )}
    </>
  );
}
