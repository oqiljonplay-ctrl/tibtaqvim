"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Telegram native BackButton'ni boshqaradi.
 * @param onBack  bosilganda chaqiriladi (har render'dagi eng yangi closure ishlatiladi)
 * @param visible BackButton ko'rinsinmi (masalan step==="done" da false)
 * @returns supported — native BackButton mavjudmi (false bo'lsa sahifa in-page "←" fallback ko'rsatadi)
 */
export function useTelegramBack(onBack: () => void, visible: boolean = true): boolean {
  const [supported, setSupported] = useState(false);
  const cb = useRef(onBack);
  useEffect(() => { cb.current = onBack; }); // har render — eng yangi handler

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    const ok = !!tg?.isVersionAtLeast?.("6.1") && !!tg?.BackButton;
    setSupported(ok);
    if (!ok) return;
    const bb = tg.BackButton;
    const handler = () => cb.current();
    if (visible) { bb.show(); bb.onClick(handler); }
    else { bb.hide(); }
    return () => { try { bb.offClick(handler); bb.hide(); } catch {} };
  }, [visible]);

  return supported;
}
