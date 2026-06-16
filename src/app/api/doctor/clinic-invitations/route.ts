import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, error, unauthorized, forbidden } from "@/lib/api-response";

// GET /api/doctor/clinic-invitations — klinikadan kelgan takliflar (initiatedBy='clinic', pending)
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth) return unauthorized();
  if (auth.role !== "doctor") return forbidden();

  const employee = await prisma.employee.findUnique({
    where: { userId: auth.userId },
    select: { id: true },
  });
  if (!employee) return error("Xodim topilmadi", 404);

  const { searchParams } = new URL(req.url);
  const countOnly = searchParams.get("count") === "1";

  if (countOnly) {
    const count = await prisma.jobRequest.count({
      where: { employeeId: employee.id, initiatedBy: "clinic", status: "pending" },
    });
    return ok({ count });
  }

  const invitations = await prisma.jobRequest.findMany({
    where: { employeeId: employee.id, initiatedBy: "clinic" },
    include: {
      clinic: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
          address: true,
          city: true,
          workingHours: true,
          phone: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return ok(invitations);
}
