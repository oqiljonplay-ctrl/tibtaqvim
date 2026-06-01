import KpiCards from "@/components/stats/KpiCards";
import ChartsSection from "./components/ChartsSection";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["super_admin", "clinic_admin", "doctor"];

export default async function StatsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) redirect("/login");

  const payload = verifyToken(token);
  if (!payload) redirect("/login");

  if (!ALLOWED_ROLES.includes(payload.role)) redirect("/");

  const subtitle =
    payload.role === "super_admin" ? "Barcha klinikalar bo'yicha" :
    payload.role === "clinic_admin" ? "Sizning klinikangiz bo'yicha" :
    "Sizning bemorlar va qabullar";

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">📊 Statistika</h1>
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          </div>
          <Link
            href="/"
            className="px-4 py-2 min-h-[44px] flex items-center bg-white border border-gray-300 rounded-md text-sm hover:bg-gray-50 transition"
          >
            ← Asosiy sahifa
          </Link>
        </div>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Asosiy ko'rsatkichlar</h2>
          <KpiCards />
        </section>

        <section className="mb-8">
          {(payload.role === "super_admin" || payload.role === "clinic_admin") ? (
            <ChartsSection />
          ) : (
            <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">
              📈 Grafiklar va tahlillar — keyingi bosqichda qo'shiladi
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
