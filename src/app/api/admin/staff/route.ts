import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { hashPassword } from "@/lib/auth";
import { ok, created, error, unauthorized, forbidden } from "@/lib/api-response";
import { normalizePhone } from "@/lib/utils/phone";
import { getBranchScope, resolveBranchIdForCreate, canCreateAdmin } from "@/lib/branch-scope";

// POST /api/admin/staff — xodim akkaunt yaratish (receptionist, clinic_admin, doctor)
// faqat super_admin admin rol yarata oladi
export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (!["super_admin", "clinic_admin"].includes(auth.role)) return forbidden();

    const body = await req.json();
    const { firstName, lastName, phone: rawPhone, password, role } = body;

    if (!firstName || !rawPhone || !password || !role) {
      return error("firstName, phone, password, role majburiy");
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

    const clinicId = auth.role === "super_admin" ? body.clinicId : auth.clinicId;
    if (!clinicId) return error("clinicId required");

    const phone = normalizePhone(rawPhone);
    const passwordHash = await hashPassword(password);

    const existing = await prisma.user.findFirst({ where: { phone } });
    if (existing) return error("Bu telefon raqam allaqachon ro'yxatdan o'tgan", 409);

    const branchId = resolveBranchIdForCreate(auth, body.branchId);

    const user = await prisma.user.create({
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
      const { specialty } = body;
      if (!specialty) return error("Doctor uchun specialty majburiy");

      await prisma.doctor.create({
        data: {
          clinicId,
          branchId,
          userId: user.id,
          firstName: firstName.trim(),
          lastName: lastName?.trim() ?? "",
          specialty: specialty.trim(),
          phone,
        },
      });
    }

    if (role === "receptionist") {
      await prisma.staff.create({
        data: {
          clinicId,
          branchId,
          userId: user.id,
          firstName: firstName.trim(),
          lastName: lastName?.trim() ?? "",
          role: "receptionist",
          phone,
        },
      });
    }

    return created({
      id: user.id,
      firstName: user.firstName,
      phone: user.phone,
      role: user.role,
      clinicId: user.clinicId,
      branchId: user.branchId,
    });
  } catch (err: any) {
    if (err?.code === "P2002") return error("Bu telefon raqam allaqachon ishlatilgan", 409);
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
