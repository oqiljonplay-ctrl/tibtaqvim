import React from "react";

type Gap = 2 | 3 | 4 | 6 | 8;
type Align = "start" | "center" | "end" | "stretch" | "baseline";
type Justify = "start" | "center" | "end" | "between" | "around" | "evenly";

const gapMap: Record<Gap, string> = {
  2: "gap-2",
  3: "gap-3",
  4: "gap-4",
  6: "gap-6",
  8: "gap-8",
};

const alignMap: Record<Align, string> = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
  baseline: "items-baseline",
};

const justifyMap: Record<Justify, string> = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
  around: "justify-around",
  evenly: "justify-evenly",
};

interface StackProps {
  direction?: "row" | "col";
  gap?: Gap;
  wrap?: boolean;
  align?: Align;
  justify?: Justify;
  stackOnMobile?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Stack({
  direction = "col",
  gap = 4,
  wrap,
  align,
  justify,
  stackOnMobile,
  className,
  children,
}: StackProps) {
  const dirClass =
    direction === "row"
      ? stackOnMobile
        ? "flex flex-col sm:flex-row"
        : "flex flex-row"
      : "flex flex-col";

  const classes = [
    dirClass,
    gapMap[gap],
    wrap ? "flex-wrap" : "",
    align ? alignMap[align] : "",
    justify ? justifyMap[justify] : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return <div className={classes}>{children}</div>;
}
