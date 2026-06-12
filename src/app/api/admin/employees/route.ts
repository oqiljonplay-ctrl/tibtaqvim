import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api-response";

// GET /api/admin/employees — barcha xodimlar ro'yxati (super_admin only)
export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (auth.role !== "super_admin") return forbidden();

    const employees = await prisma.employee.findMany({
      where: { isActive: true },
      orderBy: { emId: "asc" },
      select: {
        id: true,
        emId: true,
        firstName: true,
        lastName: true,
        profession: true,
        maxClinics: true,
        _count: { select: { stints: { where: { endDate: null } } } },
      },
    });

    return ok(
      employees.map((e) => ({
        id:            e.id,
        emId:          e.emId,
        firstName:     e.firstName,
        lastName:      e.lastName,
        profession:    e.profession,
        maxClinics:    e.maxClinics,
        activeStints:  e._count.stints,
      }))
    );
  } catch {
    return serverError();
  }
}
