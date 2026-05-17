"use client";

type Range = 7 | 14 | 30 | 90;

interface Props {
  value: Range;
  onChange: (v: Range) => void;
  disabled?: boolean;
}

const OPTIONS: Array<{ value: Range; label: string }> = [
  { value: 7,  label: "7 kun" },
  { value: 14, label: "14 kun" },
  { value: 30, label: "30 kun" },
  { value: 90, label: "90 kun" },
];

export default function DateRangeFilter({ value, onChange, disabled = false }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          disabled={disabled}
          className={`
            px-3 py-1.5 rounded-lg text-xs font-medium transition
            ${
              value === opt.value
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
            }
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
