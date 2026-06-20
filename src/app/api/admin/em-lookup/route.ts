import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound } from "@/lib/api-response";
import { canManageResources } from "@/lib/branch-scope";
import { normalizeEmId } from "@/lib/services/em-id.service";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth) return unauthorized();
  if (!canManageResources(auth)) return forbidden();
  const raw = req.nextUrl.searchParams.get("emId") ?? "";
  const emId = normalizeEmId(raw);
  if (!/^EM\d{6,}$/.test(emId)) return error("EM ID noto'g'ri", 400);
  const emp = await prisma.employee.findUnique({
    where: { emId },
    select: {
      id: true,
      emId: true,
      firstName: true,
      lastName: true,
      specialty: true,
      compositeRating: true,
      photoUrl: true,
    },
  });
  if (!emp) return notFound();
  return ok({ ...emp, compositeRating: emp.compositeRating ? Number(emp.compositeRating) : null });
}
