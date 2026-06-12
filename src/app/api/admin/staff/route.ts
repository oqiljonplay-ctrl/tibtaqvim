import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, hashPassword, generateRandomPassword } from "@/lib/auth";
import { ok, created, error, unauthorized, forbidden } from "@/lib/api-response";
import { normalizePhone } from "@/lib/utils/phone";
import { getBranchScope, canCreateAdmin } from "@/lib/branch-scope";
import { nextEmId } from "@/lib/services/em-id.service";

// POST /api/admin/staff — xodim akkaunt yaratish (receptionist, clinic_admin, doctor)
// Parol backend tomonidan avtomatik generatsiya qilinadi va javobda qaytariladi (bir marta).
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth) return unauthorized();
  if (!["super_admin", "clinic_admin", "branch_admin"].includes(auth.role)) return forbidden();

  const body = await req.json();
  const { firstName, lastName, phone: rawPhone, role, specialty, photoUrl, serviceIds, profession } = body;

  if (!firstName || !rawPhone || !role) {
    return error("firstName, phone, role majburiy");
  }

  // clinic_admin va branch_admin rollari faqat super_admin yarata oladi
  const adminRoles = ["clinic_admin", "branch_admin"];
  if (adminRoles.includes(role) && !canCreateAdmin(auth)) {
    return forbidden();
  }

  const allowed = ["receptionist", "clinic_admin", "doctor"];
  if (!allowed.includes(role)) {
    return error(`role faqat: ${allowed.join(", ")}`);
  }

  if (role === "doctor" && !specialty) {
    return error("Doctor uchun specialty majburiy");
  }

  const clinicId = auth.role === "super_admin" ? body.clinicId : auth.clinicId;
  if (!clinicId) return error("clinicId required");

  // Mahalliy branchId hisoblash (resolveBranchIdForCreate ishlatilmaydi — boshqa joylar uchun saqlanadi)
  let branchId: string | null = null;
  if (auth.role === "super_admin") {
    branchId = body.branchId ?? null;
  } else if (auth.role === "clinic_admin") {
    if (!body.branchId) return error("Filial tanlanishi shart", 400);
    const branch = await prisma.branch.findFirst({
      where: { id: body.branchId, isActive: true },
      select: { clinicId: true },
    });
    if (!branch || branch.clinicId !== auth.clinicId) return forbidden();
    branchId = body.branchId;
  } else if (auth.role === "branch_admin") {
    branchId = auth.branchId ?? null;
  }

  const phone = normalizePhone(rawPhone);
  const generatedPassword = generateRandomPassword(12);
  const passwordHash = await hashPassword(generatedPassword);

  try {
    const user = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findFirst({ where: { phone } });
      if (existing) {
        throw Object.assign(new Error("PHONE_TAKEN"), { code: "PHONE_TAKEN" });
      }

      const newUser = await tx.user.create({
        data: {
          firstName: firstName.trim(),
          lastName: lastName?.trim() ?? null,
          phone,
          passwordHash,
          role,
          clinicId,
          branchId,
          isActive: true,
        },
      });

      // EM id — faqat kasb egalariga (admin rollar EM olmaydi)
      let employeeId: string | null = null;
      let generatedEmId: string | null = null;
      if (role === "doctor" || role === "receptionist") {
        const emId = await nextEmId(tx);
        const employee = await tx.employee.create({
          data: {
            emId,
            firstName: firstName.trim(),
            lastName: lastName?.trim() ?? null,
            phone,
            profession:
              role === "doctor"
                ? (specialty ?? "doctor")
                : (profession ?? "receptionist"),
            userId: newUser.id,
          },
        });
        employeeId = employee.id;
        generatedEmId = emId;
      }

      if (role === "doctor") {
        await tx.doctor.create({
          data: {
            clinicId,
            branchId,
            userId: newUser.id,
            employeeId,
            firstName: firstName.trim(),
            lastName: lastName?.trim() ?? "",
            specialty: String(specialty).trim(),
            phone,
            photoUrl: photoUrl ?? null,
            ...(Array.isArray(serviceIds) && serviceIds.length > 0
              ? { services: { create: (serviceIds as string[]).map((serviceId) => ({ serviceId })) } }
              : {}),
          },
        });
      }

      if (role === "receptionist") {
        await tx.staff.create({
          data: {
            clinicId,
            branchId,
            userId: newUser.id,
            employeeId,
            firstName: firstName.trim(),
            lastName: lastName?.trim() ?? "",
            role: "receptionist",
            phone,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: auth.userId,
          clinicId,
          action: "staff.create",
          payload: { userId: newUser.id, role, firstName: firstName.trim(), phone },
        },
      });

      return { user: newUser, generatedEmId };
    });

    return created({
      id: user.user.id,
      firstName: user.user.firstName,
      phone: user.user.phone,
      role: user.user.role,
      clinicId: user.user.clinicId,
      branchId: user.user.branchId,
      generatedPassword,
      emId: user.generatedEmId,
    });
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "PHONE_TAKEN") {
      return error("Bu telefon raqam allaqachon ro'yxatdan o'tgan", 409);
    }
    if (e.code === "P2002") {
      return error("Bu telefon raqam allaqachon ishlatilgan", 409);
    }
    return error("Server xatosi", 500);
  }
}

// GET /api/admin/staff — staff jadvalidan receptionist ro'yxati (branch+photo bilan)
export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (!["super_admin", "clinic_admin", "branch_admin"].includes(auth.role)) return forbidden();

    const explicitClinicId = new URL(req.url).searchParams.get("clinicId");
    const scope = getBranchScope(auth, explicitClinicId);

    const staff = await prisma.staff.findMany({
      where: { ...scope, isActive: true },
      select: {
        id: true,
        userId: true,
        firstName: true,
        lastName: true,
        phone: true,
        photoUrl: true,
        role: true,
        branchId: true,
        createdAt: true,
        branch: { select: { id: true, name: true } },
        employee: { select: { emId: true, profession: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return ok(staff.map((s) => ({
      ...s,
      emId: s.employee?.emId ?? null,
      profession: s.employee?.profession ?? null,
    })));
  } catch {
    return error("Server xatosi", 500);
  }
}
