import React from "react";

type ContainerSize = "sm" | "md" | "lg" | "xl" | "full";

const maxWidthMap: Record<ContainerSize, string> = {
  sm: "max-w-2xl",
  md: "max-w-4xl",
  lg: "max-w-6xl",
  xl: "max-w-7xl",
  full: "max-w-full",
};

interface ContainerProps {
  size?: ContainerSize;
  className?: string;
  children: React.ReactNode;
}

export function Container({ size = "lg", className, children }: ContainerProps) {
  return (
    <div className={`mx-auto w-full px-4 sm:px-6 lg:px-8 ${maxWidthMap[size]} ${className ?? ""}`}>
      {children}
    </div>
  );
}
