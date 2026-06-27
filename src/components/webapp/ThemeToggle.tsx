"use client";
import { useState } from "react";
import { useThemeCtx } from "@/components/webapp/WebAppThemeProvider";

const OPTS = [
  { k: "auto" as const, icon: "🖥️", label: "Avto" },
  { k: "light" as const, icon: "🌞", label: "Kun" },
  { k: "dark" as const, icon: "🌘", label: "Tun" },
];

export function ThemeToggle() {
  const { mode, effective, setMode } = useThemeCtx();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Mavzu"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-sm leading-none"
      >
        {effective === "dark" ? "🌘" : "🌞"}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
          <div
            className="absolute right-0 top-9 z-50 rounded-xl p-1 flex flex-col min-w-[124px]"
            style={{ background: "var(--elevated)", border: "1px solid var(--border)", boxShadow: "0 10px 30px -12px rgba(0,0,0,.5)" }}
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
        </>
      )}
    </div>
  );
}
