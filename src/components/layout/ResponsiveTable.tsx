import React from "react";

interface ResponsiveTableProps {
  className?: string;
  children: React.ReactNode;
}

export function ResponsiveTable({ className, children }: ResponsiveTableProps) {
  return (
    <div className={`w-full overflow-x-auto -mx-4 sm:mx-0 ${className ?? ""}`}>
      <table className="min-w-full">{children}</table>
    </div>
  );
}
