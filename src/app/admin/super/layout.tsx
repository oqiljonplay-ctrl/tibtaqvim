"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/admin/super", label: "Dashboard", icon: "⬡" },
  { href: "/admin/super/clinics", label: "Klinikalar", icon: "🏥" },
  { href: "/admin/super/ads", label: "Reklamalar", icon: "📢" },
  { href: "/admin/super/audit", label: "Audit Log", icon: "📋" },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState("");

  useEffect(() => {
    setUserName(localStorage.getItem("user_name") || "SuperAdmin");
  }, []);

  async function logout() {
    localStorage.clear();
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    await fetch("/api/admin/super/auth", { method: "DELETE" });
    router.push("/admin/super/auth");
  }

  return (
    <div className="flex min-h-[100dvh] bg-gray-100">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-60 flex-shrink-0 bg-slate-900 sticky top-0 h-screen overflow-y-auto">
        <div className="px-6 py-5 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-white text-sm font-bold">
              SA
            </div>
            <div>
              <div className="text-white font-semibold text-sm">SuperAdmin</div>
              <div className="text-slate-400 text-xs">Clinic OS</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const active = path === item.href || (item.href !== "/admin/super" && path.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}

          <div className="pt-4 mt-4 border-t border-slate-700">
            <button
              onClick={logout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
            >
              <span>⏻</span>
              Chiqish
            </button>
          </div>
        </nav>

        <div className="px-4 py-4 border-t border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-slate-600 flex items-center justify-center text-white text-xs font-bold">
                {userName.charAt(0).toUpperCase()}
              </div>
              <span className="text-slate-300 text-xs truncate max-w-[90px]">{userName}</span>
            </div>
            <button
              onClick={logout}
              className="text-slate-500 hover:text-red-400 text-xs transition-colors"
            >
              Chiq
            </button>
          </div>
        </div>
      </aside>

      {/* Right side: mobile top nav + content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top nav */}
        <div className="lg:hidden bg-slate-900 px-3 py-2.5 flex items-center gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const active = path === item.href || (item.href !== "/admin/super" && path.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap flex-shrink-0 transition-colors ${
                  active
                    ? "bg-indigo-600 text-white"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
          <button
            onClick={logout}
            className="ml-auto flex-shrink-0 px-2.5 py-2 text-slate-400 hover:text-red-400 text-xs rounded-lg hover:bg-slate-800 transition-colors"
          >
            ⏻
          </button>
        </div>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 lg:px-6 py-4 lg:py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
