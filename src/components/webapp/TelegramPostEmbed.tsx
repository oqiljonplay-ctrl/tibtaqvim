"use client";
import { useEffect, useRef, useState } from "react";

interface Props {
  embedId: string; // e.g. "buyuktabib/123"
}

export function TelegramPostEmbed({ embedId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Reset
    container.innerHTML = "";
    setLoaded(false);

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-post", embedId);
    script.setAttribute("data-width", "100%");
    script.setAttribute("data-color", "2563EB");
    script.setAttribute("data-dark-color", "1d4ed8");
    const isDark = typeof document !== "undefined"
      && document.documentElement.getAttribute("data-webapp-theme") === "dark";
    script.setAttribute("data-dark", isDark ? "1" : "0");
    script.onload = () => setLoaded(true);

    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [embedId]);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-[var(--border)]">
      {/* Skeleton shimmer */}
      {!loaded && (
        <div className="absolute inset-0 z-10 rounded-2xl overflow-hidden">
          <div
            className="w-full h-full bg-gradient-to-r from-[var(--elevated)] via-[var(--surface)] to-[var(--elevated)] animate-pulse"
            style={{ minHeight: 120 }}
          />
        </div>
      )}
      <div ref={containerRef} style={{ marginTop: -54, marginBottom: -32 }} className="w-full min-h-[120px]" />
    </div>
  );
}
