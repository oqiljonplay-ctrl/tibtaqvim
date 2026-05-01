import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { hashPassword } from "@/lib/auth";
import { ok, created, error, unauthorized, forbidden } from "@/lib/api-response";
import { normalizePhone } from "@/lib/utils/phone";

// POST /api/admin/staff — create a staff user account (receptionist or clinic_admin)
// Body: { firstName, lastName, phone, password, role: "receptionist"|"clinic_admin"|"doctor" }
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

    const user = await prisma.user.create({
      data: {
        firstName: firstName.trim(),
        lastName: lastName?.trim() ?? null,
        phone,
        passwordHash,
        role,
        clinicId,
        isActive: true,
      },
    });

    // If doctor role — also create Doctor record
    if (role === "doctor") {
      const { specialty } = body;
      if (!specialty) return error("Doctor uchun specialty majburiy");

      await prisma.doctor.create({
        data: {
          clinicId,
          userId: user.id,
          firstName: firstName.trim(),
          lastName: lastName?.trim() ?? "",
          specialty: specialty.trim(),
          phone,
        },
      });
    }

    // If receptionist — also create Staff record
    if (role === "receptionist") {
      await prisma.staff.create({
        data: {
          clinicId,
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
    });
  } catch (err: any) {
    if (err?.code === "P2002") return error("Bu telefon raqam allaqachon ishlatilgan", 409);
    return error("Server xatosi", 500);
  }
}

// GET /api/admin/staff — list all staff for this clinic
export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (!["super_admin", "clinic_admin"].includes(auth.role)) return forbidden();

    const clinicId = auth.role === "super_admin"
      ? new URL(req.url).searchParams.get("clinicId") || undefined
      : auth.clinicId!;

    const staff = await prisma.user.findMany({
      where: {
        ...(clinicId ? { clinicId } : {}),
        role: { not: "patient" },
        isActive: true,
      },
      select: { id: true, firstName: true, lastName: true, phone: true, role: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    return ok(staff);
  } catch {
    return error("Server xatosi", 500);
  }
}
