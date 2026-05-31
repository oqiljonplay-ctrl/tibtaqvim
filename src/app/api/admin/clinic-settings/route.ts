import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, error, unauthorized, forbidden } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";

// GET /api/admin/clinic-settings — klinika limit sozlamalarini o'qish
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth) return unauthorized();
  if (!["clinic_admin", "branch_admin", "super_admin"].includes(auth.role)) return forbidden();
  if (!auth.clinicId) return error("clinicId topilmadi", 400);

  const settings = await prisma.clinicSettings.findUnique({
    where: { clinicId: auth.clinicId },
    select: {
      patientSelfLimit: true,
      dependentBookingLimit: true,
      maxDependents: true,
    },
  });

  return ok(settings ?? { patientSelfLimit: 4, dependentBookingLimit: 1, maxDependents: 2 });
}

// PUT /api/admin/clinic-settings — 3 limit sozlamani yangilash
export async function PUT(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth) return unauthorized();
  // branch_admin faqat ko'radi, o'zgartira olmaydi
  if (!["clinic_admin", "super_admin"].includes(auth.role)) return forbidden();
  if (!auth.clinicId) return error("clinicId topilmadi", 400);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error("JSON format noto'g'ri", 400);
  }

  const { patientSelfLimit, dependentBookingLimit, maxDependents } = body as Record<string, unknown>;

  if (typeof patientSelfLimit !== "number" || patientSelfLimit < 1 || patientSelfLimit > 10)
    return error("patientSelfLimit 1 dan 10 gacha bo'lishi kerak", 400);
  if (typeof dependentBookingLimit !== "number" || dependentBookingLimit < 0 || dependentBookingLimit > 5)
    return error("dependentBookingLimit 0 dan 5 gacha bo'lishi kerak", 400);
  if (typeof maxDependents !== "number" || maxDependents < 0 || maxDependents > 5)
    return error("maxDependents 0 dan 5 gacha bo'lishi kerak", 400);

  const updated = await prisma.clinicSettings.upsert({
    where: { clinicId: auth.clinicId },
    update: { patientSelfLimit, dependentBookingLimit, maxDependents },
    create: {
      clinicId: auth.clinicId,
      patientSelfLimit,
      dependentBookingLimit,
      maxDependents,
    },
    select: {
      patientSelfLimit: true,
      dependentBookingLimit: true,
      maxDependents: true,
    },
  });

  return ok(updated);
}
