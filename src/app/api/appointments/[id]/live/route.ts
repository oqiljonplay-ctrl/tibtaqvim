import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      select: {
        liveLat: true,
        liveLng: true,
        liveLastUpdatedAt: true,
        liveStatus: true,
        liveExpiresAt: true,
      },
    });

    if (!appointment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Server-side auto-expire
    if (
      appointment.liveStatus === "active" &&
      appointment.liveExpiresAt &&
      appointment.liveExpiresAt < new Date()
    ) {
      await prisma.appointment.update({
        where: { id },
        data: { liveStatus: "expired" },
      });
      return NextResponse.json({
        liveLat: appointment.liveLat,
        liveLng: appointment.liveLng,
        liveLastUpdatedAt: appointment.liveLastUpdatedAt,
        liveStatus: "expired",
      });
    }

    return NextResponse.json(appointment);
  } catch (err) {
    console.error("[/api/appointments/[id]/live] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
