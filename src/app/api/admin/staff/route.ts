import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, hashPassword, generateRandomPassword } from "@/lib/auth";
import type { Prisma } from "@prisma/client";
import { ok, created, error, unauthorized, forbidden } from "@/lib/api-response";
import { normalizePhone } from "@/lib/utils/phone";
import { getBranchScope, canCreateAdmin } from "@/lib/branch-scope";
import { resolveOrCreateEmployee, openStint, assertClinicCapacity, ApiError } from "@/lib/services/employment.service";

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
  if (rawPhone && !phone) return error("Telefon raqam formati noto'g'ri", 400);

  // Oldindan parol tayyorlaymiz — agar kerak bo'lsa ishlatiladi
  const candidatePassword = generateRandomPassword(12);

  try {
    let usedPassword: string | null = null;

    const result = await prisma.$transaction(async (tx) => {
      // ── 1. User: mavjudni reuse yoki yangi yarat ──────────────────────────
      let user = phone ? await tx.user.findFirst({ where: { phone } }) : null;

      if (user) {
        // Mavjud userga minimal yangilanishlar — bemor ma'lumotlari TEGILMAYDI
        let needsUpdate = false;
        const updateData: Prisma.UserUncheckedUpdateInput = {};
        if (user.role === "patient") { updateData.role = role; needsUpdate = true; }
        if (!user.passwordHash) {
          usedPassword = candidatePassword;
          updateData.passwordHash = await hashPassword(candidatePassword);
          needsUpdate = true;
        }
        if (!user.clinicId && clinicId) { updateData.clinicId = clinicId; needsUpdate = true; }
        if (!user.branchId && branchId) { updateData.branchId = branchId; needsUpdate = true; }
        if (needsUpdate) {
          user = await tx.user.update({ where: { id: user.id }, data: updateData });
        }
      } else {
        // Yangi user — eski xulq
        usedPassword = candidatePassword;
        user = await tx.user.create({
          data: {
            firstName: firstName.trim(),
            lastName: lastName?.trim() ?? null,
            phone,
            passwordHash: await hashPassword(candidatePassword),
            role,
            clinicId,
            branchId,
            isActive: true,
          },
        });
      }

      // ── 2. Employee linkage (employees.userId UNIQUE) ─────────────────────
      let employeeId: string | null = null;
      let generatedEmId: string | null = null;

      if (role === "doctor" || role === "receptionist") {
        await assertClinicCapacity(tx, clinicId);

        // Bu user'ga allaqachon employee bog'langan?
        const linkedEmp = await tx.employee.findUnique({ where: { userId: user.id } });

        let employee;
        if (linkedEmp && !body.emId) {
          // Mavjud employee — qayta ishlatiladi (yangi yaratilmaydi)
          employee = linkedEmp;
        } else if (linkedEmp && body.emId && linkedEmp.emId !== String(body.emId).trim().toUpperCase()) {
          // Boshqa emId bilan conflict
          throw Object.assign(new Error("EMPLOYEE_CONFLICT"), { code: "EMPLOYEE_CONFLICT" });
        } else {
          employee = await resolveOrCreateEmployee(tx, {
            emIdInput: body.emId,
            firstName: firstName.trim(),
            lastName: lastName?.trim() ?? null,
            phone,
            profession:
              role === "doctor"
                ? (specialty ?? "doctor")
                : (profession ?? "receptionist"),
            targetClinicId: clinicId,
          });
          if (!employee.userId) {
            await tx.employee.update({ where: { id: employee.id }, data: { userId: user.id } });
          } else if (employee.userId !== user.id) {
            throw Object.assign(new Error("EMPLOYEE_CONFLICT"), { code: "EMPLOYEE_CONFLICT" });
          }
        }
        employeeId = employee.id;
        generatedEmId = employee.emId;
      }

      // ── 3. Doctor / receptionist yozuvi + stint ───────────────────────────
      if (role === "doctor") {
        const existingDoc = await tx.doctor.findFirst({
          where: { employeeId: employeeId!, clinicId },
        });
        let doc;
        if (existingDoc) {
          doc = await tx.doctor.update({
            where: { id: existingDoc.id },
            data: {
              isActive: true,
              isHidden: false,
              branchId,
              userId: user.id,
              firstName: firstName.trim(),
              lastName: lastName?.trim() ?? "",
              specialty: String(specialty).trim(),
              phone,
              photoUrl: photoUrl ?? null,
            },
          });
        } else {
          doc = await tx.doctor.create({
            data: {
              clinicId,
              branchId,
              userId: user.id,
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
        await openStint(tx, { employeeId: employeeId!, clinicId, role: "doctor", doctorId: doc.id });
      }

      if (role === "receptionist") {
        const existingStaff = await tx.staff.findFirst({
          where: { employeeId: employeeId!, clinicId },
        });
        let staffRec;
        if (existingStaff) {
          staffRec = await tx.staff.update({
            where: { id: existingStaff.id },
            data: { isActive: true, userId: user.id, branchId },
          });
        } else {
          staffRec = await tx.staff.create({
            data: {
              clinicId,
              branchId,
              userId: user.id,
              employeeId,
              firstName: firstName.trim(),
              lastName: lastName?.trim() ?? "",
              role: "receptionist",
              phone,
            },
          });
        }
        await openStint(tx, { employeeId: employeeId!, clinicId, role: "receptionist", staffId: staffRec.id });
      }

      await tx.auditLog.create({
        data: {
          actorId: auth.userId,
          clinicId,
          action: "staff.create",
          payload: { userId: user.id, role, firstName: firstName.trim(), phone, reused: !!phone && true },
        },
      });

      return { user, generatedEmId };
    });

    return created({
      id: result.user.id,
      firstName: result.user.firstName,
      phone: result.user.phone,
      role: result.user.role,
      clinicId: result.user.clinicId,
      branchId: result.user.branchId,
      ...(usedPassword ? { generatedPassword: usedPassword } : {}),
      emId: result.generatedEmId,
    });
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      return error(err.message, err.statusCode);
    }
    const e = err as { code?: string };
    if (e.code === "EMPLOYEE_CONFLICT") {
      return error("Bu shaxs allaqachon boshqa em-id bilan bog'langan. EM-ID ni tekshiring.", 409);
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
