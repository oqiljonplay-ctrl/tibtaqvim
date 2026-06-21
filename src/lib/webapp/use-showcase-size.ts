"use client";
import { useCallback, useEffect, useState } from "react";
import {
  type ShowcaseSize,
  SHOWCASE_SIZE_DEFAULT,
  SHOWCASE_SIZE_KEY,
} from "@/lib/showcase/types";

/** S/M/L/XL — qurilmada localStorage'da saqlanadi. */
export function useShowcaseSize(): [ShowcaseSize, (s: ShowcaseSize) => void] {
  const [size, setSize] = useState<ShowcaseSize>(SHOWCASE_SIZE_DEFAULT);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(SHOWCASE_SIZE_KEY) as ShowcaseSize | null;
      if (saved === "S" || saved === "M" || saved === "L" || saved === "XL") {
        setSize(saved);
      }
    } catch {
      /* localStorage bloklangan — default qoladi */
    }
  }, []);

  const update = useCallback((s: ShowcaseSize) => {
    setSize(s);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(SHOWCASE_SIZE_KEY, s);
      } catch {
        /* yozib bo'lmadi — render baribir o'zgaradi */
      }
    }
  }, []);

  return [size, update];
}
