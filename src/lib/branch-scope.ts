import { JwtPayload } from "@/lib/auth";

/**
 * Admin API'lar uchun branch-darajali scope filtri.
 * super_admin   → barcha (clinicId ixtiyoriy)
 * clinic_admin  → o'z klinikasi, barcha filiallar (branchId filteri yo'q)
 * branch_admin  → o'z klinikasi, faqat o'z filiali (branchId = auth.branchId)
 */
export function getBranchScope(
  auth: JwtPayload,
  explicitClinicId?: string | null
): { clinicId?: string; branchId?: string | null } {
  if (auth.role === "super_admin") {
    return explicitClinicId ? { clinicId: explicitClinicId } : {};
  }
  // Non-super_admin: clinicId majburiy — yo'q bo'lsa butun DB filter yo'qoladi
  if (!auth.clinicId) {
    throw new Error(`[getBranchScope] clinicId yo'q — rol: ${auth.role}, userId: ${auth.userId}`);
  }
  if (auth.role === "clinic_admin") {
    return { clinicId: auth.clinicId };
  }
  if (auth.role === "branch_admin") {
    return { clinicId: auth.clinicId, branchId: auth.branchId ?? undefined };
  }
  return { clinicId: auth.clinicId };
}

/**
 * Yangi resurs yaratishda branchId ni aniqlaydi.
 * super_admin  → body.branchId (ixtiyoriy)
 * clinic_admin → null (bosh ofis)
 * branch_admin → auth.branchId (o'z filiali, majburiy)
 */
export function resolveBranchIdForCreate(
  auth: JwtPayload,
  bodyBranchId?: string | null
): string | null {
  if (auth.role === "super_admin") return bodyBranchId ?? null;
  if (auth.role === "clinic_admin") return null;
  if (auth.role === "branch_admin") return auth.branchId ?? null;
  return null;
}

/** Admin yaratishga ruxsat — faqat super_admin */
export function canCreateAdmin(auth: JwtPayload): boolean {
  return auth.role === "super_admin";
}

/** Filial yaratishga ruxsat — super_admin va clinic_admin */
export function canCreateBranch(auth: JwtPayload): boolean {
  return auth.role === "super_admin" || auth.role === "clinic_admin";
}

/** Xizmat/shifokor/xodim boshqarishga ruxsat — admin rollar */
export function canManageResources(auth: JwtPayload): boolean {
  return ["super_admin", "clinic_admin", "branch_admin"].includes(auth.role);
}
