import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, created, error, unauthorized, forbidden } from "@/lib/api-response";

const TG_POST_RE = /^https:\/\/t\.me\/([A-Za-z0-9_]+)\/(\d+)$/;

function parseEmbed(postUrl: string): string | null {
  const m = postUrl.match(TG_POST_RE);
  if (!m) return null;
  return `${m[1]}/${m[2]}`;
}

function resolveClinicId(auth: { role: string; clinicId: string | null }, queryClinicId: string | null): string | null {
  if (auth.role === "super_admin") return queryClinicId;
  return auth.clinicId;
}

// GET /api/admin/promotions?clinicId=
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth) return unauthorized();
  if (!["super_admin", "clinic_admin", "branch_admin"].includes(auth.role)) return forbidden();

  const { searchParams } = new URL(req.url);
  const clinicId = resolveClinicId(auth, searchParams.get("clinicId"));

  try {
    const promotions = await prisma.clinicPromotion.findMany({
      where: clinicId ? { clinicId } : undefined,
      orderBy: [{ sortOrder: "asc" }, { publishedAt: "desc" }],
    });
    return ok(promotions);
  } catch {
    return error("Server error", 500);
  }
}

// POST /api/admin/promotions
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth) return unauthorized();
  if (!["super_admin", "clinic_admin", "branch_admin"].includes(auth.role)) return forbidden();

  try {
    const body = await req.json();
    const { postUrl, type, source, title, subscribeUsername, showSubscribeButton, isActive, sortOrder, publishedAt } = body;
    let { clinicId } = body;

    if (auth.role !== "super_admin") {
      clinicId = auth.clinicId;
    }
    if (!clinicId) return error("clinicId majburiy", 400);

    if (auth.role !== "super_admin" && auth.clinicId !== clinicId) return forbidden();

    if (!postUrl) return error("postUrl majburiy", 400);
    const embedId = parseEmbed(postUrl);
    if (!embedId) return error("postUrl noto'g'ri format. Misol: https://t.me/kanal/123", 400);

    const promotion = await prisma.clinicPromotion.create({
      data: {
        clinicId,
        postUrl,
        embedId,
        type: type ?? "umumiy",
        source: source ?? "kanal",
        title: title ?? null,
        subscribeUsername: subscribeUsername ?? null,
        showSubscribeButton: showSubscribeButton ?? true,
        isActive: isActive ?? true,
        sortOrder: sortOrder ?? 0,
        publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
        createdById: auth.userId,
      },
    });
    return created(promotion);
  } catch {
    return error("Server error", 500);
  }
}
