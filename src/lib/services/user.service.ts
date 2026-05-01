import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/utils/phone";
import { assignTibId } from "@/lib/services/tib-id.service";
import { logger } from "@/lib/logger";

export interface ResolvedUser {
  id: string;
  phone: string | null;
  tibId: string | null;
  firstName: string;
  hasPhone: boolean;
}

// Universal user resolver — used in ALL places: bot, webapp, API routes.
// Priority: telegramId → phone → create.
// Safe against concurrent requests (P2002 retry).
// tibId is ALWAYS assigned atomically on creation — user never saved with tibId=NULL.
export async function getOrCreateUser(opts: {
  telegramId?: string | null;
  phone?: string | null;
  firstName?: string;
  clinicId?: string | null;
}): Promise<ResolvedUser> {
  const { firstName = "—", clinicId = null } = opts;
  const tgId = opts.telegramId ? String(opts.telegramId) : null;
  const normalized = opts.phone ? normalizePhone(opts.phone) : null;

  let user = await _findExisting(tgId, normalized);

  if (user) {
    const updates: Record<string, string | null> = {};
    if (!user.phone && normalized) updates.phone = normalized;
    if (!user.telegramId && tgId) updates.telegramId = tgId;
    if ((!user.firstName || user.firstName === "—") && firstName !== "—")
      updates.firstName = firstName.trim();

    if (Object.keys(updates).length > 0) {
      try {
        user = await prisma.user.update({ where: { id: user.id }, data: updates });
      } catch {
        user = (await _findExisting(tgId, normalized)) ?? user;
      }
    }

    // Backfill: existing user somehow has no tibId — assign now
    if (!user.tibId) {
      const tibId = await assignTibId(user.id);
      logger.info("tibId backfilled for existing user", { userId: user.id, tibId });
      user = { ...user, tibId };
    }
  } else {
    // Two-step creation — pgBouncer transaction-pooling safe.
    // Step 1: create user. Step 2: assign tibId via unique-retry loop.
    // No $transaction needed — each step is its own atomic DB operation.
    try {
      const newUser = await prisma.user.create({
        data: {
          phone: normalized,
          firstName: firstName.trim() || "—",
          telegramId: tgId,
          clinicId: clinicId || null,
          role: "patient",
        },
      });
      const tibId = await assignTibId(newUser.id);
      logger.info("User created with tibId", { userId: newUser.id, tibId });
      user = { ...newUser, tibId };
    } catch (err: any) {
      if (err?.code === "P2002") {
        // Concurrent creation race — find whichever insert won
        user = await _findExisting(tgId, normalized);
        if (!user) throw new Error("Concurrent user creation conflict");
      } else {
        throw err;
      }
    }
  }

  if (!user) throw new Error("User resolution failed");

  // Link all unlinked appointments where patientPhone matches.
  // Runs after every getOrCreateUser call — handles the race where
  // linkUserToAppointment() ran before the user existed in DB.
  if (user.phone) {
    prisma.appointment.updateMany({
      where: { patientPhone: user.phone, userId: null },
      data: { userId: user.id },
    }).catch(() => {});
  }

  return {
    id: user.id,
    phone: user.phone,
    tibId: user.tibId,
    firstName: user.firstName,
    hasPhone: !!user.phone,
  };
}

async function _findExisting(tgId: string | null, phone: string | null) {
  if (tgId) {
    const u = await prisma.user.findUnique({ where: { telegramId: tgId } });
    if (u) return u;
  }
  if (phone) {
    const u = await prisma.user.findFirst({ where: { phone } });
    if (u) return u;
  }
  return null;
}
