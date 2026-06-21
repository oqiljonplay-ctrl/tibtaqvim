"use client";

import { useRef, useState, useCallback } from "react";
import { BottomSheet } from "@/components/webapp/BottomSheet";
import { ShowcaseBlockCard } from "@/components/webapp/ShowcaseBlockCard";
import type { ShowcaseBlock } from "@/lib/showcase/types";

type Tab = "doctors" | "services";

const TAB_LABEL: Record<Tab, { title: string; emptyText: string }> = {
  doctors: { title: "Shifokorlar", emptyText: "Bu klinikada hozircha shifokor vitrinasi yo'q" },
  services: { title: "Xizmatlar", emptyText: "Bu klinikada hozircha xizmat vitrinasi yo'q" },
};

export function ServiceDoctorPanel({ clinicId }: { clinicId: string | null }) {
  const tabsRef = useRef<HTMLDivElement>(null);

  const [tab, setTab] = useState<Tab | null>(null);
  const [loading, setLoading] = useState(false);
  const [errored, setErrored] = useState(false);

  const [cache, setCache] = useState<Partial<Record<Tab, ShowcaseBlock[]>>>({});

  const abortRef = useRef<AbortController | null>(null);
  const tokenRef = useRef(0);

  const open = tab !== null;
  const close = () => setTab(null);

  const fetchTab = useCallback(
    async (t: Tab, cId: string) => {
      if (cache[t]) { setLoading(false); setErrored(false); return; }

      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const myToken = ++tokenRef.current;

      setLoading(true);
      setErrored(false);
      try {
        const res = await fetch(
          `/api/webapp/clinics/${cId}/showcase?tab=${t}`,
          { signal: ctrl.signal }
        );
        const json = await res.json();
        if (myToken !== tokenRef.current) return;
        if (!res.ok || !json?.success) {
          setErrored(true);
          setLoading(false);
          return;
        }
        const blocks: ShowcaseBlock[] = json.data?.blocks ?? [];
        setCache((prev) => ({ ...prev, [t]: blocks }));
        setLoading(false);
      } catch (e: unknown) {
        if (e instanceof Error && e.name === "AbortError") return;
        if (myToken !== tokenRef.current) return;
        setErrored(true);
        setLoading(false);
      }
    },
    [cache]
  );

  const handleTab = (t: Tab) => {
    setTab(t);
    if (clinicId) fetchTab(t, clinicId);
  };

  const retry = () => {
    if (!tab || !clinicId) return;
    setCache((prev) => { const c = { ...prev }; delete c[tab]; return c; });
    fetchTab(tab, clinicId);
  };

  const blocks = tab ? cache[tab] : undefined;
  const label = tab ? TAB_LABEL[tab] : null;

  return (
    <>
      <div ref={tabsRef} className="flex gap-2">
        <button
          type="button"
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
          type="button"
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
        title={label?.title}
        keepOpenRefs={[tabsRef]}
        initialPct={66}
        maxPct={90}
      >
        {!clinicId && (
          <div className="py-10 text-center">
            <p className="text-base font-semibold text-gray-900">Klinikani tanlang</p>
            <p className="text-sm text-gray-500 mt-1">
              Shifokorlar va xizmatlarni ko&apos;rish uchun avval klinikani tanlang.
            </p>
          </div>
        )}

        {clinicId && loading && (
          <div className="flex flex-col gap-3 py-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="h-4 w-1/2 bg-gray-100 rounded animate-pulse mb-3" />
                <div className="h-40 w-full bg-gray-100 rounded-xl animate-pulse mb-3" />
                <div className="h-11 w-full bg-gray-100 rounded-xl animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {clinicId && !loading && errored && (
          <div className="py-10 text-center">
            <p className="text-base font-semibold text-gray-900">Ma&apos;lumotni yuklab bo&apos;lmadi</p>
            <p className="text-sm text-gray-500 mt-1">Internet aloqasini tekshirib qayta urining.</p>
            <button
              type="button"
              onClick={retry}
              className="mt-4 min-h-[44px] px-5 rounded-xl bg-blue-600 text-white text-sm font-medium active:bg-blue-700"
            >
              Qayta urinish
            </button>
          </div>
        )}

        {clinicId && !loading && !errored && blocks && blocks.length === 0 && label && (
          <div className="py-10 text-center">
            <p className="text-sm text-gray-500">{label.emptyText}</p>
          </div>
        )}

        {clinicId && !loading && !errored && blocks && blocks.length > 0 && (
          <div className="py-1">
            {blocks.map((b) => (
              <ShowcaseBlockCard key={b.id} block={b} clinicId={clinicId} />
            ))}
          </div>
        )}
      </BottomSheet>
    </>
  );
}
