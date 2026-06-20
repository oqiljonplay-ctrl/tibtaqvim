export function LimitBar({
  label,
  current,
  max,
}: {
  label: string;
  current: number;
  max: number;
}) {
  const pct = max > 0 ? Math.min(100, (current / max) * 100) : 0;
  const full = max > 0 && current >= max;
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gray-600">{label}:</span>
      <span className={`font-semibold ${full ? "text-red-600" : "text-gray-900"}`}>
        {current}/{max}
      </span>
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${full ? "bg-red-500" : "bg-blue-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
