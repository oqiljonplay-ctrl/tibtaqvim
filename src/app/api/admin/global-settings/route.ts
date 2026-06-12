import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, serverError } from "@/lib/api-response";

const ALLOWED_KEYS = ["ratingEditWindow"] as const;

// GET /api/admin/global-settings — ratingEditWindow, ratingPrior (super_admin only)
export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (auth.role !== "super_admin") return forbidden();

    const rows = await prisma.globalSetting.findMany({
      where: { key: { in: ["ratingEditWindow", "ratingPrior"] } },
    });

    const map: Record<string, unknown> = {};
    for (const r of rows) map[r.key] = r.value;

    return ok({
      ratingEditWindow: (map.ratingEditWindow ?? { enabled: false, hours: 24 }) as { enabled: boolean; hours: number },
      ratingPrior:      (map.ratingPrior ?? { value: 4.5, dynamic: true, threshold: 100, isReal: false }) as {
        value: number; dynamic: boolean; threshold: number; isReal: boolean;
      },
    });
  } catch {
    return serverError();
  }
}

// PATCH /api/admin/global-settings — faqat ruxsatli key'lar
export async function PATCH(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (auth.role !== "super_admin") return forbidden();

    let body: unknown;
    try { body = await req.json(); } catch { return error("JSON format noto'g'ri", 400); }

    const { key, value } = body as Record<string, unknown>;

    if (!key || !ALLOWED_KEYS.includes(key as typeof ALLOWED_KEYS[number])) {
      return error(`Faqat ruxsat etilgan key'lar: ${ALLOWED_KEYS.join(", ")}`, 400);
    }

    if (key === "ratingEditWindow") {
      const v = value as Record<string, unknown>;
      if (typeof v?.enabled !== "boolean") return error("enabled boolean bo'lishi kerak", 400);
      if (typeof v?.hours !== "number" || !Number.isInteger(v.hours) || v.hours < 1 || v.hours > 168)
        return error("hours 1–168 oralig'ida butun son bo'lishi kerak", 400);
    }

    const updated = await prisma.globalSetting.upsert({
      where: { key: key as string },
      update: { value: value as object },
      create: { key: key as string, value: value as object },
    });

    return ok({ key: updated.key, value: updated.value });
  } catch {
    return serverError();
  }
}
