import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, error, unauthorized, forbidden } from "@/lib/api-response";
import { assignTibId } from "@/lib/services/tib-id.service";
import { logger } from "@/lib/logger";

// POST /api/admin/backfill-tibid
// Finds all users with tibId=NULL and assigns unique tibIds.
// Only super_admin or clinic_admin can call this.
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth) return unauthorized();
  if (!["super_admin", "clinic_admin"].includes(auth.role)) return forbidden();

  try {
    const nullUsers = await prisma.user.findMany({
      where: { tibId: null },
      select: { id: true },
    });

    if (nullUsers.length === 0) {
      return ok({ fixed: 0, message: "Barcha userlarda tibId mavjud" });
    }

    let fixed = 0;
    const failed: string[] = [];

    for (const u of nullUsers) {
      const tibId = await assignTibId(u.id);
      if (tibId) {
        fixed++;
        logger.info("backfill-tibid: assigned", { userId: u.id, tibId });
      } else {
        failed.push(u.id);
        logger.error("backfill-tibid: failed", { userId: u.id });
      }
    }

    return ok({
      total: nullUsers.length,
      fixed,
      failed: failed.length,
      failedIds: failed,
    });
  } catch {
    return error("Server xatosi", 500);
  }
}

// GET — just count how many users have NULL tibId
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth) return unauthorized();
  if (!["super_admin", "clinic_admin"].includes(auth.role)) return forbidden();

  try {
    const count = await prisma.user.count({ where: { tibId: null } });
    return ok({ nullTibIdCount: count });
  } catch {
    return error("Server xatosi", 500);
  }
}
