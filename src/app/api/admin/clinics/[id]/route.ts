import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound } from "@/lib/api-response";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const clinic = await prisma.clinic.findUnique({
    where: { id: params.id },
    include: {
      branches: true,
      services: { where: { isActive: true } },
      _count: { select: { doctors: true, staff: true } },
    },
  });
  if (!clinic) return notFound();
  return ok(clinic);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (auth.role !== "super_admin") return forbidden();

    const data = await req.json();
    const clinic = await prisma.clinic.update({ where: { id: params.id }, data });
    return ok(clinic);
  } catch {
    return error("Server error", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (auth.role !== "super_admin") return forbidden();

    await prisma.clinic.update({ where: { id: params.id }, data: { isActive: false } });
    return ok({ message: "Clinic deactivated" });
  } catch {
    return error("Server error", 500);
  }
}
