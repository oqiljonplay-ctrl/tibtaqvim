import Navbar from "@/components/ui/Navbar";

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar title="Shifokor Panel" items={[{ href: "/doctor", label: "Bugungi navbat" }]} />
      <div className="max-w-4xl mx-auto px-4 py-6">{children}</div>
    </div>
  );
}
