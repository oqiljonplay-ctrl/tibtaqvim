import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound } from "@/lib/api-response";

export const dynamic = "force-dynamic";

async function resolveBranch(id: string, auth: { role: string; clinicId: string | null }) {
  const branch = await prisma.branch.findUnique({ where: { id } });
  if (!branch) return null;
  if (auth.role === "clinic_admin" && branch.clinicId !== auth.clinicId) return null;
  return branch;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (!["super_admin", "clinic_admin"].includes(auth.role)) return forbidden();

    const branch = await resolveBranch(params.id, auth);
    if (!branch) return notFound();
    return ok(branch);
  } catch {
    return error("Server error", 500);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (!["super_admin", "clinic_admin"].includes(auth.role)) return forbidden();

    const existing = await resolveBranch(params.id, auth);
    if (!existing) return notFound();

    const body = await req.json();
    const { name, address, phone, workingHours, nearbyMetro, latitude, longitude, sortOrder, isActive } = body;

    const branch = await prisma.branch.update({
      where: { id: params.id },
      data: {
        ...(name         != null ? { name:         name.trim() }         : {}),
        ...(address      != null ? { address:      address?.trim()      || null } : {}),
        ...(phone        != null ? { phone:        phone?.trim()        || null } : {}),
        ...(workingHours != null ? { workingHours: workingHours?.trim() || null } : {}),
        ...(nearbyMetro  != null ? { nearbyMetro:  nearbyMetro?.trim()  || null } : {}),
        ...(latitude     != null ? { latitude:     Number(latitude)  }  : {}),
        ...(longitude    != null ? { longitude:    Number(longitude) }  : {}),
        ...(sortOrder    != null ? { sortOrder:    Number(sortOrder) }  : {}),
        ...(isActive     != null ? { isActive }                         : {}),
      },
    });

    return ok(branch);
  } catch {
    return error("Server error", 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (!["super_admin", "clinic_admin"].includes(auth.role)) return forbidden();

    const existing = await resolveBranch(params.id, auth);
    if (!existing) return notFound();

    // Soft delete: isActive = false
    await prisma.branch.update({ where: { id: params.id }, data: { isActive: false } });
    return ok({ message: "Filial nofaol qilindi" });
  } catch {
    return error("Server error", 500);
  }
}
