import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://tibtaqvim.vercel.app"),
  title: "TibTaqvim — Klinika Boshqaruv Tizimi",
  description: "Ko'p klinikali shifokor qabuli va navbat boshqaruv tizimi",
  openGraph: {
    title: "TibTaqvim — Klinika Boshqaruv Tizimi",
    description: "Ko'p klinikali shifokor qabuli va navbat boshqaruv tizimi",
    url: "https://tibtaqvim.vercel.app",
    siteName: "TibTaqvim",
    type: "website",
    locale: "uz_UZ",
  },
  twitter: {
    card: "summary",
    title: "TibTaqvim — Klinika Boshqaruv Tizimi",
    description: "Ko'p klinikali shifokor qabuli va navbat boshqaruv tizimi",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <head>
        {/* Telegram WebApp SDK — root layout'da beforeInteractive kafolatlangan */}
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
