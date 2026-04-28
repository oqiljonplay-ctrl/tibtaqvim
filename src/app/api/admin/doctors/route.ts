import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, created, error, unauthorized, forbidden } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();

    const clinicId = auth.role === "super_admin"
      ? new URL(req.url).searchParams.get("clinicId") || undefined
      : auth.clinicId!;

    const doctors = await prisma.doctor.findMany({
      where: { ...(clinicId ? { clinicId } : {}), isActive: true },
      include: { branch: { select: { name: true } } },
      orderBy: { lastName: "asc" },
    });

    return ok(doctors);
  } catch {
    return error("Server error", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (!["super_admin", "clinic_admin"].includes(auth.role)) return forbidden();

    const body = await req.json();
    const { firstName, lastName, specialty, phone, branchId, photoUrl } = body;

    if (!firstName || !lastName || !specialty) {
      return error("firstName, lastName, specialty are required");
    }

    const clinicId = auth.role === "super_admin" ? body.clinicId : auth.clinicId;
    if (!clinicId) return error("clinicId required");

    const doctor = await prisma.doctor.create({
      data: { clinicId, firstName, lastName, specialty, phone, branchId: branchId ?? null, photoUrl: photoUrl ?? null },
    });

    return created(doctor);
  } catch {
    return error("Server error", 500);
  }
}
