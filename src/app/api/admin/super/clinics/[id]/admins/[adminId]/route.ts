import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, hashPassword, validatePasswordStrength, generateRandomPassword } from "@/lib/auth";
import { ok, forbidden, notFound, error, serverError } from "@/lib/api-response";
import { Prisma } from "@prisma/client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; adminId: string }> }
) {
  const session = requireAuth(req);
  if (!session || session.role !== "super_admin") return forbidden();

  const { id: clinicId, adminId } = await params;

  const admin = await prisma.user.findFirst({
    where: { id: adminId, clinicId, role: "clinic_admin" },
  });
  if (!admin) return notFound("Admin topilmadi");

  try {
    const body = await req.json();
    const { firstName, lastName, phone, isActive, resetPassword, newPassword } = body;

    const data: Prisma.UserUpdateInput = {};

    if (firstName !== undefined) {
      if (typeof firstName !== "string" || firstName.trim().length < 2) {
        return error("Ism noto'g'ri");
      }
      data.firstName = firstName.trim();
    }

    if (lastName !== undefined) data.lastName = lastName?.trim() || null;

    if (phone !== undefined) {
      if (phone) {
        const existing = await prisma.user.findFirst({
          where: { phone, id: { not: adminId } },
        });
        if (existing) return error("Telefon raqami band", 409);
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
        actorId: session.userId,
        clinicId,
        action: resetPassword ? "admin.reset_password" : "admin.update",
        payload: {
          adminId,
          changes: Object.keys(data).filter((k) => k !== "passwordHash"),
        },
      },
    });

    return ok({
      admin: updated,
      ...(returnedPassword ? { newPassword: returnedPassword } : {}),
    });
  } catch {
    return serverError();
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; adminId: string }> }
) {
  const session = requireAuth(req);
  if (!session || session.role !== "super_admin") return forbidden();

  const { id: clinicId, adminId } = await params;

  const admin = await prisma.user.findFirst({
    where: { id: adminId, clinicId, role: "clinic_admin" },
  });
  if (!admin) return notFound("Admin topilmadi");

  await prisma.user.update({
    where: { id: adminId },
    data: { isActive: false },
  });

  await prisma.auditLog.create({
    data: {
      actorId: session.userId,
      clinicId,
      action: "admin.delete",
      payload: { adminId, username: admin.username },
    },
  });

  return ok({ success: true });
}
