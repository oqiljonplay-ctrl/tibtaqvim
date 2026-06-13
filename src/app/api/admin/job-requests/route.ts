import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, error, unauthorized, forbidden } from "@/lib/api-response";

// GET /api/admin/job-requests — shu klinikaning pending so'rovlari
export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (!["super_admin", "clinic_admin", "branch_admin"].includes(auth.role)) return forbidden();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? "pending";
    const clinicId = auth.role === "super_admin"
      ? (searchParams.get("clinicId") ?? auth.clinicId)
      : auth.clinicId;
    if (!clinicId) return error("clinicId required");

    const requests = await prisma.jobRequest.findMany({
      where: { clinicId, status },
      include: {
        employee: {
          select: {
            id: true, emId: true,
            firstName: true, lastName: true,
            photoUrl: true, specialty: true, phone: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return ok(requests);
  } catch {
    return error("Server xatosi", 500);
  }
}
