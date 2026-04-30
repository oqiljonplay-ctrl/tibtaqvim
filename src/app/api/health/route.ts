import { prisma } from "@/lib/prisma";
import { ok, error } from "@/lib/api-response";

const startedAt = Date.now();

export async function GET() {
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    return ok({
      status: "ok",
      db: "connected",
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startedAt) / 1000),
      environment: process.env.NODE_ENV ?? "development",
      version: process.env.npm_package_version ?? "1.0.0",
    });
  } catch {
    return error("DB ulanmadi", 503);
  }
}
