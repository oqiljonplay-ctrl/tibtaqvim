import { UserRole } from "@prisma/client";
import type { JwtPayload } from "./auth";

export type SessionUser = {
  id: string;
  role: UserRole;
  clinicId: string | null;
  branchId: string | null;
};

export function sessionUser(jwt: JwtPayload): SessionUser {
  return {
    id: jwt.userId,
    role: jwt.role as UserRole,
    clinicId: jwt.clinicId,
    branchId: jwt.branchId ?? null,
  };
}

export function canManageClinic(user: SessionUser, clinicId: string): boolean {
  if (user.role === "super_admin") return true;
  if (user.role === "clinic_admin" && user.clinicId === clinicId) return true;
  return false;
}

export function canManageBranch(
  user: SessionUser,
  branchClinicId: string,
  branchId: string
): boolean {
  if (user.role === "super_admin") return true;
  if (user.role === "clinic_admin" && user.clinicId === branchClinicId) return true;
  if (user.role === "branch_admin" && user.branchId === branchId) return true;
  return false;
}

export function canCreateBranchAdmin(
  user: SessionUser,
  branchClinicId: string
): boolean {
  if (user.role === "super_admin") return true;
  if (user.role === "clinic_admin" && user.clinicId === branchClinicId) return true;
  return false;
}

export function canViewBranch(
  user: SessionUser,
  branchClinicId: string,
  branchId: string
): boolean {
  return canManageBranch(user, branchClinicId, branchId);
}

export function forbidden(message = "Forbidden") {
  return Response.json({ error: message }, { status: 403 });
}
