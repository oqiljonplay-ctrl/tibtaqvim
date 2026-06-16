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

export async function assertClinicCapacity(tx: Tx, clinicId: string) {
  const clinic = await tx.clinic.findUnique({
    where: { id: clinicId },
    select: { maxEmployees: true, name: true },
  });
  if (!clinic) throw new ApiError(404, "Klinika topilmadi");

  if (clinic.maxEmployees === 0) {
    throw new ApiError(
      403,
      "Bu klinikada yangi xodim qo'shish o'chiq (limit 0). Superadmin limitni belgilashi kerak."
    );
  }

  const activeCount = await tx.employmentStint.count({
    where: { clinicId, endDate: null },
  });
  if (activeCount >= clinic.maxEmployees) {
    throw new ApiError(
      403,
      `Klinika xodim limiti to'ldi (${activeCount}/${clinic.maxEmployees}). Yangi xodim qabul qilinmaydi.`
    );
  }
}

export async function attachEmployeeToClinic(
  tx: Tx,
  p: {
    emId: string;
    clinicId: string;
    role: "doctor" | "receptionist";
    branchId?: string | null;
    serviceIds?: string[];
  }
) {
  await assertClinicCapacity(tx, p.clinicId);

  const emId = normalizeEmId(p.emId.trim());
  const employee = await tx.employee.findUnique({ where: { emId } });
  if (!employee) throw new ApiError(404, `EM ID topilmadi: ${emId}`);
  if (!employee.isActive) throw new ApiError(400, "Bu EM ID faol emas");

  const activeElsewhere = await tx.employmentStint.count({
    where: { employeeId: employee.id, endDate: null, clinicId: { not: p.clinicId } },
  });
  if (activeElsewhere >= employee.maxClinics) {
    throw new ApiError(403, "EM klinika limiti to'lgan (maxClinics).");
  }

  if (p.role === "doctor") {
    const existing = await tx.doctor.findFirst({
      where: { employeeId: employee.id, clinicId: p.clinicId },
    });

    let doc;
    if (existing) {
      doc = await tx.doctor.update({
        where: { id: existing.id },
        data: {
          isActive: true, isHidden: false,
          branchId: p.branchId ?? existing.branchId,
          ...(employee.userId ? { userId: employee.userId } : {}),
          firstName: employee.firstName,
          lastName: employee.lastName ?? existing.lastName,
          specialty: employee.specialty ?? existing.specialty,
          photoUrl: employee.photoUrl ?? existing.photoUrl,
          ...(Array.isArray(p.serviceIds) && p.serviceIds.length > 0
            ? { services: { deleteMany: {}, create: p.serviceIds.map((serviceId) => ({ serviceId })) } }
            : {}),
        },
      });
    } else {
      doc = await tx.doctor.create({
        data: {
          clinicId: p.clinicId,
          branchId: p.branchId ?? null,
          employeeId: employee.id,
          userId: employee.userId,
          firstName: employee.firstName,
          lastName: employee.lastName ?? "",
          specialty: employee.specialty ?? "Shifokor",
          photoUrl: employee.photoUrl ?? null,
          isActive: true,
          ...(Array.isArray(p.serviceIds) && p.serviceIds.length > 0
            ? { services: { create: p.serviceIds.map((serviceId) => ({ serviceId })) } }
            : {}),
        },
      });
    }

    await openStint(tx, { employeeId: employee.id, clinicId: p.clinicId, role: "doctor", doctorId: doc.id });

    await tx.auditLog.create({
      data: {
        actorId: "system",
        clinicId: p.clinicId,
        action: "employee.attached",
        payload: { emId, employeeId: employee.id, doctorId: doc.id, reactivated: !!existing },
      },
    });

    return { doctorId: doc.id, reactivated: !!existing, employee };
  }

  // role === receptionist
  const existing = await tx.staff.findFirst({
    where: { employeeId: employee.id, clinicId: p.clinicId },
  });

  let staffRec;
  if (existing) {
    staffRec = await tx.staff.update({
      where: { id: existing.id },
      data: {
        isActive: true,
        branchId: p.branchId ?? existing.branchId,
        ...(employee.userId ? { userId: employee.userId } : {}),
        firstName: employee.firstName,
        lastName: employee.lastName ?? existing.lastName,
        photoUrl: employee.photoUrl ?? existing.photoUrl,
      },
    });
  } else {
    staffRec = await tx.staff.create({
      data: {
        clinicId: p.clinicId,
        branchId: p.branchId ?? null,
        employeeId: employee.id,
        userId: employee.userId,
        firstName: employee.firstName,
        lastName: employee.lastName ?? "",
        role: "receptionist",
        photoUrl: employee.photoUrl ?? null,
      },
    });
  }

  await openStint(tx, { employeeId: employee.id, clinicId: p.clinicId, role: "receptionist", staffId: staffRec.id });

  await tx.auditLog.create({
    data: {
      actorId: "system",
      clinicId: p.clinicId,
      action: "employee.attached",
      payload: { emId, employeeId: employee.id, staffId: staffRec.id, reactivated: !!existing },
    },
  });

  return { staffId: staffRec.id, reactivated: !!existing, employee };
}
