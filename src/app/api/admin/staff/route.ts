import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, hashPassword, generateRandomPassword } from "@/lib/auth";
import { ok, created, error, unauthorized, forbidden } from "@/lib/api-response";
import { normalizePhone } from "@/lib/utils/phone";
import { getBranchScope, canCreateAdmin } from "@/lib/branch-scope";

// POST /api/admin/staff — xodim akkaunt yaratish (receptionist, clinic_admin, doctor)
// Parol backend tomonidan avtomatik generatsiya qilinadi va javobda qaytariladi (bir marta).
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth) return unauthorized();
  if (!["super_admin", "clinic_admin"].includes(auth.role)) return forbidden();

  const body = await req.json();
  const { firstName, lastName, phone: rawPhone, role, specialty, photoUrl, serviceIds } = body;

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

      if (role === "doctor") {
        await tx.doctor.create({
          data: {
            clinicId,
            branchId,
            userId: newUser.id,
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

      return newUser;
    });

    return created({
      id: user.id,
      firstName: user.firstName,
      phone: user.phone,
      role: user.role,
      clinicId: user.clinicId,
      branchId: user.branchId,
      generatedPassword,
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

// GET /api/admin/staff — o'z darajasidagi xodimlar ro'yxati
export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (!["super_admin", "clinic_admin"].includes(auth.role)) return forbidden();

    const explicitClinicId = new URL(req.url).searchParams.get("clinicId");
    const scope = getBranchScope(auth, explicitClinicId);

    const staff = await prisma.user.findMany({
      where: {
        ...scope,
        role: { not: "patient" },
        isActive: true,
      },
      select: { id: true, firstName: true, lastName: true, phone: true, role: true, branchId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    return ok(staff);
  } catch {
    return error("Server xatosi", 500);
  }
}
