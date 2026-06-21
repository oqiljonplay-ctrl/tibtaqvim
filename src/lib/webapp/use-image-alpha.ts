"use client";
import { useEffect, useState } from "react";

type AlphaState = "unknown" | "opaque" | "transparent";

/**
 * Shaffof PNG aniqlash — FAQAT CORS-safe (upload) rasmlar uchun.
 * Tainted canvas (url media) → "opaque" fallback.
 */
export function useImageAlpha(
  url: string | null,
  enabled: boolean
): AlphaState {
  const [state, setState] = useState<AlphaState>("unknown");

  useEffect(() => {
    if (!enabled || !url) {
      setState("opaque");
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";

    img.onload = () => {
      if (cancelled) return;
      try {
        const W = 32;
        const ratio = img.naturalHeight / Math.max(1, img.naturalWidth);
        const H = Math.max(1, Math.round(W * ratio));
        const canvas = document.createElement("canvas");
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          setState("opaque");
          return;
        }
        ctx.drawImage(img, 0, 0, W, H);
        const data = ctx.getImageData(0, 0, W, H).data;

        // Chetki piksellar — shaffof PNG odatda shu yerda shaffof
        let transparent = false;
        const checkAlpha = (x: number, y: number) => {
          const a = data[(y * W + x) * 4 + 3];
          if (a < 250) transparent = true;
        };
        for (let x = 0; x < W; x++) {
          checkAlpha(x, 0);
          checkAlpha(x, H - 1);
        }
        for (let y = 0; y < H; y++) {
          checkAlpha(0, y);
          checkAlpha(W - 1, y);
        }
        setState(transparent ? "transparent" : "opaque");
      } catch {
        setState("opaque"); // SecurityError / tainted → fallback
      }
    };
    img.onerror = () => !cancelled && setState("opaque");
    img.src = url;

    return () => {
      cancelled = true;
    };
  }, [url, enabled]);

  return state;
}
