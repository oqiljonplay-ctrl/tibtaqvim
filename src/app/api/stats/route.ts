import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { getStatsScope } from "@/lib/stats/access";
import { fetchKpi } from "@/lib/stats/queries";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["super_admin", "clinic_admin", "doctor"];

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!ALLOWED_ROLES.includes(auth.role)) {
      return NextResponse.json({ error: "Statistika ko'rishga ruxsat yo'q" }, { status: 403 });
    }

    let doctorId: string | null = null;
    if (auth.role === "doctor") {
      const doctor = await prisma.doctor.findFirst({
        where: { userId: auth.userId, ...(auth.clinicId ? { clinicId: auth.clinicId } : {}) },
        select: { id: true },
      });
      doctorId = doctor?.id ?? null;
      if (!doctorId) {
        return NextResponse.json({ error: "Doctor profili topilmadi" }, { status: 403 });
      }
    }

    const scope = getStatsScope({ role: auth.role, clinicId: auth.clinicId, doctorId });

    if (scope.role === "denied") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const kpi = await fetchKpi(scope);

    return NextResponse.json({
      scope: { role: scope.role, clinicId: scope.clinicId },
      kpi,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[/api/stats] error:", err);
    return NextResponse.json({ error: "Server xatosi" }, { status: 500 });
  }
}
