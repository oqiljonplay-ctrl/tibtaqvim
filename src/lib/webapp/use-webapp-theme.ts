"use client";
import { useCallback, useEffect, useState } from "react";

const KEY = "tibtaqvim_webapp_theme";
export type ThemeMode = "auto" | "light" | "dark";
export type Effective = "light" | "dark";

function detectScheme(): Effective {
  if (typeof window === "undefined") return "light";
  const tg = (window as unknown as { Telegram?: { WebApp?: { colorScheme?: string } } }).Telegram?.WebApp;
  if (tg?.colorScheme === "dark" || tg?.colorScheme === "light") return tg.colorScheme;
  const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
  return mq?.matches ? "dark" : "light";
}

function resolve(mode: ThemeMode): Effective {
  return mode === "auto" ? detectScheme() : mode;
}

function applyAttr(eff: Effective) {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-webapp-theme", eff);
  }
}

export function useWebAppTheme() {
  const [mode, setModeState] = useState<ThemeMode>("auto");
  const [effective, setEffective] = useState<Effective>("light");

  useEffect(() => {
    let m: ThemeMode = "auto";
    try {
      const s = localStorage.getItem(KEY);
      if (s === "auto" || s === "light" || s === "dark") m = s;
    } catch { /* localStorage bloklangan */ }
    setModeState(m);
    const eff = resolve(m);
    setEffective(eff);
    applyAttr(eff);
  }, []);

  useEffect(() => {
    if (mode !== "auto") return;
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const tg = (window as unknown as { Telegram?: { WebApp?: { onEvent?: (e: string, cb: () => void) => void; offEvent?: (e: string, cb: () => void) => void } } }).Telegram?.WebApp;
    const onChange = () => { const eff = resolve("auto"); setEffective(eff); applyAttr(eff); };
    mq?.addEventListener?.("change", onChange);
    tg?.onEvent?.("themeChanged", onChange);
    return () => {
      mq?.removeEventListener?.("change", onChange);
      tg?.offEvent?.("themeChanged", onChange);
    };
  }, [mode]);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    try { localStorage.setItem(KEY, m); } catch {}
    const eff = resolve(m);
    setEffective(eff);
    applyAttr(eff);
  }, []);

  return { mode, effective, setMode };
}
