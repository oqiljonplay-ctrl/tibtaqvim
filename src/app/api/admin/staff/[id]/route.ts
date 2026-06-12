import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound, serverError } from "@/lib/api-response";
import { canManageResources } from "@/lib/branch-scope";
import { createAuditLog } from "@/lib/services/config.service";

type Params = { params: { id: string } };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (!canManageResources(auth)) return forbidden();

    const staff = await prisma.staff.findUnique({
      where: { id: params.id },
      include: { branch: { select: { id: true, name: true } } },
    });

    if (!staff) return notFound("Staff not found");
    if (auth.role !== "super_admin" && staff.clinicId !== auth.clinicId) return forbidden();
    if (auth.role === "branch_admin" && staff.branchId !== auth.branchId) return forbidden();

    return ok(staff);
  } catch {
    return serverError();
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (!canManageResources(auth)) return forbidden();

    const staff = await prisma.staff.findUnique({ where: { id: params.id } });
    if (!staff) return notFound("Staff not found");
    if (auth.role !== "super_admin" && staff.clinicId !== auth.clinicId) return forbidden();
    if (auth.role === "branch_admin" && staff.branchId !== auth.branchId) return forbidden();

    const body = await req.json();
    const { firstName, lastName, phone, photoUrl, branchId } = body;

    if (!firstName) return error("firstName majburiy");

    // clinic_admin faqat o'z klinikasining filialini belgilashi mumkin
    if (branchId !== undefined && branchId !== null && auth.role === "clinic_admin") {
      const branch = await prisma.branch.findFirst({
        where: { id: branchId, isActive: true },
        select: { clinicId: true },
      });
      if (!branch || branch.clinicId !== auth.clinicId) return forbidden();
    }

    const updated = await prisma.$transaction(async (tx) => {
      const s = await tx.staff.update({
        where: { id: params.id },
        data: {
          firstName: firstName.trim(),
          lastName: lastName?.trim() ?? staff.lastName,
          phone: phone || null,
          photoUrl: photoUrl || null,
          ...(branchId !== undefined && { branchId: branchId || null }),
        },
        include: { branch: { select: { id: true, name: true } } },
      });

      // users jadvalini ham sinxronlashtir
      if (s.userId) {
        await tx.user.update({
          where: { id: s.userId },
          data: {
            firstName: firstName.trim(),
            lastName: lastName?.trim() ?? undefined,
            phone: phone || undefined,
            ...(branchId !== undefined && { branchId: branchId || null }),
          },
        });
      }

      return s;
    });

    await createAuditLog(
      auth.userId,
      "staff.update",
      { staffId: params.id, firstName, lastName, phone },
      staff.clinicId
    ).catch(() => {});

    return ok(updated);
  } catch {
    return serverError();
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (!canManageResources(auth)) return forbidden();

    const staff = await prisma.staff.findUnique({ where: { id: params.id } });
    if (!staff) return notFound("Staff not found");
    if (auth.role !== "super_admin" && staff.clinicId !== auth.clinicId) return forbidden();
    if (auth.role === "branch_admin" && staff.branchId !== auth.branchId) return forbidden();

    // Faqat staff yozuvi deaktivatsiya; users va employees yozuvlari TEGILMAYDI — karyera davom etadi
    await prisma.staff.update({ where: { id: params.id }, data: { isActive: false } });

    await createAuditLog(
      auth.userId,
      "staff.delete",
      { staffId: params.id, userId: staff.userId },
      staff.clinicId
    ).catch(() => {});

    return ok({ deletedId: params.id });
  } catch {
    return serverError();
  }
}
