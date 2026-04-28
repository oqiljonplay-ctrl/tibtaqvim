import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, created, error, unauthorized, forbidden } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (auth.role !== "super_admin") return forbidden();

    const clinics = await prisma.clinic.findMany({
      include: { _count: { select: { branches: true, doctors: true, services: true } } },
      orderBy: { createdAt: "desc" },
    });

    return ok(clinics);
  } catch {
    return error("Server error", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (auth.role !== "super_admin") return forbidden();

    const { name, phone, address, logoUrl } = await req.json();
    if (!name) return error("name is required");

    const clinic = await prisma.clinic.create({
      data: { name, phone, address, logoUrl },
    });

    return created(clinic);
  } catch {
    return error("Server error", 500);
  }
}
