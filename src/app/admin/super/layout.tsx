"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";

const navItems = [
  { href: "/admin/super", label: "Dashboard", icon: "⬡" },
  { href: "/admin/super/clinics", label: "Klinikalar", icon: "🏥" },
  { href: "/admin/super/ads", label: "Reklamalar", icon: "📢" },
  { href: "/admin/super/showcase-limits", label: "Vitrina limitlari", icon: "✨" },
  { href: "/admin/super/promotions", label: "Telegram postlar", icon: "📣" },
  { href: "/admin/super/audit", label: "Audit Log", icon: "📋" },
];

interface ClinicItem { id: string; name: string; isActive: boolean }

function ClinicSelector() {
  const [clinics, setClinics] = useState<ClinicItem[]>([]);
  const [actingId, setActingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const refreshActing = useCallback(() => {
    const stored = document.cookie.split("; ").find(c => c.startsWith("acting_clinic="));
    setActingId(stored ? stored.split("=")[1] : null);
  }, []);

  useEffect(() => {
    refreshActing();
    fetch("/api/admin/super/clinics", { credentials: "include" })
      .then(r => r.json())
      .then(j => { if (j.success) setClinics(j.data || []); })
      .catch(() => {});
  }, [refreshActing]);

  async function selectClinic(id: string | null, name: string | null) {
    setLoading(true);
    try {
      if (id) {
        await fetch("/api/admin/super/acting-clinic", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clinicId: id }),
        });
        localStorage.setItem("clinicId", id);
        localStorage.setItem("acting_clinic_name", name || "");
        setActingId(id);
      } else {
        await fetch("/api/admin/super/acting-clinic", { method: "DELETE", credentials: "include" });
        localStorage.removeItem("clinicId");
        localStorage.removeItem("acting_clinic_name");
        setActingId(null);
      }
    } catch {}
    setLoading(false);
    setOpen(false);
  }

  const current = clinics.find(c => c.id === actingId);
  const label = current ? current.name : "🌐 Barcha klinikalar";

  return (
    <div className="relative px-3 py-2">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={loading}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-white transition-colors disabled:opacity-50"
      >
        <span className="truncate font-medium">{label}</span>
        <svg className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-3 right-3 top-full mt-1 z-50 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden shadow-xl">
          <button
            onClick={() => selectClinic(null, null)}
            className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-slate-700 transition-colors ${!actingId ? "text-indigo-300 font-medium" : "text-slate-300"}`}
          >
            <span>🌐</span>
            <span>Barcha klinikalar</span>
            {!actingId && <span className="ml-auto text-xs text-slate-500">faqat ko'rish</span>}
          </button>
          <div className="border-t border-slate-700" />
          {clinics.map(c => (
            <button
              key={c.id}
              onClick={() => selectClinic(c.id, c.name)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-slate-700 transition-colors ${actingId === c.id ? "text-indigo-300 font-medium" : "text-slate-300"}`}
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.isActive ? "bg-green-400" : "bg-slate-500"}`} />
              <span className="truncate">{c.name}</span>
              {actingId === c.id && <span className="ml-auto text-xs text-emerald-400">aktiv</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

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
    await fetch("/api/admin/super/acting-clinic", { method: "DELETE" });
    router.push("/superadminjon");
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

        {/* Klinika-tanlagich */}
        <div className="border-b border-slate-700">
          <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Aktiv klinika
          </p>
          <ClinicSelector />
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

        {/* Mobile clinic selector */}
        <div className="lg:hidden bg-slate-800 px-3 py-1.5 border-b border-slate-700">
          <ClinicSelector />
        </div>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 lg:px-6 py-4 lg:py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
