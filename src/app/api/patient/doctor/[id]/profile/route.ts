import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, notFound, serverError } from "@/lib/api-response";

type Params = { params: { id: string } };

// GET /api/patient/doctor/[id]/profile — bemor uchun public (telefon/parol yo'q)
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const doctor = await prisma.doctor.findUnique({
      where: { id: params.id, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        specialty: true,
        photoUrl: true,
        education: true,
        position: true,
        department: true,
        workSchedule: true,
        operationsCount: true,
        bio: true,
        specialties: { select: { name: true }, orderBy: { sortOrder: "asc" } },
        directions:  { select: { name: true }, orderBy: { sortOrder: "asc" } },
        experiences: { select: { place: true, startYear: true, endYear: true }, orderBy: { sortOrder: "asc" } },
        workplaces:  { select: { place: true }, orderBy: { sortOrder: "asc" } },
      },
    });

    if (!doctor) return notFound("Shifokor topilmadi");
    return ok(doctor);
  } catch {
    return serverError();
  }
}
