"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { getRoleMeta } from "@/lib/roles";

interface NavItem {
  href: string;
  label: string;
}

function getRoleExtraItems(role: string): NavItem[] {
  const reception: NavItem = { href: "/admin/reception", label: "Qabulxona" };
  const doctor: NavItem    = { href: "/admin/doctor",    label: "Navbat" };
  switch (role) {
    case "clinic_admin":
    case "branch_admin":
      return [reception, doctor];
    default:
      return [];
  }
}

export default function Navbar({ items, title }: { items: NavItem[]; title: string }) {
  const path = usePathname();
  const router = useRouter();
  const { user, loading } = useCurrentUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_role");
    localStorage.removeItem("user_name");
    localStorage.removeItem("clinicId");
    localStorage.removeItem("branchId");
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {}
    router.push("/login");
  }

  const roleMeta = user ? getRoleMeta(user.role) : null;
  // Rol bo'yicha dinamik navlar; user yuklanmaguncha layout items'ni ko'rsat
  const navItems: NavItem[] = (user && items.length > 0)
    ? [...items, ...getRoleExtraItems(user.role).filter(
        (extra) => !items.some((it) => it.href === extra.href)
      )]
    : items;
  const clinicLabel =
    !user ? title
    : user.role === "super_admin" ? "Barcha klinikalar"
    : user.clinic?.name || title;
  const branchLabel = user?.branch?.name ?? null;

  return (
    <nav
      className="bg-white border-b border-gray-200 px-4 sm:px-6 py-0 flex items-center justify-between sticky top-0 z-30 h-14"
      style={roleMeta ? { borderTopColor: roleMeta.accentColor, borderTopWidth: 3 } : {}}
    >
      {/* CHAP — klinika nomi + nav links */}
      <div className="flex items-center gap-4 min-w-0 h-full">
        <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
          {loading ? (
            <div className="w-7 h-7 rounded-lg bg-gray-100 animate-pulse" />
          ) : user?.clinic?.logoUrl ? (
            <img
              src={user.clinic.logoUrl}
              alt=""
              className="w-7 h-7 rounded-lg object-cover flex-shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 text-sm select-none">
              {user?.role === "super_admin" ? "👑" : "🏥"}
            </div>
          )}
          <div className="min-w-0">
            {loading ? (
              <div className="h-4 w-28 bg-gray-100 rounded animate-pulse" />
            ) : (
              <>
                <p className="text-sm font-semibold text-gray-900 truncate leading-tight max-w-[140px] sm:max-w-[200px]">
                  {clinicLabel}
                </p>
                {branchLabel && (
                  <p className="text-xs text-gray-500 truncate leading-tight">
                    🏢 {branchLabel}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Nav links — rol bo'yicha dinamik */}
        <div className="flex items-center gap-1 h-full overflow-x-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-sm font-medium whitespace-nowrap px-2 py-1 rounded transition-colors ${
                path === item.href
                  ? "text-blue-600 bg-blue-50"
                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      {/* O'NG — rol badge + user dropdown */}
      <div className="flex items-center gap-2 ml-2 flex-shrink-0">
        {roleMeta && !loading && (
          <span
            className={`hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${roleMeta.badgeClass}`}
          >
            <span>{roleMeta.icon}</span>
            <span className="hidden md:inline">{roleMeta.label}</span>
          </span>
        )}

        {loading ? (
          <div className="w-8 h-8 rounded-full bg-gray-100 animate-pulse" />
        ) : (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-gray-100 transition"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
                style={{ backgroundColor: roleMeta?.accentColor ?? "#6b7280" }}
              >
                {user ? user.firstName.charAt(0).toUpperCase() : "?"}
              </div>
              <span className="hidden md:block text-sm text-gray-700 max-w-[100px] truncate">
                {user?.fullName ?? ""}
              </span>
              <span className="text-gray-400 text-xs">▾</span>
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 w-60 bg-white rounded-xl shadow-lg border border-gray-100 z-50 overflow-hidden">
                  {/* Ism + telefon + rol */}
                  <div className="p-3 border-b border-gray-100">
                    <p className="font-medium text-sm text-gray-900">{user?.fullName}</p>
                    {user?.phone && (
                      <p className="text-xs text-gray-500 mt-0.5">{user.phone}</p>
                    )}
                    {roleMeta && (
                      <span
                        className={`inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded text-xs font-medium ${roleMeta.badgeClass}`}
                      >
                        {roleMeta.icon} {roleMeta.label}
                      </span>
                    )}
                  </div>

                  {/* Klinika + filial */}
                  <div className="p-3 border-b border-gray-100">
                    <p className="text-xs text-gray-400 mb-0.5">Klinika</p>
                    <p className="text-sm text-gray-700">{clinicLabel}</p>
                    {user?.clinic?.city && (
                      <p className="text-xs text-gray-500">📍 {user.clinic.city}</p>
                    )}
                    {branchLabel && (
                      <>
                        <p className="text-xs text-gray-400 mb-0.5 mt-2">Filial</p>
                        <p className="text-sm text-gray-700">🏢 {branchLabel}</p>
                      </>
                    )}
                  </div>

                  {/* Profil havolasi */}
                  <Link
                    href="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="w-full px-3 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition flex items-center gap-2"
                  >
                    <span>👤</span>
                    <span>Profilim</span>
                  </Link>

                  {/* Chiqish */}
                  <button
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="w-full px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 transition flex items-center gap-2 disabled:opacity-50"
                  >
                    <span>⏻</span>
                    <span>{loggingOut ? "Chiqilmoqda..." : "Chiqish"}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
