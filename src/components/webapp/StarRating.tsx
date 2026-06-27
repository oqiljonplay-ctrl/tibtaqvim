"use client";
import { useId } from "react";

const STAR_PATH =
  "M12 1.8l3.1 6.27 6.9.6-5.2 4.6 1.55 6.78L12 16.5l-6.35 3.55L7.2 13.27 2 8.67l6.9-.6L12 1.8z";
// viewBox 0 0 24 24; path x=12 atrofida SIMMETRIK — yarim kesim aniq 50% beradi.

export function StarRating({
  value,
  onChange,
  readOnly = false,
  size = 36,
}: {
  value: number;
  onChange?: (v: number) => void;
  readOnly?: boolean;
  size?: number;
}) {
  const uid = useId(); // HAR instansiya uchun unikal — clipPath ID to'qnashuvini yo'qotadi (X4)
  const display = readOnly ? Math.round(value * 2) / 2 : value;
  const effectiveSize = readOnly ? (size === 36 ? 16 : size) : size;

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fraction = Math.max(0, Math.min(1, display - (i - 1))); // 0 | 0.5 | 1
        const clipId = `star-${uid}-${i}`;
        return (
          <button
            key={i}
            type="button"
            disabled={readOnly}
            onClick={(e) => {
              e.stopPropagation();
              if (readOnly || !onChange) return;
              onChange(value === i - 0.5 ? i : i - 0.5); // 1-bosish yarim, o'sha yulduzga 2-bosish to'liq
            }}
            style={
              readOnly
                ? { background: "none", border: "none", padding: 0, cursor: "default" }
                : { background: "none", border: "none", padding: 4, margin: -2, minWidth: 40, minHeight: 40, cursor: "pointer" }
            }
            aria-label={`${i} yulduz`}
          >
            <svg viewBox="0 0 24 24" width={effectiveSize} height={effectiveSize} style={{ display: "block" }}>
              <defs>
                {fraction === 0.5 && (
                  <clipPath id={clipId}>
                    <rect x="0" y="0" width="12" height="24" />
                  </clipPath>
                )}
              </defs>
              <path d={STAR_PATH} style={{ fill: "var(--border)" }} />
              {fraction > 0 && (
                <path
                  d={STAR_PATH}
                  style={{ fill: "var(--star)" }}
                  clipPath={fraction === 1 ? undefined : `url(#${clipId})`}
                />
              )}
            </svg>
          </button>
        );
      })}
    </span>
  );
}
