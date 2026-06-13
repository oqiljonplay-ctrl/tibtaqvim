"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";

interface SidebarItem {
  href: string;
  label: string;
  roles?: string[];
}

const ALL_ADMIN_ITEMS: SidebarItem[] = [
  { href: "/admin",                label: "Dashboard" },
  { href: "/admin/services",       label: "Xizmatlar" },
  { href: "/admin/doctors",        label: "Shifokorlar" },
  { href: "/admin/staff",          label: "Xodimlar",         roles: ["super_admin", "clinic_admin", "branch_admin"] },
  { href: "/admin/job-requests",   label: "Xodim so'rovlari", roles: ["super_admin", "clinic_admin", "branch_admin"] },
  { href: "/admin/branches",       label: "Filiallar",        roles: ["super_admin", "clinic_admin"] },
  { href: "/admin/promotions",     label: "Telegram postlar", roles: ["super_admin", "clinic_admin", "branch_admin"] },
  { href: "/admin/broadcast",      label: "Broadcast",        roles: ["clinic_admin"] },
  { href: "/admin/super/ads",      label: "Reklamalar",       roles: ["super_admin"] },
  { href: "/admin/reception",      label: "Qabulxona",        roles: ["clinic_admin", "branch_admin"] },
  { href: "/admin/doctor",         label: "Navbat",           roles: ["clinic_admin", "branch_admin"] },
  { href: "/admin/settings",       label: "Sozlamalar",       roles: ["super_admin", "clinic_admin"] },
];

function isActive(itemHref: string, currentPath: string): boolean {
  if (itemHref === "/admin") return currentPath === "/admin";
  return currentPath === itemHref || currentPath.startsWith(itemHref + "/");
}

function SidebarLinks({ items, path, jobRequestCount, onNavigate }: {
  items: SidebarItem[];
  path: string;
  jobRequestCount: number;
  onNavigate?: () => void;
}) {
  return (
    <nav className="p-3 flex flex-col gap-0.5">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            isActive(item.href, path)
              ? "bg-blue-50 text-blue-700"
              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
          }`}
        >
          <span>{item.label}</span>
          {item.href === "/admin/job-requests" && jobRequestCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center w-5 h-5 text-xs font-bold bg-red-500 text-white rounded-full">
              {jobRequestCount > 9 ? "9+" : jobRequestCount}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}

export default function AdminSidebar() {
  const path = usePathname();
  const { user, loading } = useCurrentUser();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [jobRequestCount, setJobRequestCount] = useState(0);

  const items = loading || !user
    ? []
    : ALL_ADMIN_ITEMS.filter(
        (item) => !item.roles || item.roles.includes(user.role)
      );

  useEffect(() => {
    if (!user || !["super_admin", "clinic_admin", "branch_admin"].includes(user.role)) return;
    const fetchCount = () => {
      fetch("/api/admin/job-requests/count", { credentials: "include" })
        .then((r) => r.json())
        .then((j) => { if (j.success) setJobRequestCount(j.data?.count ?? 0); })
        .catch(() => {});
    };
    fetchCount();
    const id = setInterval(fetchCount, 60_000);
    return () => clearInterval(id);
  }, [user]);

  const skeletons = (
    Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="h-9 bg-gray-100 rounded-lg animate-pulse mx-3 my-0.5" />
    ))
  );

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex w-56 flex-shrink-0 bg-white border-r border-gray-200 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto flex-col">
        {loading ? skeletons : (
          <SidebarLinks items={items} path={path} jobRequestCount={jobRequestCount} />
        )}
      </aside>

      {/* ── Mobile: floating hamburger button ── */}
      <button
        className="md:hidden fixed bottom-5 right-5 z-50 w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center text-xl transition-colors"
        onClick={() => setMobileOpen(true)}
        aria-label="Menyu"
      >
        ☰
      </button>

      {/* ── Mobile: backdrop + drawer ── */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed left-0 top-0 h-full w-64 bg-white z-50 shadow-xl md:hidden flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <span className="font-semibold text-gray-900 text-sm">Admin Panel</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                aria-label="Yopish"
              >
                ✕
              </button>
            </div>
            {loading ? skeletons : (
              <SidebarLinks items={items} path={path} jobRequestCount={jobRequestCount} onNavigate={() => setMobileOpen(false)} />
            )}
          </aside>
        </>
      )}
    </>
  );
}
