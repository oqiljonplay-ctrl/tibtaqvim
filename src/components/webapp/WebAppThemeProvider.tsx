"use client";
import { createContext, useContext, useEffect } from "react";
import { useWebAppTheme, type ThemeMode, type Effective } from "@/lib/webapp/use-webapp-theme";

type Ctx = { mode: ThemeMode; effective: Effective; setMode: (m: ThemeMode) => void };
const ThemeCtx = createContext<Ctx | null>(null);

export function WebAppThemeProvider({ children }: { children: React.ReactNode }) {
  const t = useWebAppTheme();
  useEffect(() => () => { document.documentElement.removeAttribute("data-webapp-theme"); }, []);
  return <ThemeCtx.Provider value={t}>{children}</ThemeCtx.Provider>;
}

export function useThemeCtx(): Ctx {
  const c = useContext(ThemeCtx);
  if (!c) throw new Error("useThemeCtx WebAppThemeProvider ichida ishlatilishi kerak");
  return c;
}
