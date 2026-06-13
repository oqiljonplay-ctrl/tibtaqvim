import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireEmVerified } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound, serverError } from "@/lib/api-response";

function doctorProfileInclude() {
  return {
    specialties:  { orderBy: { sortOrder: "asc" as const } },
    directions:   { orderBy: { sortOrder: "asc" as const } },
    experiences:  { orderBy: { sortOrder: "asc" as const } },
    workplaces:   { orderBy: { sortOrder: "asc" as const } },
    employee: {
      select: {
        id: true, emId: true,
        photoUrl: true, specialty: true,
        education: true, position: true, department: true,
        bio: true, workSchedule: true, operationsCount: true,
        firstName: true, lastName: true,
        stints: { where: { endDate: null }, select: { id: true, clinicId: true, clinic: { select: { name: true, logoUrl: true } } }, take: 5 },
        specialties:  { orderBy: { sortOrder: "asc" as const }, select: { id: true, name: true, sortOrder: true } },
        directions:   { orderBy: { sortOrder: "asc" as const }, select: { id: true, name: true, sortOrder: true } },
        experiences:  { orderBy: { sortOrder: "asc" as const }, select: { id: true, place: true, startYear: true, endYear: true, sortOrder: true } },
        workplaces:   { orderBy: { sortOrder: "asc" as const }, select: { id: true, place: true, sortOrder: true } },
      },
    },
  };
}

function mergePortatif(doctor: Record<string, unknown>, employee: Record<string, unknown> | null | undefined) {
  if (!employee) return doctor;
  return {
    ...doctor,
    firstName:      (employee.firstName as string | null) ?? doctor.firstName,
    lastName:       (employee.lastName as string | null)  ?? doctor.lastName,
    photoUrl:       (employee.photoUrl as string | null)  ?? doctor.photoUrl,
    specialty:      (employee.specialty as string | null) ?? doctor.specialty,
    education:      employee.education,
    position:       employee.position,
    department:     employee.department,
    bio:            employee.bio,
    workSchedule:   employee.workSchedule,
    operationsCount: (employee.operationsCount as number | null) ?? doctor.operationsCount,
    specialties:    (employee.specialties as unknown[])?.length ? employee.specialties : doctor.specialties,
    directions:     (employee.directions as unknown[])?.length  ? employee.directions  : doctor.directions,
    experiences:    (employee.experiences as unknown[])?.length ? employee.experiences : doctor.experiences,
    workplaces:     (employee.workplaces as unknown[])?.length  ? employee.workplaces  : doctor.workplaces,
  };
}

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (auth.role !== "doctor") return forbidden();

    if (!(await requireEmVerified(req, auth))) {
      return error({ code: "EM_REQUIRED", message: "EM id tasdiqlanmagan" }, 403);
    }

    // EM orqali shifokorni topish (faol va nofaolni ham)
    const doctor = await prisma.doctor.findFirst({
      where: { userId: auth.userId },
      include: doctorProfileInclude(),
    });

    const employee = doctor?.employee ?? null;
    const hasActiveStint = (employee?.stints?.length ?? 0) > 0;
    const isActiveDoctor = doctor?.isActive ?? false;

    if (doctor) {
      const merged = mergePortatif(
        { ...doctor } as Record<string, unknown>,
        employee as Record<string, unknown> | null
      );
      return ok({
        ...merged,
        emId: employee?.emId ?? null,
        activeStints: employee?.stints ?? [],
        inactive: !hasActiveStint || !isActiveDoctor,
      });
    }

    return notFound("Shifokor topilmadi");
  } catch {
    return serverError();
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (auth.role !== "doctor") return forbidden();

    if (!(await requireEmVerified(req, auth))) {
      return error({ code: "EM_REQUIRED", message: "EM id tasdiqlanmagan" }, 403);
    }

    const doctor = await prisma.doctor.findFirst({
      where: { userId: auth.userId },
      select: { id: true, employeeId: true },
    });
    if (!doctor) return notFound("Shifokor topilmadi");
    if (!doctor.employeeId) return error("EM ID topilmadi", 400);

    const body = await req.json();
    const {
      education, position, department, workSchedule, operationsCount, bio,
      specialties, directions, experiences, workplaces, photoUrl,
    } = body;

    const empId = doctor.employeeId;
    const ts = Date.now();

    await prisma.$transaction(async (tx) => {
      // Portativ maydonlar EM'ga yoziladi
      await tx.employee.update({
        where: { id: empId },
        data: {
          education:       education       ?? undefined,
          position:        position        ?? undefined,
          department:      department      ?? undefined,
          workSchedule:    workSchedule    ?? undefined,
          operationsCount: typeof operationsCount === "number" ? operationsCount : undefined,
          bio:             bio             ?? undefined,
          photoUrl:        photoUrl        ?? undefined,
        },
      });

      if (Array.isArray(specialties)) {
        await tx.doctorSpecialty.deleteMany({ where: { employeeId: empId } });
        if (specialties.length > 0) {
          await tx.doctorSpecialty.createMany({
            data: specialties.map((name: string, i: number) => ({
              id: `${empId}_sp_${i}_${ts}`,
              doctorId: doctor.id, employeeId: empId,
              name: String(name).trim(), sortOrder: i,
            })),
          });
        }
      }

      if (Array.isArray(directions)) {
        await tx.doctorDirection.deleteMany({ where: { employeeId: empId } });
        if (directions.length > 0) {
          await tx.doctorDirection.createMany({
            data: directions.map((name: string, i: number) => ({
              id: `${empId}_dir_${i}_${ts}`,
              doctorId: doctor.id, employeeId: empId,
              name: String(name).trim(), sortOrder: i,
            })),
          });
        }
      }

      if (Array.isArray(experiences)) {
        await tx.doctorExperience.deleteMany({ where: { employeeId: empId } });
        if (experiences.length > 0) {
          await tx.doctorExperience.createMany({
            data: experiences.map((exp: { place: string; startYear: number; endYear?: number | null }, i: number) => ({
              id: `${empId}_exp_${i}_${ts}`,
              doctorId: doctor.id, employeeId: empId,
              place: String(exp.place).trim(),
              startYear: Number(exp.startYear),
              endYear: exp.endYear ? Number(exp.endYear) : null,
              sortOrder: i,
            })),
          });
        }
      }

      if (Array.isArray(workplaces)) {
        await tx.doctorWorkplace.deleteMany({ where: { employeeId: empId } });
        if (workplaces.length > 0) {
          await tx.doctorWorkplace.createMany({
            data: workplaces.map((place: string, i: number) => ({
              id: `${empId}_wp_${i}_${ts}`,
              doctorId: doctor.id, employeeId: empId,
              place: String(place).trim(), sortOrder: i,
            })),
          });
        }
      }
    });

    const updatedDoctor = await prisma.doctor.findUnique({
      where: { id: doctor.id },
      include: doctorProfileInclude(),
    });
    const merged = mergePortatif(
      { ...updatedDoctor } as Record<string, unknown>,
      updatedDoctor?.employee as Record<string, unknown> | null
    );
    return ok({ ...merged, emId: updatedDoctor?.employee?.emId ?? null });
  } catch {
    return serverError();
  }
}
