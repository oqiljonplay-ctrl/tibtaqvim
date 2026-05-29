import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound } from "@/lib/api-response";

const TG_POST_RE = /^https:\/\/t\.me\/([A-Za-z0-9_]+)\/(\d+)$/;

function parseEmbed(postUrl: string): string | null {
  const m = postUrl.match(TG_POST_RE);
  if (!m) return null;
  return `${m[1]}/${m[2]}`;
}

async function getPromotion(id: string) {
  return prisma.clinicPromotion.findUnique({ where: { id } });
}

// PATCH /api/admin/promotions/[id]
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth(req);
  if (!auth) return unauthorized();
  if (!["super_admin", "clinic_admin", "branch_admin"].includes(auth.role)) return forbidden();

  try {
    const existing = await getPromotion(params.id);
    if (!existing) return notFound("Promotion topilmadi");

    if (auth.role !== "super_admin" && auth.clinicId !== existing.clinicId) return forbidden();

    const body = await req.json();
    const { postUrl } = body;

    const updateData: Record<string, unknown> = { ...body };
    delete updateData.clinicId;
    delete updateData.createdById;

    if (postUrl) {
      const embedId = parseEmbed(postUrl);
      if (!embedId) return error("postUrl noto'g'ri format. Misol: https://t.me/kanal/123", 400);
      updateData.embedId = embedId;
    }

    if (body.publishedAt) {
      updateData.publishedAt = new Date(body.publishedAt);
    }

    const updated = await prisma.clinicPromotion.update({
      where: { id: params.id },
      data: updateData as Parameters<typeof prisma.clinicPromotion.update>[0]["data"],
    });
    return ok(updated);
  } catch {
    return error("Server error", 500);
  }
}

// DELETE /api/admin/promotions/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAuth(req);
  if (!auth) return unauthorized();
  if (!["super_admin", "clinic_admin", "branch_admin"].includes(auth.role)) return forbidden();

  try {
    const existing = await getPromotion(params.id);
    if (!existing) return notFound("Promotion topilmadi");

    if (auth.role !== "super_admin" && auth.clinicId !== existing.clinicId) return forbidden();

    await prisma.clinicPromotion.delete({ where: { id: params.id } });
    return ok({ deleted: true });
  } catch {
    return error("Server error", 500);
  }
}
