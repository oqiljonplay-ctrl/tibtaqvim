import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, error, unauthorized, forbidden } from "@/lib/api-response";
import { assignTibId } from "@/lib/services/tib-id.service";
import { logger } from "@/lib/logger";

// POST /api/admin/backfill-tibid
// 1. Assigns tibId to all users with tibId=NULL
// 2. Links userId on appointments where patientPhone matches a user but userId is NULL
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth) return unauthorized();
  if (!["super_admin", "clinic_admin"].includes(auth.role)) return forbidden();

  try {
    // ── Step 1: backfill tibId ────────────────────────────────────────────────
    const nullTibUsers = await prisma.user.findMany({
      where: { tibId: null },
      select: { id: true },
    });

    let tibFixed = 0;
    for (const u of nullTibUsers) {
      const tibId = await assignTibId(u.id);
      if (tibId) {
        tibFixed++;
        logger.info("backfill-tibid: assigned", { userId: u.id, tibId });
      }
    }

    // ── Step 2: link userId on unlinked appointments ──────────────────────────
    // Find all appointments with userId=NULL that have a matching user by phone
    const unlinked = await prisma.appointment.findMany({
      where: { userId: null, patientPhone: { not: "" } },
      select: { id: true, patientPhone: true },
    });

    let apptFixed = 0;
    for (const appt of unlinked) {
      if (!appt.patientPhone) continue;
      const user = await prisma.user.findFirst({
        where: { phone: appt.patientPhone },
        select: { id: true },
      });
      if (!user) continue;
      await prisma.appointment.update({
        where: { id: appt.id },
        data: { userId: user.id },
      });
      apptFixed++;
      logger.info("backfill-tibid: appt linked", { apptId: appt.id, userId: user.id });
    }

    return ok({
      tibId: { total: nullTibUsers.length, fixed: tibFixed },
      appointments: { total: unlinked.length, fixed: apptFixed },
    });
  } catch {
    return error("Server xatosi", 500);
  }
}

// GET — stats: how many users/appointments still need backfill
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth) return unauthorized();
  if (!["super_admin", "clinic_admin"].includes(auth.role)) return forbidden();

  try {
    const [nullTibId, nullUserId] = await Promise.all([
      prisma.user.count({ where: { tibId: null } }),
      prisma.appointment.count({ where: { userId: null } }),
    ]);
    return ok({ nullTibIdUsers: nullTibId, nullUserIdAppointments: nullUserId });
  } catch {
    return error("Server xatosi", 500);
  }
}
