import Navbar from "@/components/ui/Navbar";
import { Container } from "@/components/layout";
import ActingClinicBanner from "@/components/auth/ActingClinicBanner";

export default function ReceptionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-gray-50">
      <Navbar title="Qabulxona" items={[{ href: "/reception", label: "💰 Qabulxona" }]} />
      <ActingClinicBanner />
      <Container size="xl" className="py-6">{children}</Container>
    </div>
  );
}
