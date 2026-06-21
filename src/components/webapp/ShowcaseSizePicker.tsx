"use client";

import type { ShowcaseSize } from "@/lib/showcase/types";

const SIZES: { key: ShowcaseSize; label: string }[] = [
  { key: "S", label: "S" },
  { key: "M", label: "M" },
  { key: "L", label: "L" },
  { key: "XL", label: "XL" },
];

export function ShowcaseSizePicker({
  value,
  onChange,
}: {
  value: ShowcaseSize;
  onChange: (s: ShowcaseSize) => void;
}) {
  return (
    <div
      className="inline-flex items-center rounded-xl border border-gray-200 bg-white p-0.5"
      role="group"
      aria-label="Vitrina o'lchami"
    >
      {SIZES.map((s) => (
        <button
          key={s.key}
          type="button"
          onClick={() => onChange(s.key)}
          aria-pressed={value === s.key}
          className={`min-w-[36px] min-h-[32px] px-2 rounded-lg text-xs font-medium transition-colors ${
            value === s.key ? "bg-blue-600 text-white" : "text-gray-600"
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
