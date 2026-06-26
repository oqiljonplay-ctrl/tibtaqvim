"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function ActingClinicBanner() {
  const [role, setRole] = useState<string | null>(null);
  const [actingName, setActingName] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const r = localStorage.getItem("user_role");
    setRole(r);
    if (r === "super_admin") {
      const cname = localStorage.getItem("acting_clinic_name");
      setActingName(cname || null);
    }
  }, []);

  if (!mounted || role !== "super_admin") return null;

  return (
    <div className={`flex items-center justify-between px-4 py-2 text-xs font-medium border-b ${
      actingName
        ? "bg-amber-50 border-amber-200 text-amber-800"
        : "bg-blue-50 border-blue-200 text-blue-700"
    }`}>
      <div className="flex items-center gap-2">
        <span>{actingName ? "🏥" : "🌐"}</span>
        <span>
          {actingName
            ? `${actingName} — tahrirlash yoniq`
            : "Barcha klinikalar — faqat ko'rish"}
        </span>
      </div>
      <Link
        href="/admin/super"
        className={`underline underline-offset-2 hover:opacity-70 transition-opacity ${
          actingName ? "text-amber-700" : "text-blue-600"
        }`}
      >
        Boshqaruv xonasi →
      </Link>
    </div>
  );
}
