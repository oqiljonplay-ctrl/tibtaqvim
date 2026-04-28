import Navbar from "@/components/ui/Navbar";

export default function ReceptionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar title="Qabulxona" items={[{ href: "/reception", label: "Navbat ro'yxati" }]} />
      <div className="max-w-5xl mx-auto px-4 py-6">{children}</div>
    </div>
  );
}
