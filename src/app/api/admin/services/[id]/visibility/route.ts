import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound, serverError } from "@/lib/api-response";
import { canManageResources } from "@/lib/branch-scope";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (!canManageResources(auth)) return forbidden();

    const service = await prisma.service.findUnique({ where: { id: params.id } });
    if (!service) return notFound();
    if (auth.role !== "super_admin" && service.clinicId !== auth.clinicId) return forbidden();
    if (auth.role === "branch_admin" && service.branchId !== auth.branchId) return forbidden();

    const body = await req.json();
    if (typeof body.isHidden !== "boolean") {
      return error("isHidden boolean bo'lishi kerak");
    }

    const updated = await prisma.service.update({
      where: { id: params.id },
      data: { isHidden: body.isHidden },
      select: { id: true, isHidden: true },
    });

    return ok(updated);
  } catch {
    return serverError();
  }
}
