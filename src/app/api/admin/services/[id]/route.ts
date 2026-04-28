import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound } from "@/lib/api-response";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (!["super_admin", "clinic_admin"].includes(auth.role)) return forbidden();

    const data = await req.json();

    const service = await prisma.service.findUnique({ where: { id: params.id } });
    if (!service) return notFound();
    if (auth.role !== "super_admin" && service.clinicId !== auth.clinicId) return forbidden();

    const updated = await prisma.service.update({
      where: { id: params.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.price !== undefined && { price: data.price }),
        ...(data.dailyLimit !== undefined && { dailyLimit: data.dailyLimit }),
        ...(data.requiresSlot !== undefined && { requiresSlot: data.requiresSlot }),
        ...(data.requiresAddress !== undefined && { requiresAddress: data.requiresAddress }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    return ok({ ...updated, price: Number(updated.price) });
  } catch {
    return error("Server error", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (!["super_admin", "clinic_admin"].includes(auth.role)) return forbidden();

    await prisma.service.update({ where: { id: params.id }, data: { isActive: false } });
    return ok({ message: "Service deactivated" });
  } catch {
    return error("Server error", 500);
  }
}
