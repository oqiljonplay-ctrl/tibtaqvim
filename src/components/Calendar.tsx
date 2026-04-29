"use client";
import { useState } from "react";
import {
  generateCalendarMatrix,
  getMonthLabel,
  prevMonth,
  nextMonth,
  WEEKDAY_LABELS,
} from "@/lib/calendar";

interface Props {
  value: string | null;
  onChange: (date: string) => void;
}

export function Calendar({ value, onChange }: Props) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);

  const matrix = generateCalendarMatrix(viewYear, viewMonth);
  const label = getMonthLabel(viewYear, viewMonth);

  function handlePrev() {
    const p = prevMonth(viewYear, viewMonth);
    setViewYear(p.year);
    setViewMonth(p.month);
  }

  function handleNext() {
    const n = nextMonth(viewYear, viewMonth);
    setViewYear(n.year);
    setViewMonth(n.month);
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 select-none">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={handlePrev}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 active:scale-95 transition-all text-xl font-light"
        >
          ‹
        </button>
        <span className="text-sm font-semibold text-gray-800">{label}</span>
        <button
          onClick={handleNext}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100 active:scale-95 transition-all text-xl font-light"
        >
          ›
        </button>
      </div>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="h-8 flex items-center justify-center text-xs text-gray-400 font-medium">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {matrix.flat().map((cell, idx) => {
          if (!cell) {
            return <div key={`empty-${idx}`} className="h-9" />;
          }
          const isSelected = cell.dateStr === value;
          return (
            <button
              key={cell.dateStr}
              disabled={cell.disabled}
              onClick={() => onChange(cell.dateStr)}
              className={`h-9 w-full rounded-xl text-sm font-medium transition-all ${
                isSelected
                  ? "bg-blue-600 text-white shadow-sm scale-105"
                  : cell.isToday && !cell.disabled
                  ? "bg-blue-50 text-blue-700 font-bold ring-1 ring-blue-300"
                  : cell.disabled
                  ? "text-gray-200 cursor-not-allowed"
                  : "text-gray-700 hover:bg-blue-50 hover:text-blue-600 active:scale-95"
              }`}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
