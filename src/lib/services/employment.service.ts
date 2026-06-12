import { Prisma } from "@prisma/client";
import { normalizeEmId, nextEmId } from "./em-id.service";

type Tx = Prisma.TransactionClient;

class ApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export { ApiError };

export async function resolveOrCreateEmployee(
  tx: Tx,
  input: {
    emIdInput?: string | null;
    firstName: string;
    lastName?: string | null;
    phone?: string | null;
    profession?: string | null;
    targetClinicId: string;
  }
) {
  const raw = (input.emIdInput ?? "").trim();
  if (!raw) {
    const emId = await nextEmId(tx);
    return tx.employee.create({
      data: {
        emId,
        firstName: input.firstName,
        lastName: input.lastName ?? null,
        phone: input.phone ?? null,
        profession: input.profession ?? "doctor",
        userId: null,
      },
    });
  }

  const emId = normalizeEmId(raw);
  const employee = await tx.employee.findUnique({ where: { emId } });
  if (!employee) throw new ApiError(400, `EM ID topilmadi: ${emId}`);
  if (!employee.isActive) throw new ApiError(400, "Bu EM ID faol emas");

  const activeElsewhere = await tx.employmentStint.count({
    where: {
      employeeId: employee.id,
      endDate: null,
      clinicId: { not: input.targetClinicId },
    },
  });
  if (activeElsewhere >= employee.maxClinics) {
    throw new ApiError(
      403,
      "EM klinika limiti to'lgan. Superadmin ruxsati kerak (maxClinics)."
    );
  }

  return employee;
}

export async function openStint(
  tx: Tx,
  p: {
    employeeId: string;
    clinicId: string;
    role: string;
    doctorId?: string | null;
    staffId?: string | null;
  }
) {
  const active = await tx.employmentStint.findFirst({
    where: { employeeId: p.employeeId, clinicId: p.clinicId, endDate: null },
  });
  if (active) return active;
  return tx.employmentStint.create({
    data: {
      employeeId: p.employeeId,
      clinicId: p.clinicId,
      role: p.role,
      doctorId: p.doctorId ?? null,
      staffId: p.staffId ?? null,
      startDate: new Date(),
    },
  });
}

export async function closeStint(
  tx: Tx,
  p: {
    employeeId: string;
    clinicId: string;
    endReason: string;
  }
) {
  await tx.employmentStint.updateMany({
    where: { employeeId: p.employeeId, clinicId: p.clinicId, endDate: null },
    data: { endDate: new Date(), endReason: p.endReason },
  });
}
