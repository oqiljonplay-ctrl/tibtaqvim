import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, error, unauthorized, forbidden } from "@/lib/api-response";
import { canManageResources } from "@/lib/branch-scope";
import { createAuditLog } from "@/lib/services/config.service";

export async function PATCH(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth) return unauthorized();
  if (!canManageResources(auth)) return forbidden();
  const { updates } = await req.json();
  if (!Array.isArray(updates) || !updates.length) return error("updates kerak", 400);
  const ids = updates.map((u: { id: string }) => String(u.id));
  const items = await prisma.showcaseMedia.findMany({
    where: { id: { in: ids } },
    include: { block: { select: { clinicId: true } } },
  });
  if (auth.role !== "super_admin" && items.some((m) => m.block.clinicId !== auth.clinicId))
    return forbidden();
  await prisma.$transaction(
    updates.map((u: { id: string; sortOrder: number }) =>
      prisma.showcaseMedia.update({
        where: { id: String(u.id) },
        data: { sortOrder: Number(u.sortOrder) },
      })
    )
  );
  await createAuditLog(
    auth.userId,
    "showcase.sort_updated",
    { type: "media", count: updates.length },
    items[0]?.block.clinicId ?? undefined
  );
  return ok({ updated: updates.length });
}
