import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, created, error, unauthorized, forbidden } from "@/lib/api-response";
import { getBranchScope, canManageResources } from "@/lib/branch-scope";

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();

    const explicitClinicId = new URL(req.url).searchParams.get("clinicId");
    const scope = getBranchScope(auth, explicitClinicId);

    const services = await prisma.service.findMany({
      where: { ...scope, isActive: true },
      include: {
        doctors: {
          include: {
            doctor: {
              select: { id: true, firstName: true, lastName: true, specialty: true, photoUrl: true, isActive: true },
            },
          },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return ok(services.map((s) => ({
      ...s,
      price: Number(s.price),
      prePaymentAmount: s.prePaymentAmount ? Number(s.prePaymentAmount) : null,
      doctors: s.doctors.map((sd) => sd.doctor),
    })));
  } catch {
    return error("Server error", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (!canManageResources(auth)) return forbidden();

    const body = await req.json();
    const {
      name, type, price, requiresAddress, dailyLimit,
      description, sortOrder, requiresPrePayment, prePaymentAmount, doctorIds,
    } = body;

    if (!name || !type || price === undefined) {
      return error("name, type, price are required");
    }

    const clinicId = auth.role === "super_admin" ? body.clinicId : auth.clinicId;
    if (!clinicId) return error("clinicId required");

    // Mahalliy branchId hisoblash (resolveBranchIdForCreate tegmasdan)
    let branchId: string | null = null;
    if (auth.role === "super_admin") {
      branchId = body.branchId ?? null;
    } else if (auth.role === "clinic_admin") {
      if (body.branchId) {
        const branch = await prisma.branch.findFirst({
          where: { id: body.branchId, isActive: true },
          select: { clinicId: true },
        });
        if (!branch || branch.clinicId !== auth.clinicId) return forbidden();
        branchId = body.branchId;
      }
      // body.branchId yo'q = global xizmat (null) — joiz
    } else if (auth.role === "branch_admin") {
      branchId = auth.branchId ?? null;
    }

    const service = await prisma.service.create({
      data: {
        clinicId,
        branchId,
        name,
        type,
        price,
        requiresSlot: false,
        requiresAddress: requiresAddress ?? false,
        requiresPrePayment: requiresPrePayment ?? false,
        prePaymentAmount: prePaymentAmount ?? null,
        dailyLimit: dailyLimit ?? null,
        description: description ?? null,
        sortOrder: sortOrder ?? 0,
        ...(Array.isArray(doctorIds) && doctorIds.length > 0
          ? { doctors: { create: doctorIds.map((doctorId: string) => ({ doctorId })) } }
          : {}),
      },
      include: {
        doctors: {
          include: {
            doctor: {
              select: { id: true, firstName: true, lastName: true, specialty: true, photoUrl: true, isActive: true },
            },
          },
        },
      },
    });

    return created({
      ...service,
      price: Number(service.price),
      prePaymentAmount: service.prePaymentAmount ? Number(service.prePaymentAmount) : null,
      doctors: service.doctors.map((sd) => sd.doctor),
    });
  } catch {
    return error("Server error", 500);
  }
}
