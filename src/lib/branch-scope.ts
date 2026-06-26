import { NextRequest } from "next/server";
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

/**
 * Super_admin uchun: ?clinicId= → acting_clinic cookie → null (hamma).
 * Boshqa rollar: null (getBranchScope o'zi ishlaydi).
 */
export function getActingClinicId(req: NextRequest, auth: JwtPayload): string | null {
  if (auth.role !== "super_admin") return null;
  const explicit = new URL(req.url).searchParams.get("clinicId");
  if (explicit) return explicit;
  return req.cookies.get("acting_clinic")?.value || null;
}

/**
 * getBranchScope uchun wrapper: super_admin → acting_clinic cookie fallback.
 * Mavjud getBranchScope funksiyasini almashtirmaydi.
 */
export function getScope(
  req: NextRequest,
  auth: JwtPayload
): { clinicId?: string; branchId?: string | null } {
  const actingId = getActingClinicId(req, auth);
  // Non-super: getBranchScope o'z URL ?clinicId= ni ham qaytaradi
  if (auth.role !== "super_admin") {
    const explicit = new URL(req.url).searchParams.get("clinicId");
    return getBranchScope(auth, explicit);
  }
  return getBranchScope(auth, actingId);
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
