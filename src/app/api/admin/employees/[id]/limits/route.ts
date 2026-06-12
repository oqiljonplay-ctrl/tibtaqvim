import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound, serverError } from "@/lib/api-response";
import { createAuditLog } from "@/lib/services/config.service";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/admin/employees/[id]/limits — maxClinics yangilash (super_admin only)
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (auth.role !== "super_admin") return forbidden();

    const { id: employeeId } = await params;

    let body: unknown;
    try { body = await req.json(); } catch { return error("JSON format noto'g'ri", 400); }

    const { maxClinics } = body as Record<string, unknown>;
    if (typeof maxClinics !== "number" || !Number.isInteger(maxClinics) || maxClinics < 1 || maxClinics > 10)
      return error("maxClinics 1 dan 10 gacha butun son bo'lishi kerak", 400);

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return notFound("Xodim topilmadi");

    const updated = await prisma.employee.update({
      where: { id: employeeId },
      data: { maxClinics },
      select: { id: true, emId: true, firstName: true, lastName: true, maxClinics: true },
    });

    await createAuditLog(
      auth.userId,
      "employee.limits_updated",
      { employeeId, oldMaxClinics: employee.maxClinics, newMaxClinics: maxClinics },
      undefined
    ).catch(() => {});

    return ok(updated);
  } catch {
    return serverError();
  }
}
