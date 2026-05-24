import React from "react";

// Statik map — JIT dinamik klass nomlarini ushlamaydi, shuning uchun string birlashtirish QILINMAYDI
const colsMap: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
};

const smColsMap: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
  5: "sm:grid-cols-5",
  6: "sm:grid-cols-6",
};

const mdColsMap: Record<number, string> = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
  4: "md:grid-cols-4",
  5: "md:grid-cols-5",
  6: "md:grid-cols-6",
};

const lgColsMap: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
  6: "lg:grid-cols-6",
};

const xlColsMap: Record<number, string> = {
  1: "xl:grid-cols-1",
  2: "xl:grid-cols-2",
  3: "xl:grid-cols-3",
  4: "xl:grid-cols-4",
  5: "xl:grid-cols-5",
  6: "xl:grid-cols-6",
};

const gapMap: Record<number, string> = {
  2: "gap-2",
  3: "gap-3",
  4: "gap-4",
  6: "gap-6",
  8: "gap-8",
};

interface ColConfig {
  base?: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
}

interface ResponsiveGridProps {
  cols?: ColConfig;
  gap?: number;
  className?: string;
  children: React.ReactNode;
}

export function ResponsiveGrid({
  cols = { base: 1, sm: 2, lg: 3 },
  gap = 4,
  className,
  children,
}: ResponsiveGridProps) {
  const classes = [
    "grid",
    cols.base ? (colsMap[cols.base] ?? "grid-cols-1") : "grid-cols-1",
    cols.sm ? (smColsMap[cols.sm] ?? "") : "",
    cols.md ? (mdColsMap[cols.md] ?? "") : "",
    cols.lg ? (lgColsMap[cols.lg] ?? "") : "",
    cols.xl ? (xlColsMap[cols.xl] ?? "") : "",
    gapMap[gap] ?? "gap-4",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={classes}>{children}</div>;
}
