import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, unauthorized, forbidden, error } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth) return unauthorized();

  if (!["super_admin", "clinic_admin", "branch_admin"].includes(auth.role)) {
    return forbidden();
  }

  const clinicId = auth.clinicId;
  if (!clinicId) return error("Klinika aniqlanmadi", 400);

  let limits = await prisma.clinicShowcaseLimits.findUnique({ where: { clinicId } });
  if (!limits) {
    limits = await prisma.clinicShowcaseLimits.create({ data: { clinicId } });
  }

  return ok({ limits });
}
