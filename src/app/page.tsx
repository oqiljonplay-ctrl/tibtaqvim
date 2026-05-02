"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const roleHome: Record<string, string> = {
  super_admin: "/admin",
  clinic_admin: "/admin",
  doctor: "/doctor",
  receptionist: "/reception",
};

const roleLabel: Record<string, string> = {
  super_admin: "Super Admin",
  clinic_admin: "Admin",
  doctor: "Shifokor",
  receptionist: "Qabulxona",
};

export default function HomePage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [currentName, setCurrentName] = useState("");

  useEffect(() => {
    const role = localStorage.getItem("user_role");
    const name = localStorage.getItem("user_name") || "";
    if (role && roleHome[role]) {
      router.push(roleHome[role]);
    } else {
      setCurrentRole(role);
      setCurrentName(name);
      setChecking(false);
    }
  }, [router]);

  function logout() {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_role");
    localStorage.removeItem("user_name");
    localStorage.removeItem("clinicId");
    document.cookie = "auth_token=; path=/; max-age=0";
    setCurrentRole(null);
    setCurrentName("");
  }

  if (checking) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400 text-sm">Yuklanmoqda...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="text-center max-w-2xl">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">ClinicBot</h1>
        <p className="text-lg text-gray-500 mb-10">Ko'p klinikali boshqaruv tizimi</p>

        {currentRole && (
          <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-between">
            <span className="text-sm text-blue-800">
              Kirgan: <strong>{currentName}</strong> ({roleLabel[currentRole] || currentRole})
            </span>
            <button
              onClick={logout}
              className="text-sm text-red-500 hover:text-red-700 font-medium ml-4 transition-colors"
            >
              Chiqish
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link href="/admin" className="card hover:shadow-md transition-shadow cursor-pointer text-center">
            <div className="text-3xl mb-3">🏥</div>
            <h2 className="font-semibold text-gray-900">Admin Panel</h2>
            <p className="text-sm text-gray-500 mt-1">Klinikalar, xizmatlar boshqaruvi</p>
          </Link>

          <Link href="/doctor" className="card hover:shadow-md transition-shadow cursor-pointer text-center">
            <div className="text-3xl mb-3">👨‍⚕️</div>
            <h2 className="font-semibold text-gray-900">Shifokor Panel</h2>
            <p className="text-sm text-gray-500 mt-1">Bugungi bemorlar ro'yxati</p>
          </Link>

          <Link href="/reception" className="card hover:shadow-md transition-shadow cursor-pointer text-center">
            <div className="text-3xl mb-3">📋</div>
            <h2 className="font-semibold text-gray-900">Qabulxona</h2>
            <p className="text-sm text-gray-500 mt-1">Navbat va kelish boshqaruvi</p>
          </Link>
        </div>

        <div className="mt-8 text-sm text-gray-400">
          <span>API: </span>
          <code className="bg-gray-100 px-2 py-1 rounded">/api/services · /api/book · /api/appointments</code>
        </div>
      </div>
    </main>
  );
}
