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
          <div className="min-h-[100dvh] flex items-center justify-center bg-[var(--bg)]">
            <div className="text-center">
              <div className="text-4xl mb-3">🏥</div>
              <p className="text-sm animate-pulse" style={{ color: "var(--text-muted)" }}>Yuklanmoqda...</p>
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
