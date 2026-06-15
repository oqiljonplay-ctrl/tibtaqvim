import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, hashPassword, generateRandomPassword } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound } from "@/lib/api-response";

// POST /api/admin/doctors/[id]/reset-password
// [id] — doctors.id (doctorId).
// userId bor → parol almashtiriladi.
// userId yo'q → employee.phone/doctor.phone dan yangi user yaratiladi va parol qaytariladi.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireAuth(req);
  if (!auth) return unauthorized();
  if (!["super_admin", "clinic_admin", "branch_admin"].includes(auth.role)) return forbidden();

  const doctor = await prisma.doctor.findUnique({
    where: { id: params.id },
    select: {
      id: true, clinicId: true, branchId: true, userId: true,
      firstName: true, lastName: true, phone: true,
      employee: { select: { id: true, phone: true, userId: true } },
    },
  });

  if (!doctor) return notFound("Shifokor topilmadi");

  if (auth.role === "clinic_admin") {
    if (doctor.clinicId !== auth.clinicId) return forbidden();
  }
  if (auth.role === "branch_admin") {
    if (doctor.clinicId !== auth.clinicId) return forbidden();
    if (doctor.branchId !== auth.branchId) return forbidden();
  }

  const newPassword = generateRandomPassword(12);
  const passwordHash = await hashPassword(newPassword);

  // ── Case 1: userId mavjud — parol almashtiriladi ──────────────────────────
  if (doctor.userId) {
    const targetUser = await prisma.user.findUnique({
      where: { id: doctor.userId },
      select: { id: true, role: true, clinicId: true, phone: true, isActive: true },
    });

    if (!targetUser || !targetUser.isActive) return notFound("Foydalanuvchi topilmadi");
    if (auth.role === "clinic_admin" && targetUser.id === auth.userId) return forbidden();

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

  // ── Case 2: userId yo'q — yangi login akkaunt yaratiladi ─────────────────
  const phone = doctor.employee?.phone ?? doctor.phone;
  if (!phone) {
    return error("Shifokor telefon raqami yo'q — avval telefon qo'shing", 400);
  }

  const phoneConflict = await prisma.user.findFirst({ where: { phone } });
  if (phoneConflict) {
    return error(
      `Bu telefon (${phone}) allaqachon boshqa akkauntda — super_admin bilan bog'laning`,
      409
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        firstName: doctor.firstName,
        lastName: doctor.lastName ?? null,
        phone,
        passwordHash,
        role: "doctor",
        clinicId: doctor.clinicId,
        branchId: doctor.branchId ?? null,
        isActive: true,
      },
    });

    if (doctor.employee?.id) {
      await tx.employee.update({
        where: { id: doctor.employee.id },
        data: { userId: newUser.id },
      });
    }
    await tx.doctor.update({
      where: { id: doctor.id },
      data: { userId: newUser.id },
    });

    await tx.auditLog.create({
      data: {
        actorId: auth.userId,
        clinicId: auth.clinicId ?? doctor.clinicId,
        action: "doctor.account_created",
        payload: {
          doctorId: doctor.id,
          userId: newUser.id,
          phone,
          createdBy: auth.role,
        },
      },
    });

    return { phone: newUser.phone };
  });

  return ok({
    newPassword,
    name: `${doctor.firstName} ${doctor.lastName ?? ""}`.trim(),
    phone: result.phone,
    accountCreated: true,
  });
}
