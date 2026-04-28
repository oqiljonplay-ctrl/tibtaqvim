import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, created, error, unauthorized, forbidden } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();

    const clinicId = auth.role === "super_admin"
      ? new URL(req.url).searchParams.get("clinicId") || undefined
      : auth.clinicId!;

    const services = await prisma.service.findMany({
      where: { ...(clinicId ? { clinicId } : {}), isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return ok(services.map((s) => ({ ...s, price: Number(s.price) })));
  } catch {
    return error("Server error", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (!["super_admin", "clinic_admin"].includes(auth.role)) return forbidden();

    const body = await req.json();
    const { name, type, price, requiresSlot, requiresAddress, dailyLimit, description, sortOrder } = body;

    if (!name || !type || price === undefined) {
      return error("name, type, price are required");
    }

    const clinicId = auth.role === "super_admin" ? body.clinicId : auth.clinicId;
    if (!clinicId) return error("clinicId required");

    const service = await prisma.service.create({
      data: {
        clinicId,
        name,
        type,
        price,
        requiresSlot: requiresSlot ?? false,
        requiresAddress: requiresAddress ?? false,
        dailyLimit: dailyLimit ?? null,
        description: description ?? null,
        sortOrder: sortOrder ?? 0,
      },
    });

    return created({ ...service, price: Number(service.price) });
  } catch {
    return error("Server error", 500);
  }
}
