import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  hashPassword,
  comparePassword,
  validatePasswordStrength,
} from "@/lib/auth";
import { ok, error, unauthorized, forbidden } from "@/lib/api-response";

const STAFF_ROLES = ["doctor", "receptionist", "clinic_admin", "branch_admin", "super_admin"];

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth) return unauthorized();
  if (!STAFF_ROLES.includes(auth.role)) return forbidden();

  const body = await req.json();
  const currentPassword: string = body.currentPassword ?? "";
  const newPassword: string = body.newPassword ?? "";

  if (!currentPassword || !newPassword) {
    return error("Joriy va yangi parol kiritilishi shart");
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, passwordHash: true },
  });

  if (!user || !user.passwordHash) return unauthorized();

  const currentValid = await comparePassword(currentPassword, user.passwordHash);
  if (!currentValid) return error("Joriy parol noto'g'ri");

  const strengthCheck = validatePasswordStrength(newPassword);
  if (!strengthCheck.valid) return error(strengthCheck.error!);

  const sameAsOld = await comparePassword(newPassword, user.passwordHash);
  if (sameAsOld) return error("Yangi parol eskisidan farqli bo'lishi kerak");

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: auth.userId },
      data: { passwordHash },
    });

    await tx.auditLog.create({
      data: {
        actorId: auth.userId,
        clinicId: auth.clinicId,
        action: "auth.password_change",
        payload: { role: auth.role },
      },
    });
  });

  return ok({ message: "Parol muvaffaqiyatli o'zgartirildi" });
}
