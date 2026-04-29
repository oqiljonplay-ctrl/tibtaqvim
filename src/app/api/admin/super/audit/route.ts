import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, unauthorized, forbidden } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const user = requireAuth(req);
  if (!user) return unauthorized();
  if (user.role !== "super_admin") return forbidden();

  const { searchParams } = new URL(req.url);
  const clinicId = searchParams.get("clinicId");
  const take = Math.min(parseInt(searchParams.get("take") ?? "50"), 200);

  const logs = await prisma.auditLog.findMany({
    where: clinicId ? { clinicId } : undefined,
    orderBy: { createdAt: "desc" },
    take,
  });

  return ok(logs);
}
