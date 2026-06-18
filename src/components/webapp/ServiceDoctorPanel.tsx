"use client";
import { useRef, useState } from "react";
import { BottomSheet } from "./BottomSheet";

type Tab = "doctors" | "services";

export function ServiceDoctorPanel({ clinicId }: { clinicId: string | null }) {
  const [tab, setTab] = useState<Tab | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  const handleTab = (t: Tab) => {
    if (tab === null) {
      setTab(t);
    } else if (tab === t) {
      return;
    } else {
      setTab(t);
    }
  };

  const close = () => setTab(null);
  const open = tab !== null;
  const title = tab === "doctors" ? "Shifokorlar" : tab === "services" ? "Xizmatlar" : "";

  return (
    <>
      {/* Tab'lar — kartochkasiz, bare segment */}
      <div ref={tabsRef} className="mt-7 flex gap-2">
        <button
          onClick={() => handleTab("doctors")}
          aria-pressed={tab === "doctors"}
          className={`flex-1 min-h-[44px] rounded-xl flex items-center justify-center gap-1.5 text-sm font-semibold transition-colors ${
            tab === "doctors"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-white border border-gray-200 text-gray-700"
          }`}
        >
          🩺 Shifokorlar
        </button>
        <button
          onClick={() => handleTab("services")}
          aria-pressed={tab === "services"}
          className={`flex-1 min-h-[44px] rounded-xl flex items-center justify-center gap-1.5 text-sm font-semibold transition-colors ${
            tab === "services"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-white border border-gray-200 text-gray-700"
          }`}
        >
          🧰 Xizmatlar
        </button>
      </div>

      <BottomSheet
        open={open}
        onClose={close}
        title={title}
        keepOpenRefs={[tabsRef]}
      >
        {/* PLACEHOLDER — kontent keyingi bosqichda. clinicId keyin ishlatiladi. */}
        <div className="text-xs text-gray-400 mb-3">
          ({tab === "services" ? "Xizmatlar" : "Shifokorlar"} ro&apos;yxati keyingi bosqichda joylashadi.)
        </div>
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="bg-gray-50 border border-gray-100 rounded-xl px-3 py-3 mb-2 text-sm text-gray-500"
          >
            {tab === "services" ? "Xizmat" : "Shifokor"} #{i + 1}
          </div>
        ))}
        {/* clinicId keyingi bosqichda fetch uchun ishlatiladi */}
        <div className="hidden">{clinicId}</div>
      </BottomSheet>
    </>
  );
}
