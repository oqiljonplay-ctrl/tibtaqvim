import type { Metadata } from "next";
import { Suspense } from "react";
import { SWRConfig } from "swr";
import { ClinicProvider } from "@/lib/clinic-context";
import { ClinicGuard } from "@/components/webapp/ClinicGuard";
import { WebAppThemeProvider } from "@/components/webapp/WebAppThemeProvider";

export const metadata: Metadata = {
  title: "TibTaqvim — Onlayn qabul",
  description: "Klinikaga onlayn yozilish",
  robots: { index: false },
};

/* anti-flash: HTML parse paytida atributni o'rnatadi (paint'dan oldin) → miltillamaslik */
const themeBootstrap = `(function(){try{
  var k="tibtaqvim_webapp_theme";
  var m=localStorage.getItem(k)||"auto";
  var eff=m;
  if(m==="auto"){
    var tg=window.Telegram&&window.Telegram.WebApp;
    if(tg&&(tg.colorScheme==="dark"||tg.colorScheme==="light")){eff=tg.colorScheme;}
    else{eff=(window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches)?"dark":"light";}
  }
  document.documentElement.setAttribute("data-webapp-theme",eff==="dark"?"dark":"light");
  try{
    var wtg=window.Telegram&&window.Telegram.WebApp;
    if(wtg){
      var hc=eff==="dark"?"#141311":"#FBFCFC";
      if(wtg.isVersionAtLeast&&wtg.isVersionAtLeast("6.9")){wtg.setHeaderColor&&wtg.setHeaderColor(hc);wtg.setBackgroundColor&&wtg.setBackgroundColor(hc);}
      else{wtg.setHeaderColor&&wtg.setHeaderColor("bg_color");}
    }
  }catch(e){}
}catch(e){document.documentElement.setAttribute("data-webapp-theme","light");}})();`;

export default function WebAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      <Suspense
        fallback={
          <div className="min-h-[100dvh] bg-[var(--bg,#f9fafb)] animate-pulse overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-10 h-10 rounded-full bg-gray-200 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="h-3.5 w-28 bg-gray-200 rounded-full mb-1.5" />
                <div className="h-2.5 w-20 bg-gray-100 rounded-full" />
              </div>
            </div>
            <div className="mx-4 mt-1 h-28 rounded-2xl bg-gray-200" />
            <div className="mx-4 mt-3 flex gap-3">
              <div className="flex-1 h-16 rounded-xl bg-gray-200" />
              <div className="flex-1 h-16 rounded-xl bg-gray-100" />
            </div>
            <div className="mx-4 mt-4 space-y-2.5">
              <div className="h-16 rounded-xl bg-gray-200" />
              <div className="h-16 rounded-xl bg-gray-100" />
              <div className="h-16 rounded-xl bg-gray-200" />
            </div>
            <div className="fixed bottom-0 inset-x-0 flex justify-around items-center p-3 bg-[var(--bg,#f9fafb)] border-t border-gray-100">
              <div className="w-10 h-8 rounded-lg bg-gray-200" />
              <div className="w-10 h-8 rounded-lg bg-gray-200" />
              <div className="w-10 h-8 rounded-lg bg-gray-200" />
            </div>
          </div>
        }
      >
        <SWRConfig value={{
          fetcher: (url: string) => fetch(url).then((r) => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
          }),
          keepPreviousData: true,
          revalidateOnFocus: false,
          dedupingInterval: 4000,
        }}>
          <ClinicProvider>
            <WebAppThemeProvider>
              <ClinicGuard>{children}</ClinicGuard>
            </WebAppThemeProvider>
          </ClinicProvider>
        </SWRConfig>
      </Suspense>
    </>
  );
}
