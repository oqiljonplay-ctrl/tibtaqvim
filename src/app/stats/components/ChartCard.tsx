"use client";
import { ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  icon?: string;
  children: ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  fullWidth?: boolean;
}

export default function ChartCard({
  title,
  subtitle,
  icon,
  children,
  loading = false,
  empty = false,
  emptyMessage = "Ma'lumot yo'q",
  fullWidth = false,
}: Props) {
  return (
    <div
      className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-4 ${
        fullWidth ? "col-span-full" : ""
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
            {icon && <span>{icon}</span>}
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="relative" style={{ minHeight: 240 }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm rounded-lg z-10">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {empty && !loading ? (
          <div className="flex items-center justify-center h-60 text-sm text-gray-400">
            {emptyMessage}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
