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
  const blocks = await prisma.showcaseBlock.findMany({
    where: { id: { in: ids } },
    select: { id: true, clinicId: true },
  });
  if (auth.role !== "super_admin" && blocks.some((b) => b.clinicId !== auth.clinicId))
    return forbidden();
  await prisma.$transaction(
    updates.map((u: { id: string; sortOrder: number }) =>
      prisma.showcaseBlock.update({
        where: { id: String(u.id) },
        data: { sortOrder: Number(u.sortOrder) },
      })
    )
  );
  await createAuditLog(
    auth.userId,
    "showcase.sort_updated",
    { type: "block", count: updates.length },
    blocks[0]?.clinicId ?? undefined
  );
  return ok({ updated: updates.length });
}
