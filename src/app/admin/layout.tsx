import Navbar from "@/components/ui/Navbar";

const navItems = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/services", label: "Xizmatlar" },
  { href: "/admin/doctors", label: "Shifokorlar" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar title="Admin Panel" items={navItems} />
      <div className="max-w-7xl mx-auto px-4 py-6">{children}</div>
    </div>
  );
}
