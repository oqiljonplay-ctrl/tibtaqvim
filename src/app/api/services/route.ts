import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { error, notFound } from "@/lib/api-response";
import { getClinicServices } from "@/lib/queries/getClinicServices";

// GET /api/services?clinicId=xxx&type=doctor_queue&date=2024-01-01
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const clinicId = searchParams.get("clinicId");
    const branchId = searchParams.get("branchId");
    const type = searchParams.get("type");
    const date = searchParams.get("date");

    if (!clinicId) return error("clinicId is required");

    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId, isActive: true } });
    if (!clinic) return notFound("Clinic not found");

    const result = await getClinicServices({ clinicId, branchId, type, date });
    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch {
    return error("Server error", 500);
  }
}
