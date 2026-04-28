import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClinicBot — Klinika Boshqaruv Tizimi",
  description: "Ko'p klinikali boshqaruv tizimi",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body>{children}</body>
    </html>
  );
}
