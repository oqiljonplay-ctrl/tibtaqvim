import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, error } from "@/lib/api-response";

// GET /api/webapp/doctor/[id]?clinicId=... — flip card uchun to'liq profil (lazy)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const clinicId = req.nextUrl.searchParams.get("clinicId");
  if (!id) return error("doctorId majburiy");
  if (!clinicId) return error("clinicId majburiy", 400);

  const [doctor, clinicSettingsRow] = await Promise.all([
    prisma.doctor.findFirst({
      where: { id, clinicId },
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
        employee: { select: { compositeRating: true, ratingCount: true } },
      },
    }),
    prisma.clinicSettings.findUnique({
      where: { clinicId },
      select: { showRatingCount: true },
    }),
  ]);

  if (!doctor) return error("Shifokor topilmadi", 404);

  const showRatingCount = clinicSettingsRow?.showRatingCount ?? false;
  return ok({
    ...doctor,
    compositeRating: doctor.employee?.compositeRating != null ? Number(doctor.employee.compositeRating) : null,
    ratingCount: showRatingCount ? (doctor.employee?.ratingCount ?? null) : null,
    employee: undefined,
  });
}
