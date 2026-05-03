// DB-backed bot state — Vercel serverless cold start'larga bardoshli
// In-memory Map o'rnida PostgreSQL bot_states jadvali ishlatiladi

import { prisma } from "@/lib/prisma";

const TTL_MS = 30 * 60 * 1000; // 30 daqiqa

export async function getState(chatId: number): Promise<any> {
  try {
    const row = await prisma.botState.findUnique({
      where: { telegramId: String(chatId) },
    });
    if (!row) return undefined;
    if (row.expiresAt < new Date()) {
      prisma.botState.delete({ where: { telegramId: String(chatId) } }).catch(() => {});
      return undefined;
    }
    return row.data as any;
  } catch {
    return undefined;
  }
}

export async function setState(chatId: number, state: any): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + TTL_MS);
    await prisma.botState.upsert({
      where: { telegramId: String(chatId) },
      create: {
        telegramId: String(chatId),
        step: state?.step || "unknown",
        data: state,
        expiresAt,
      },
      update: {
        step: state?.step || "unknown",
        data: state,
        expiresAt,
        updatedAt: new Date(),
      },
    });
  } catch {}
}

export async function deleteState(chatId: number): Promise<void> {
  try {
    await prisma.botState.delete({ where: { telegramId: String(chatId) } });
  } catch {}
}

let cleanupCounter = 0;
export async function maybeCleanup(): Promise<void> {
  cleanupCounter++;
  if (cleanupCounter % 100 !== 0) return;
  try {
    await prisma.$executeRaw`SELECT cleanup_expired_bot_states()`;
  } catch {}
}
