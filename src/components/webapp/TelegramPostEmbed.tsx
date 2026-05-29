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
    script.onload = () => setLoaded(true);

    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [embedId]);

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-gray-100">
      {/* Skeleton shimmer */}
      {!loaded && (
        <div className="absolute inset-0 z-10 rounded-2xl overflow-hidden">
          <div className="w-full h-full bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100 animate-pulse" style={{ minHeight: 120 }} />
        </div>
      )}
      <div ref={containerRef} className="w-full min-h-[120px]" />
    </div>
  );
}
