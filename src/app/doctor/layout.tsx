"use client";
import { useEffect, useState } from "react";
import Navbar from "@/components/ui/Navbar";
import { Container } from "@/components/layout";

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  const [invitationCount, setInvitationCount] = useState(0);

  useEffect(() => {
    async function fetchCount() {
      try {
        const res = await fetch("/api/doctor/clinic-invitations?count=1");
        const j = await res.json();
        if (j.success) setInvitationCount(j.data.count ?? 0);
      } catch {}
    }
    fetchCount();
    const interval = setInterval(fetchCount, 60_000);

    function onInvitationUpdated() { fetchCount(); }
    window.addEventListener("invitation-updated", onInvitationUpdated);

    return () => {
      clearInterval(interval);
      window.removeEventListener("invitation-updated", onInvitationUpdated);
    };
  }, []);

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      <Navbar
        title="Shifokor Panel"
        items={[
          { href: "/doctor", label: "👨‍⚕️ Navbat" },
          { href: "/doctor/profile", label: "📋 Profil" },
          { href: "/doctor/stats", label: "📊 Statistika" },
          { href: "/doctor/invitations", label: "📬 Takliflar", badge: invitationCount },
        ]}
      />
      <Container size="xl" className="py-6">{children}</Container>
    </div>
  );
}
