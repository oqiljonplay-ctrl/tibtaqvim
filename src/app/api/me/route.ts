import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, error } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth) return error("Unauthorized", 401);

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      telegramId: true,
      tibId: true,
      role: true,
      clinicId: true,
      branchId: true,
      clinic: { select: { id: true, name: true, logoUrl: true, city: true } },
      branch: { select: { id: true, name: true } },
      createdAt: true,
      // Portativ profil rasmi uchun (shifokor va xodimlar)
      employee: { select: { photoUrl: true } },
      dependents: {
        where: { deletedAt: null },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          relation: true,
          birthYear: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!user) return error("User not found", 404);

  // Shifokor uchun: klinika/filial faqat FAOL doctor yozuvidan olinadi.
  // Doctor.isActive=false bo'lsa (0 faol stint) → clinic/branch null qaytadi.
  let resolvedClinic = user.clinic ?? null;
  let resolvedBranch = user.branch ?? null;
  if (user.role === "doctor") {
    const activeDoctor = await prisma.doctor.findFirst({
      where: { userId: user.id, isActive: true },
      select: {
        clinic: { select: { id: true, name: true, logoUrl: true, city: true } },
        branch: { select: { id: true, name: true } },
      },
    });
    resolvedClinic = activeDoctor?.clinic ?? null;
    resolvedBranch = activeDoctor?.branch ?? null;
  }

  // photoUrl: EM'dan (ishsiz holatda ham ko'rinadi)
  const photoUrl = user.employee?.photoUrl ?? null;

  return ok({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    fullName: [user.firstName, user.lastName].filter(Boolean).join(" "),
    phone: user.phone,
    telegramId: user.telegramId,
    tibId: user.tibId,
    role: user.role,
    clinicId: user.clinicId,
    branchId: user.branchId,
    clinic: resolvedClinic,
    branch: resolvedBranch,
    photoUrl,
    createdAt: user.createdAt,
    dependents: user.dependents,
    dependentsCount: user.dependents.length,
    canAddDependent: user.dependents.length < 2,
  });
}

export async function PATCH(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth) return error("Unauthorized", 401);

  try {
    const body = await req.json();

    const firstName = body.firstName?.trim();
    if (!firstName || firstName.length < 2 || firstName.length > 50) {
      return error("Ism 2-50 ta harf bo'lishi kerak", 400);
    }

    const lastName = body.lastName?.trim() || null;
    if (lastName && lastName.length > 50) {
      return error("Familiya 50 ta harfdan oshmasligi kerak", 400);
    }

    const updated = await prisma.user.update({
      where: { id: auth.userId },
      data: { firstName, lastName },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
      },
    });

    try {
      await prisma.auditLog.create({
        data: {
          actorId: auth.userId,
          action: "patient.update",
          payload: {
            patientId: auth.userId,
            changedFields: [
              "firstName",
              ...(lastName !== undefined ? ["lastName"] : []),
            ],
          },
          clinicId: auth.clinicId ?? null,
        },
      });
    } catch {}

    return ok(updated);
  } catch (err) {
    console.error("[PATCH /api/me] error:", err);
    return error("Profilni yangilab bo'lmadi", 500);
  }
}
