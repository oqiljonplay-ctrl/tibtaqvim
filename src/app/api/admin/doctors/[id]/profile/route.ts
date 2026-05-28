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

    return ok(doctor);
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
      select: { id: true, clinicId: true, branchId: true },
    });
    if (!doctor) return notFound("Shifokor topilmadi");

    if (auth.role !== "super_admin" && doctor.clinicId !== auth.clinicId) return forbidden();
    if (auth.role === "branch_admin" && doctor.branchId !== auth.branchId) return forbidden();

    const body = await req.json();
    const {
      education, position, department, workSchedule, operationsCount, bio,
      specialties, directions, experiences, workplaces,
    } = body;

    if (
      education === undefined && position === undefined && department === undefined &&
      workSchedule === undefined && operationsCount === undefined && bio === undefined &&
      !Array.isArray(specialties) && !Array.isArray(directions) &&
      !Array.isArray(experiences) && !Array.isArray(workplaces)
    ) {
      return error("Hech bo'lmasa bitta maydon yuborilsin");
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.doctor.update({
        where: { id: doctor.id },
        data: {
          ...(education       !== undefined && { education }),
          ...(position        !== undefined && { position }),
          ...(department      !== undefined && { department }),
          ...(workSchedule    !== undefined && { workSchedule }),
          ...(typeof operationsCount === "number" && { operationsCount }),
          ...(bio             !== undefined && { bio }),
        },
      });

      if (Array.isArray(specialties)) {
        await tx.doctorSpecialty.deleteMany({ where: { doctorId: doctor.id } });
        if (specialties.length > 0) {
          await tx.doctorSpecialty.createMany({
            data: specialties.map((name: string, i: number) => ({
              id: `${doctor.id}_sp_${i}_${Date.now()}`,
              doctorId: doctor.id, name: String(name).trim(), sortOrder: i,
            })),
          });
        }
      }

      if (Array.isArray(directions)) {
        await tx.doctorDirection.deleteMany({ where: { doctorId: doctor.id } });
        if (directions.length > 0) {
          await tx.doctorDirection.createMany({
            data: directions.map((name: string, i: number) => ({
              id: `${doctor.id}_dir_${i}_${Date.now()}`,
              doctorId: doctor.id, name: String(name).trim(), sortOrder: i,
            })),
          });
        }
      }

      if (Array.isArray(experiences)) {
        await tx.doctorExperience.deleteMany({ where: { doctorId: doctor.id } });
        if (experiences.length > 0) {
          await tx.doctorExperience.createMany({
            data: experiences.map((exp: { place: string; startYear: number; endYear?: number | null }, i: number) => ({
              id: `${doctor.id}_exp_${i}_${Date.now()}`,
              doctorId: doctor.id,
              place: String(exp.place).trim(),
              startYear: Number(exp.startYear),
              endYear: exp.endYear ? Number(exp.endYear) : null,
              sortOrder: i,
            })),
          });
        }
      }

      if (Array.isArray(workplaces)) {
        await tx.doctorWorkplace.deleteMany({ where: { doctorId: doctor.id } });
        if (workplaces.length > 0) {
          await tx.doctorWorkplace.createMany({
            data: workplaces.map((place: string, i: number) => ({
              id: `${doctor.id}_wp_${i}_${Date.now()}`,
              doctorId: doctor.id, place: String(place).trim(), sortOrder: i,
            })),
          });
        }
      }

      return tx.doctor.findUnique({
        where: { id: doctor.id },
        include: profileInclude(),
      });
    });

    return ok(updated);
  } catch {
    return serverError();
  }
}
