import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, hashPassword, generateRandomPassword } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound } from "@/lib/api-response";

// POST /api/admin/staff/[id]/reset-password
// Ruxsat: clinic_admin (faqat o'z klinikasi, o'zini tiklayolmaydi), super_admin (hammasi)
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireAuth(req);
  if (!auth) return unauthorized();
  if (!["super_admin", "clinic_admin"].includes(auth.role)) return forbidden();

  const targetUser = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, firstName: true, lastName: true, phone: true, role: true, clinicId: true, isActive: true },
  });

  if (!targetUser || !targetUser.isActive) return notFound("Foydalanuvchi topilmadi");

  // Bemor parolini tiklab bo'lmaydi
  if (targetUser.role === "patient") return forbidden();

  // clinic_admin faqat o'z klinikasini tiklaydi
  if (auth.role === "clinic_admin") {
    if (targetUser.clinicId !== auth.clinicId) return forbidden();
    // clinic_admin o'zini tiklayolmaydi
    if (targetUser.id === auth.userId) return forbidden();
  }

  const newPassword = generateRandomPassword(12);
  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: params.id },
      data: { passwordHash },
    });

    await tx.auditLog.create({
      data: {
        actorId: auth.userId,
        clinicId: auth.clinicId ?? targetUser.clinicId,
        action: "staff.password_reset",
        payload: {
          targetUserId: params.id,
          targetRole: targetUser.role,
          resetBy: auth.role,
        },
      },
    });
  });

  return ok({
    newPassword,
    userId: params.id,
    name: `${targetUser.firstName} ${targetUser.lastName ?? ""}`.trim(),
    phone: targetUser.phone,
  });
}
