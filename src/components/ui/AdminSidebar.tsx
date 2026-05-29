"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCurrentUser } from "@/hooks/useCurrentUser";

interface SidebarItem {
  href: string;
  label: string;
  roles?: string[];
}

const ALL_ADMIN_ITEMS: SidebarItem[] = [
  { href: "/admin",              label: "Dashboard" },
  { href: "/admin/services",     label: "Xizmatlar" },
  { href: "/admin/doctors",      label: "Shifokorlar" },
  { href: "/admin/branches",     label: "Filiallar",       roles: ["super_admin", "clinic_admin"] },
  { href: "/admin/promotions",   label: "Telegram postlar", roles: ["super_admin", "clinic_admin", "branch_admin"] },
  { href: "/admin/broadcast",    label: "Broadcast",        roles: ["clinic_admin"] },
  { href: "/admin/super/ads",    label: "Reklamalar",       roles: ["super_admin"] },
  { href: "/reception",          label: "Qabulxona",       roles: ["clinic_admin", "branch_admin"] },
  { href: "/doctor",             label: "Navbat",          roles: ["clinic_admin", "branch_admin"] },
];

function isActive(itemHref: string, currentPath: string): boolean {
  if (itemHref === "/admin") return currentPath === "/admin";
  return currentPath === itemHref || currentPath.startsWith(itemHref + "/");
}

export default function AdminSidebar() {
  const path = usePathname();
  const { user, loading } = useCurrentUser();

  const items = loading || !user
    ? []
    : ALL_ADMIN_ITEMS.filter(
        (item) => !item.roles || item.roles.includes(user.role)
      );

  return (
    <aside className="w-56 flex-shrink-0 bg-white border-r border-gray-200 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto">
      <nav className="p-3 flex flex-col gap-0.5">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-9 bg-gray-100 rounded-lg animate-pulse" />
          ))
        ) : (
          items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive(item.href, path)
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              {item.label}
            </Link>
          ))
        )}
      </nav>
    </aside>
  );
}
