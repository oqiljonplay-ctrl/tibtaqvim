import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, error } from "@/lib/api-response";

// GET /api/slots?serviceId=xxx&date=2024-01-01
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const serviceId = searchParams.get("serviceId");
    const dateParam = searchParams.get("date");

    if (!serviceId || !dateParam) return error("serviceId and date are required");

    const date = new Date(dateParam);

    const slots = await prisma.slot.findMany({
      where: { serviceId, date, isActive: true },
      include: {
        _count: {
          select: { appointments: { where: { status: { not: "cancelled" } } } },
        },
      },
      orderBy: { startTime: "asc" },
    });

    const enriched = slots.map((s) => ({
      id: s.id,
      startTime: s.startTime,
      endTime: s.endTime,
      capacity: s.capacity,
      booked: s._count.appointments,
      available: s.capacity - s._count.appointments > 0,
    }));

    return ok(enriched);
  } catch {
    return error("Server error", 500);
  }
}
