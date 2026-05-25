import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, hashPassword, generateRandomPassword } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound } from "@/lib/api-response";

// POST /api/admin/doctors/[id]/reset-password
// [id] — doctors.id (doctorId), userId ichki topiladi.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireAuth(req);
  if (!auth) return unauthorized();
  if (!["super_admin", "clinic_admin"].includes(auth.role)) return forbidden();

  const doctor = await prisma.doctor.findUnique({
    where: { id: params.id },
    select: { id: true, clinicId: true, userId: true, firstName: true, lastName: true },
  });

  if (!doctor) return notFound("Shifokor topilmadi");
  if (!doctor.userId) return error("Bu shifokorning login akkaunti yo'q", 400);

  const targetUser = await prisma.user.findUnique({
    where: { id: doctor.userId },
    select: { id: true, role: true, clinicId: true, phone: true, isActive: true },
  });

  if (!targetUser || !targetUser.isActive) return notFound("Foydalanuvchi topilmadi");

  if (auth.role === "clinic_admin") {
    if (doctor.clinicId !== auth.clinicId) return forbidden();
    if (targetUser.id === auth.userId) return forbidden();
  }

  const newPassword = generateRandomPassword(12);
  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: doctor.userId! },
      data: { passwordHash },
    });

    await tx.auditLog.create({
      data: {
        actorId: auth.userId,
        clinicId: auth.clinicId ?? doctor.clinicId,
        action: "staff.password_reset",
        payload: {
          doctorId: doctor.id,
          targetUserId: doctor.userId,
          targetRole: targetUser.role,
          resetBy: auth.role,
        },
      },
    });
  });

  return ok({
    newPassword,
    name: `${doctor.firstName} ${doctor.lastName ?? ""}`.trim(),
    phone: targetUser.phone,
  });
}
