import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, hashPassword, validatePasswordStrength, generateRandomPassword } from "@/lib/auth";
import { sessionUser, canCreateBranchAdmin } from "@/lib/permissions";
import { ok, forbidden, notFound, error, unauthorized, serverError } from "@/lib/api-response";

type RouteParams = { params: Promise<{ id: string; branchId: string; adminId: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const jwt = requireAuth(req);
  if (!jwt) return unauthorized();

  const { id: clinicId, branchId, adminId } = await params;
  const user = sessionUser(jwt);

  if (!canCreateBranchAdmin(user, clinicId)) return forbidden();

  const admin = await prisma.user.findFirst({
    where: { id: adminId, branchId, clinicId, role: "branch_admin" },
  });
  if (!admin) return notFound("Admin topilmadi");

  try {
    const body = await req.json();
    const { firstName, lastName, phone, isActive, resetPassword, newPassword } = body;

    const data: Record<string, unknown> = {};

    if (firstName !== undefined) {
      if (typeof firstName !== "string" || firstName.trim().length < 2) {
        return error("Ism kamida 2 belgi bo'lishi kerak");
      }
      data.firstName = firstName.trim();
    }
    if (lastName !== undefined) data.lastName = lastName?.trim() || null;
    if (phone !== undefined) {
      if (phone) {
        const existing = await prisma.user.findFirst({
          where: { phone, id: { not: adminId } },
        });
        if (existing) return error("Bu telefon raqam band", 409);
      }
      data.phone = phone || null;
    }
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    let returnedPassword: string | null = null;
    if (resetPassword) {
      const pwd = newPassword || generateRandomPassword(12);
      if (newPassword) {
        const check = validatePasswordStrength(newPassword);
        if (!check.valid) return error(check.error!);
      }
      data.passwordHash = await hashPassword(pwd);
      returnedPassword = pwd;
    }

    const updated = await prisma.user.update({
      where: { id: adminId },
      data,
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        phone: true,
        isActive: true,
        updatedAt: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        clinicId,
        action: resetPassword ? "branch_admin.reset_password" : "branch_admin.update",
        payload: {
          adminId,
          branchId,
          changes: Object.keys(data).filter((k) => k !== "passwordHash"),
        },
      },
    });

    return ok({ admin: updated, ...(returnedPassword ? { newPassword: returnedPassword } : {}) });
  } catch {
    return serverError();
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const jwt = requireAuth(req);
  if (!jwt) return unauthorized();

  const { id: clinicId, branchId, adminId } = await params;
  const user = sessionUser(jwt);

  if (!canCreateBranchAdmin(user, clinicId)) return forbidden();

  const admin = await prisma.user.findFirst({
    where: { id: adminId, branchId, role: "branch_admin" },
  });
  if (!admin) return notFound("Admin topilmadi");

  await prisma.user.update({
    where: { id: adminId },
    data: { isActive: false },
  });

  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      clinicId,
      action: "branch_admin.delete",
      payload: { adminId, branchId, username: admin.username },
    },
  });

  return ok({ success: true });
}
