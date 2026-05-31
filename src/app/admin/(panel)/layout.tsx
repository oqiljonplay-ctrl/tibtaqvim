import Navbar from "@/components/ui/Navbar";
import AdminSidebar from "@/components/ui/AdminSidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-[100dvh] bg-gray-50">
      <Navbar title="Admin Panel" items={[]} />
      <div className="flex flex-1">
        <AdminSidebar />
        <main className="flex-1 min-w-0 px-4 md:px-6 py-4 md:py-6">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
