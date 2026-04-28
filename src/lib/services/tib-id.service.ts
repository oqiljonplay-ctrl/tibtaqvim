import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { normalizePhone } from "@/lib/utils/phone";

function formatTibId(n: number): string {
  return "tib" + String(n).padStart(6, "0");
}

// ─── In-memory cache (TTL: 2 daqiqa) ─────────────────────────────────────────
const CACHE_TTL = 2 * 60 * 1000;
interface CacheEntry { tibId: string; expiry: number }
const tibCache = new Map<string, CacheEntry>();

function getCache(key: string): string | null {
  const entry = tibCache.get(key);
  if (!entry) return null;
  if (entry.expiry < Date.now()) { tibCache.delete(key); return null; }
  return entry.tibId;
}

function setCache(key: string, tibId: string): void {
  tibCache.set(key, { tibId, expiry: Date.now() + CACHE_TTL });
}

// ─── Assignment ───────────────────────────────────────────────────────────────

// Concurrent-safe: unique constraint retry
export async function assignTibId(userId: string): Promise<string | null> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { tibId: true },
  });
  if (existing?.tibId) return existing.tibId;

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const count = await prisma.user.count({ where: { tibId: { not: null } } });
      const tibId = formatTibId(count + 1);
      await prisma.user.update({ where: { id: userId }, data: { tibId } });
      logger.info("tibId assigned", { userId, tibId });
      return tibId;
    } catch (err: any) {
      if (err?.code === "P2002" && attempt < 4) continue;
      logger.error("assignTibId failed", { userId, error: String(err) });
      return null;
    }
  }
  return null;
}

// ─── Lookups (with cache) ──────────────────────────────────────────────────────

export async function getTibIdByPhone(phone: string): Promise<string | null> {
  const normalized = normalizePhone(phone);
  const cacheKey = `phone:${normalized}`;

  const cached = getCache(cacheKey);
  if (cached) return cached;

  const user = await prisma.user.findFirst({
    where: { phone: normalized },
    select: { id: true, tibId: true },
  });
  if (!user) return null;

  const tibId = user.tibId ?? await assignTibId(user.id);
  if (tibId) setCache(cacheKey, tibId);
  return tibId;
}

export async function getTibIdByTelegramId(telegramId: string): Promise<string | null> {
  const cacheKey = `tg:${telegramId}`;

  const cached = getCache(cacheKey);
  if (cached) return cached;

  const user = await prisma.user.findUnique({
    where: { telegramId },
    select: { id: true, tibId: true },
  });
  if (!user) return null;

  const tibId = user.tibId ?? await assignTibId(user.id);
  if (tibId) setCache(cacheKey, tibId);
  return tibId;
}
