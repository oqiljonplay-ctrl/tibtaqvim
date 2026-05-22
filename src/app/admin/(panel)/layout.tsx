"use client";
import { useEffect, useState } from "react";
import Navbar from "@/components/ui/Navbar";

const allNavItems = [
  { href: "/admin",          label: "Dashboard" },
  { href: "/admin/services", label: "Xizmatlar" },
  { href: "/admin/doctors",  label: "Shifokorlar" },
  { href: "/admin/branches", label: "Filiallar",  roles: ["super_admin", "clinic_admin"] },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    setRole(localStorage.getItem("user_role"));
  }, []);

  const navItems = allNavItems.filter(
    (item) => !item.roles || (role && item.roles.includes(role))
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar title="Admin Panel" items={navItems} />
      <div className="max-w-7xl mx-auto px-4 py-6">{children}</div>
    </div>
  );
}
