import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, error, unauthorized, forbidden } from "@/lib/api-response";

// GET /api/admin/job-requests/count — pending so'rovlar soni (sidebar badge uchun)
export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (!["super_admin", "clinic_admin", "branch_admin"].includes(auth.role)) return forbidden();

    const clinicId = auth.role === "super_admin"
      ? new URL(req.url).searchParams.get("clinicId") ?? auth.clinicId
      : auth.clinicId;
    if (!clinicId) return ok({ count: 0 });

    // Faqat xodim boshlagan so'rovlar (admin harakat qilishi kerak bo'lganlar)
    const count = await prisma.jobRequest.count({ where: { clinicId, status: "pending", initiatedBy: "employee" } });
    return ok({ count });
  } catch {
    return error("Server xatosi", 500);
  }
}
