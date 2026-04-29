"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/admin/super", label: "Dashboard", icon: "⬡" },
  { href: "/admin/super/clinics", label: "Klinikalar", icon: "🏥" },
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
    document.cookie = "auth_token=; path=/; max-age=0";
    await fetch("/api/admin/super/auth", { method: "DELETE" });
    router.push("/admin/super/auth");
  }

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 bg-slate-900 flex flex-col">
        {/* Logo */}
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

        {/* Nav */}
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
            <Link
              href="/admin"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <span>↩</span>
              Admin Panel
            </Link>
          </div>
        </nav>

        {/* User */}
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

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-6">{children}</div>
      </main>
    </div>
  );
}
