"use client";

export function Showcase3dSlider({
  value,
  onChange,
}: {
  value: number; // 0..1
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-1 max-w-[220px]">
      <span className="text-[10px] text-gray-400 select-none">2D</span>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        aria-label="3D chuqurligi"
        className="flex-1 accent-blue-600 h-1 cursor-pointer"
      />
      <span className="text-[10px] text-gray-400 select-none">3D</span>
    </div>
  );
}
