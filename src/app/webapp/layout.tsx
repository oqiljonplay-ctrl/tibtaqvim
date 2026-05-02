import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TibTaqvim — Onlayn qabul",
  description: "Klinikaga onlayn yozilish",
  robots: { index: false },
};

export default function WebAppLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
