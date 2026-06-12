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

    const doctor = await prisma.doctor.findFirst({
      where: { userId: auth.userId, isActive: true },
      include: {
        ...doctorProfileInclude(),
        employee: { select: { emId: true } },
      },
    });

    if (!doctor) return notFound("Shifokor topilmadi");
    return ok({ ...doctor, emId: doctor.employee?.emId ?? null });
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
      where: { userId: auth.userId, isActive: true },
      select: { id: true },
    });
    if (!doctor) return notFound("Shifokor topilmadi");

    const body = await req.json();
    const {
      education, position, department, workSchedule, operationsCount, bio,
      specialties, directions, experiences, workplaces,
    } = body;

    const updated = await prisma.$transaction(async (tx) => {
      const doc = await tx.doctor.update({
        where: { id: doctor.id },
        data: {
          education:       education       ?? undefined,
          position:        position        ?? undefined,
          department:      department      ?? undefined,
          workSchedule:    workSchedule    ?? undefined,
          operationsCount: typeof operationsCount === "number" ? operationsCount : undefined,
          bio:             bio             ?? undefined,
        },
      });

      if (Array.isArray(specialties)) {
        await tx.doctorSpecialty.deleteMany({ where: { doctorId: doc.id } });
        if (specialties.length > 0) {
          await tx.doctorSpecialty.createMany({
            data: specialties.map((name: string, i: number) => ({
              id: `${doc.id}_sp_${i}_${Date.now()}`,
              doctorId: doc.id, name: String(name).trim(), sortOrder: i,
            })),
          });
        }
      }

      if (Array.isArray(directions)) {
        await tx.doctorDirection.deleteMany({ where: { doctorId: doc.id } });
        if (directions.length > 0) {
          await tx.doctorDirection.createMany({
            data: directions.map((name: string, i: number) => ({
              id: `${doc.id}_dir_${i}_${Date.now()}`,
              doctorId: doc.id, name: String(name).trim(), sortOrder: i,
            })),
          });
        }
      }

      if (Array.isArray(experiences)) {
        await tx.doctorExperience.deleteMany({ where: { doctorId: doc.id } });
        if (experiences.length > 0) {
          await tx.doctorExperience.createMany({
            data: experiences.map((exp: { place: string; startYear: number; endYear?: number | null }, i: number) => ({
              id: `${doc.id}_exp_${i}_${Date.now()}`,
              doctorId: doc.id,
              place: String(exp.place).trim(),
              startYear: Number(exp.startYear),
              endYear: exp.endYear ? Number(exp.endYear) : null,
              sortOrder: i,
            })),
          });
        }
      }

      if (Array.isArray(workplaces)) {
        await tx.doctorWorkplace.deleteMany({ where: { doctorId: doc.id } });
        if (workplaces.length > 0) {
          await tx.doctorWorkplace.createMany({
            data: workplaces.map((place: string, i: number) => ({
              id: `${doc.id}_wp_${i}_${Date.now()}`,
              doctorId: doc.id, place: String(place).trim(), sortOrder: i,
            })),
          });
        }
      }

      return tx.doctor.findUnique({
        where: { id: doc.id },
        include: doctorProfileInclude(),
      });
    });

    return ok(updated);
  } catch {
    return serverError();
  }
}
