"use client";

interface StarRatingProps {
  value: number;
  onChange?: (v: number) => void;
  readOnly?: boolean;
  size?: number;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function fillFraction(i: number, value: number) {
  return clamp(value - (i - 1), 0, 1);
}

function Star({ index, value, onChange, size }: {
  index: number;
  value: number;
  onChange?: (v: number) => void;
  size: number;
}) {
  const id = `star-clip-${index}-${size}`;
  const frac = fillFraction(index, value);
  const fillW = frac * size;

  function handleClick(e: React.MouseEvent) {
    if (!onChange) return;
    e.stopPropagation();
    // first click → i-0.5, second click on same star → i
    const half = index - 0.5;
    onChange(value === half ? index : half);
  }

  const pad = Math.max(0, (40 - size) / 2);

  return (
    <span
      role={onChange ? "button" : undefined}
      onClick={onChange ? handleClick : undefined}
      style={{ display: "inline-block", padding: pad, cursor: onChange ? "pointer" : "default" }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        style={{ display: "block" }}
      >
        <defs>
          <clipPath id={id}>
            <rect x="0" y="0" width={fillW} height="24" />
          </clipPath>
        </defs>
        {/* Kontur yulduz (kulrang) */}
        <path
          d="M12 2l2.9 6.3 6.8.9-5 4.7 1.2 6.7L12 17.3l-5.9 3.3 1.2-6.7-5-4.7 6.8-.9z"
          fill="#d1d5db"
          stroke="#d1d5db"
          strokeWidth="0.5"
        />
        {/* To'liq yulduz (tillarang), clipPath bilan kesiladi */}
        <path
          d="M12 2l2.9 6.3 6.8.9-5 4.7 1.2 6.7L12 17.3l-5.9 3.3 1.2-6.7-5-4.7 6.8-.9z"
          fill="#f5b50a"
          clipPath={`url(#${id})`}
        />
      </svg>
    </span>
  );
}

export function StarRating({ value, onChange, readOnly = false, size = 36 }: StarRatingProps) {
  const displayValue = readOnly ? Math.round(value * 2) / 2 : value;
  const effectiveSize = readOnly ? (size === 36 ? 16 : size) : size;

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          index={i}
          value={displayValue}
          onChange={readOnly ? undefined : onChange}
          size={effectiveSize}
        />
      ))}
    </span>
  );
}
