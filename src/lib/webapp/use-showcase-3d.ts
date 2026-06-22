"use client";
import { useCallback, useEffect, useState } from "react";

const KEY = "tibtaqvim_showcase_3d";
/** 0 = tekis 2D, 1 = maksimal 3D. Default ≈ hozirgi ko'rinish. */
const DEFAULT_3D = 0.55;

export function useShowcase3d(): [number, (v: number) => void] {
  const [v, setV] = useState(DEFAULT_3D);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const s = localStorage.getItem(KEY);
      if (s != null) {
        const n = parseFloat(s);
        if (!Number.isNaN(n)) setV(Math.max(0, Math.min(1, n)));
      }
    } catch {
      /* localStorage bloklangan */
    }
  }, []);

  const update = useCallback((n: number) => {
    const c = Math.max(0, Math.min(1, n));
    setV(c);
    if (typeof window !== "undefined") {
      try { localStorage.setItem(KEY, String(c)); } catch { /* yozilmadi */ }
    }
  }, []);

  return [v, update];
}
