import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, error, unauthorized, forbidden } from "@/lib/api-response";

// GET /api/doctor/clinics — barcha faol klinikalar + bu xodimning holati
export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (auth.role !== "doctor") return forbidden();

    // Employee topish
    const employee = await prisma.employee.findUnique({
      where: { userId: auth.userId },
      select: {
        id: true, maxJobRequests: true, maxClinics: true,
        stints: {
          where: { endDate: null },
          select: { clinicId: true },
        },
        jobRequests: {
          where: { status: "pending" },
          select: { clinicId: true, id: true },
        },
      },
    });
    if (!employee) return error("Xodim topilmadi", 404);

    const activeClinicsSet = new Set(employee.stints.map((s) => s.clinicId));
    const pendingSet = new Map(employee.jobRequests.map((r) => [r.clinicId, r.id]));
    const pendingCount = employee.jobRequests.length;

    const clinics = await prisma.clinic.findMany({
      where: { isActive: true },
      select: {
        id: true, name: true, address: true, logoUrl: true,
        city: true, workingHours: true, description: true,
      },
      orderBy: { name: "asc" },
    });

    return ok({
      clinics: clinics.map((c) => ({
        ...c,
        status: activeClinicsSet.has(c.id)
          ? "active"
          : pendingSet.has(c.id)
            ? "pending"
            : "none",
        requestId: pendingSet.get(c.id) ?? null,
      })),
      limits: {
        maxClinics: employee.maxClinics,
        activeClinics: activeClinicsSet.size,
        maxJobRequests: employee.maxJobRequests,
        pendingRequests: pendingCount,
      },
    });
  } catch {
    return error("Server xatosi", 500);
  }
}
