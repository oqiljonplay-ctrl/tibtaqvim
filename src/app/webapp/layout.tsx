import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "TibTaqvim — Onlayn qabul",
  description: "Klinikaga onlayn yozilish",
  robots: { index: false },
};

export default function WebAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Telegram WebApp SDK — window.Telegram.WebApp ni to'liq ishga tushiradi */}
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="beforeInteractive"
      />
      {children}
    </>
  );
}
