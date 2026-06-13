import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound, serverError } from "@/lib/api-response";

type Params = { params: { id: string } };

function profileInclude() {
  return {
    specialties: { orderBy: { sortOrder: "asc" as const } },
    directions:  { orderBy: { sortOrder: "asc" as const } },
    experiences: { orderBy: { sortOrder: "asc" as const } },
    workplaces:  { orderBy: { sortOrder: "asc" as const } },
    employee: {
      select: {
        id: true, emId: true,
        photoUrl: true, specialty: true,
        education: true, position: true, department: true,
        bio: true, workSchedule: true, operationsCount: true,
        firstName: true, lastName: true,
        specialties:  { orderBy: { sortOrder: "asc" as const }, select: { id: true, name: true, sortOrder: true } },
        directions:   { orderBy: { sortOrder: "asc" as const }, select: { id: true, name: true, sortOrder: true } },
        experiences:  { orderBy: { sortOrder: "asc" as const }, select: { id: true, place: true, startYear: true, endYear: true, sortOrder: true } },
        workplaces:   { orderBy: { sortOrder: "asc" as const }, select: { id: true, place: true, sortOrder: true } },
      },
    },
  };
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();

    const doctor = await prisma.doctor.findUnique({
      where: { id: params.id },
      include: profileInclude(),
    });
    if (!doctor) return notFound("Shifokor topilmadi");

    if (auth.role !== "super_admin" && doctor.clinicId !== auth.clinicId) return forbidden();
    if (auth.role === "branch_admin" && doctor.branchId !== auth.branchId) return forbidden();

    const emp = doctor.employee;
    return ok({
      ...doctor,
      firstName:      emp?.firstName      ?? doctor.firstName,
      lastName:       emp?.lastName       ?? doctor.lastName,
      photoUrl:       emp?.photoUrl       ?? doctor.photoUrl,
      specialty:      emp?.specialty      ?? doctor.specialty,
      education:      emp?.education      ?? doctor.education,
      position:       emp?.position       ?? doctor.position,
      department:     emp?.department     ?? doctor.department,
      bio:            emp?.bio            ?? doctor.bio,
      workSchedule:   emp?.workSchedule   ?? doctor.workSchedule,
      operationsCount: emp?.operationsCount ?? doctor.operationsCount,
      specialties:    emp?.specialties?.length ? emp.specialties : doctor.specialties,
      directions:     emp?.directions?.length  ? emp.directions  : doctor.directions,
      experiences:    emp?.experiences?.length ? emp.experiences : doctor.experiences,
      workplaces:     emp?.workplaces?.length  ? emp.workplaces  : doctor.workplaces,
    });
  } catch {
    return serverError();
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();

    const doctor = await prisma.doctor.findUnique({
      where: { id: params.id },
      select: { id: true, clinicId: true, branchId: true, employeeId: true },
    });
    if (!doctor) return notFound("Shifokor topilmadi");

    if (auth.role !== "super_admin" && doctor.clinicId !== auth.clinicId) return forbidden();
    if (auth.role === "branch_admin" && doctor.branchId !== auth.branchId) return forbidden();

    const body = await req.json();
    const {
      education, position, department, workSchedule, operationsCount, bio, photoUrl,
      specialties, directions, experiences, workplaces,
    } = body;

    if (
      education === undefined && position === undefined && department === undefined &&
      workSchedule === undefined && operationsCount === undefined && bio === undefined &&
      photoUrl === undefined &&
      !Array.isArray(specialties) && !Array.isArray(directions) &&
      !Array.isArray(experiences) && !Array.isArray(workplaces)
    ) {
      return error("Hech bo'lmasa bitta maydon yuborilsin");
    }

    const empId = doctor.employeeId;
    const ts = Date.now();

    await prisma.$transaction(async (tx) => {
      if (empId) {
        await tx.employee.update({
          where: { id: empId },
          data: {
            ...(education       !== undefined && { education }),
            ...(position        !== undefined && { position }),
            ...(department      !== undefined && { department }),
            ...(workSchedule    !== undefined && { workSchedule }),
            ...(typeof operationsCount === "number" && { operationsCount }),
            ...(bio             !== undefined && { bio }),
            ...(photoUrl        !== undefined && { photoUrl }),
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
      } else {
        // employeeId yo'q (eski doctor) — doctor jadvaliga yoziladi (fallback)
        await tx.doctor.update({
          where: { id: doctor.id },
          data: {
            ...(education       !== undefined && { education }),
            ...(position        !== undefined && { position }),
            ...(department      !== undefined && { department }),
            ...(workSchedule    !== undefined && { workSchedule }),
            ...(typeof operationsCount === "number" && { operationsCount }),
            ...(bio             !== undefined && { bio }),
            ...(photoUrl        !== undefined && { photoUrl }),
          },
        });
      }
    });

    const updated = await prisma.doctor.findUnique({
      where: { id: doctor.id },
      include: profileInclude(),
    });
    const emp = updated?.employee;
    return ok({
      ...updated,
      photoUrl:       emp?.photoUrl       ?? updated?.photoUrl,
      specialty:      emp?.specialty      ?? updated?.specialty,
      education:      emp?.education      ?? updated?.education,
      position:       emp?.position       ?? updated?.position,
      department:     emp?.department     ?? updated?.department,
      bio:            emp?.bio            ?? updated?.bio,
      workSchedule:   emp?.workSchedule   ?? updated?.workSchedule,
      operationsCount: emp?.operationsCount ?? updated?.operationsCount,
      specialties:    emp?.specialties?.length ? emp.specialties : updated?.specialties,
      directions:     emp?.directions?.length  ? emp.directions  : updated?.directions,
      experiences:    emp?.experiences?.length ? emp.experiences : updated?.experiences,
      workplaces:     emp?.workplaces?.length  ? emp.workplaces  : updated?.workplaces,
    });
  } catch {
    return serverError();
  }
}
