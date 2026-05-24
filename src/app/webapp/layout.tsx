import type { Metadata } from "next";
import { Suspense } from "react";
import { ClinicProvider } from "@/lib/clinic-context";
import { ClinicGuard } from "@/components/webapp/ClinicGuard";

export const metadata: Metadata = {
  title: "TibTaqvim — Onlayn qabul",
  description: "Klinikaga onlayn yozilish",
  robots: { index: false },
};

export default function WebAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-[100dvh] flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="text-4xl mb-3">🏥</div>
            <p className="text-gray-400 text-sm animate-pulse">Yuklanmoqda...</p>
          </div>
        </div>
      }
    >
      <ClinicProvider>
        <ClinicGuard>{children}</ClinicGuard>
      </ClinicProvider>
    </Suspense>
  );
}
