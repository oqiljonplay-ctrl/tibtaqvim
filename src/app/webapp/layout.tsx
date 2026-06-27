import type { Metadata } from "next";
import { Suspense } from "react";
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
  document.documentElement.setAttribute("data-webapp-theme", eff==="dark"?"dark":"light");
}catch(e){document.documentElement.setAttribute("data-webapp-theme","light");}})();`;

export default function WebAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
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
          <WebAppThemeProvider>
            <ClinicGuard>{children}</ClinicGuard>
          </WebAppThemeProvider>
        </ClinicProvider>
      </Suspense>
    </>
  );
}
