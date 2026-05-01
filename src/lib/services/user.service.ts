import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/utils/phone";
import { assignTibId } from "@/lib/services/tib-id.service";

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
  } else {
    try {
      user = await prisma.user.create({
        data: {
          phone: normalized,
          firstName: firstName.trim() || "—",
          telegramId: tgId,
          clinicId: clinicId || null,
          role: "patient",
        },
      });
    } catch (err: any) {
      if (err?.code === "P2002") {
        user = await _findExisting(tgId, normalized);
        if (!user) throw new Error("Concurrent user creation conflict");
      } else {
        throw err;
      }
    }
  }

  if (!user) throw new Error("User resolution failed");

  const tibId = user.tibId ?? (await assignTibId(user.id));
  return {
    id: user.id,
    phone: user.phone,
    tibId,
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
