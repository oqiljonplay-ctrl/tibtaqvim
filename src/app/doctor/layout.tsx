import Navbar from "@/components/ui/Navbar";
import { Container } from "@/components/layout";

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-gray-50">
      <Navbar title="Shifokor Panel" items={[{ href: "/doctor", label: "👨‍⚕️ Navbat" }, { href: "/doctor/profile", label: "📋 Profil" }]} />
      <Container size="xl" className="py-6">{children}</Container>
    </div>
  );
}
