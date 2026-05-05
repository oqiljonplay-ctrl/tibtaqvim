// Rol bo'yicha statistika filter va ruxsat mantiqi

export type StatsRole = "super_admin" | "clinic_admin" | "doctor" | "denied";

export interface StatsScope {
  role: StatsRole;
  clinicId: string | null;
  doctorId: string | null;
}

export function getStatsScope(user: {
  role: string;
  clinicId?: string | null;
  doctorId?: string | null;
}): StatsScope {
  switch (user.role) {
    case "super_admin":
      return { role: "super_admin", clinicId: null, doctorId: null };
    case "clinic_admin":
      return { role: "clinic_admin", clinicId: user.clinicId ?? null, doctorId: null };
    case "doctor":
      return { role: "doctor", clinicId: user.clinicId ?? null, doctorId: user.doctorId ?? null };
    default:
      return { role: "denied", clinicId: null, doctorId: null };
  }
}

export function buildAppointmentsWhere(scope: StatsScope): Record<string, unknown> {
  const where: Record<string, unknown> = {};

  if (scope.role === "denied") {
    where.id = "no_access";
    return where;
  }

  if (scope.clinicId) where.clinicId = scope.clinicId;
  if (scope.doctorId) where.doctorId = scope.doctorId;

  return where;
}
