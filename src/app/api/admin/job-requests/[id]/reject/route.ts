import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound } from "@/lib/api-response";

type Params = { params: { id: string } };

// POST /api/admin/job-requests/[id]/reject
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (!["super_admin", "clinic_admin", "branch_admin"].includes(auth.role)) return forbidden();

    const jobRequest = await prisma.jobRequest.findUnique({ where: { id: params.id } });
    if (!jobRequest) return notFound("So'rov topilmadi");
    if (jobRequest.status !== "pending") return error("So'rov allaqachon ko'rib chiqilgan", 400);
    if (auth.role !== "super_admin" && jobRequest.clinicId !== auth.clinicId) return forbidden();

    await prisma.jobRequest.update({
      where: { id: params.id },
      data: { status: "rejected", decidedBy: auth.userId, decidedAt: new Date() },
    });

    return ok({ rejected: true });
  } catch {
    return error("Server xatosi", 500);
  }
}
