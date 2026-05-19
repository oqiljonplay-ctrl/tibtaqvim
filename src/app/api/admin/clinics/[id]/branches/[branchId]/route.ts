import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { sessionUser, canManageClinic, canManageBranch } from "@/lib/permissions";
import { ok, forbidden, notFound, error, unauthorized, serverError } from "@/lib/api-response";

type RouteParams = { params: Promise<{ id: string; branchId: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  const jwt = requireAuth(req);
  if (!jwt) return unauthorized();

  const { id: clinicId, branchId } = await params;
  const user = sessionUser(jwt);

  if (!canManageBranch(user, clinicId, branchId)) return forbidden();

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, clinicId },
    include: {
      _count: {
        select: {
          admins: { where: { role: "branch_admin", isActive: true } },
        },
      },
    },
  });

  if (!branch) return notFound("Filial topilmadi");
  return ok({ branch });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const jwt = requireAuth(req);
  if (!jwt) return unauthorized();

  const { id: clinicId, branchId } = await params;
  const user = sessionUser(jwt);

  if (!canManageClinic(user, clinicId)) return forbidden();

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, clinicId },
  });
  if (!branch) return notFound("Filial topilmadi");

  try {
    const body = await req.json();
    const ALLOWED = ["name", "address", "phone", "latitude", "longitude", "nearbyMetro", "workingHours", "sortOrder", "isActive"];
    const data: Record<string, unknown> = {};

    for (const key of ALLOWED) {
      if (key in body) data[key] = body[key];
    }

    if (data.name !== undefined) {
      if (typeof data.name !== "string" || (data.name as string).trim().length < 2) {
        return error("Filial nomi kamida 2 belgi bo'lishi kerak");
      }
      data.name = (data.name as string).trim();
    }
    if (data.address !== undefined && typeof data.address === "string") {
      data.address = data.address.trim();
    }

    const updated = await prisma.branch.update({
      where: { id: branchId },
      data,
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        clinicId,
        action: "branch.update",
        payload: { branchId, changes: Object.keys(data) },
      },
    });

    return ok({ branch: updated });
  } catch {
    return serverError();
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const jwt = requireAuth(req);
  if (!jwt) return unauthorized();

  const { id: clinicId, branchId } = await params;
  const user = sessionUser(jwt);

  if (!canManageClinic(user, clinicId)) return forbidden();

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, clinicId },
  });
  if (!branch) return notFound("Filial topilmadi");

  await prisma.$transaction([
    prisma.branch.update({
      where: { id: branchId },
      data: { isActive: false },
    }),
    prisma.user.updateMany({
      where: { branchId, role: "branch_admin" },
      data: { isActive: false },
    }),
  ]);

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      clinicId,
      action: "branch.delete",
      payload: { branchId, name: branch.name },
    },
  });

  return ok({ success: true });
}
