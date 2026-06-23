import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, hashPassword, validatePasswordStrength, generateRandomPassword } from "@/lib/auth";
import { ok, forbidden, notFound, error, serverError } from "@/lib/api-response";
import { normalizePhone } from "@/lib/utils/phone";
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
    const { firstName, lastName, phone, isActive, resetPassword, newPassword, username } = body;

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
        const np = normalizePhone(phone);
        if (!np) return error("Telefon raqam formati noto'g'ri", 400);
        const existing = await prisma.user.findFirst({
          where: { phone: np, id: { not: adminId } },
        });
        if (existing) return error("Telefon raqami band", 409);
        data.phone = np;
      } else {
        data.phone = null;
      }
    }

    if (isActive !== undefined) data.isActive = Boolean(isActive);

    if (username !== undefined) {
      const u = String(username).trim();
      if (!/^tib_(b?admin)_[a-z0-9]+$/.test(u)) {
        return error("Login formati noto'g'ri (tib_admin_… yoki tib_badmin_…)", 400);
      }
      const clash = await prisma.user.findFirst({ where: { username: u, id: { not: adminId } } });
      if (clash) return error("Bu login band", 409);
      data.username = u;
    }

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

    const action = resetPassword
      ? "admin.reset_password"
      : username !== undefined
      ? "admin.username_rename"
      : "admin.update";

    await prisma.auditLog.create({
      data: {
        actorId: session.userId,
        clinicId,
        action,
        payload: {
          adminId,
          changes: Object.keys(data).filter((k) => k !== "passwordHash"),
          ...(username !== undefined ? { oldUsername: admin.username, newUsername: data.username } : {}),
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
