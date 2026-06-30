"use client";
import { SWRConfig } from "swr";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        keepPreviousData: true,
        revalidateOnFocus: false,
        dedupingInterval: 4000,
      }}
    >
      {children}
    </SWRConfig>
  );
}
