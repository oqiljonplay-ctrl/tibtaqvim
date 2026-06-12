import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

/** Tranzaksiya ICHIDA yangi EM id oladi. tx — Prisma transaction client. */
export async function nextEmId(tx: { $queryRaw: typeof prisma.$queryRaw }): Promise<string> {
  const rows = await tx.$queryRaw<[{ next_em_id: string }]>`SELECT next_em_id()`;
  const emId = rows[0]?.next_em_id;
  if (!emId) throw new Error("next_em_id() returned null");
  logger.info("nextEmId generated", { emId });
  return emId;
}

/** userId bo'yicha employee topadi (login EM bosqichi uchun). */
export async function getEmployeeByUserId(userId: string) {
  return prisma.employee.findUnique({ where: { userId } });
}

/** Kiritilgan EM id'ni normallashtiradi: "em1", " Em000001 " → "EM000001". */
export function normalizeEmId(raw: string): string {
  const t = raw.trim().toUpperCase();
  const m = t.match(/^EM0*(\d+)$/);
  if (!m) return t;
  const n = m[1];
  return "EM" + (n.length >= 6 ? n : n.padStart(6, "0"));
}
