import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, created, error, unauthorized, forbidden, notFound } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/doctors/[id]/blocked-dates
 * Bloklar ro'yxati — reason va createdBy bilan (UI uchun).
 * Auth: shifokor o'zi | klinika admin | super_admin
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();

    const doctor = await prisma.doctor.findUnique({
      where: { id: params.id },
      select: { id: true, clinicId: true, userId: true },
    });
    if (!doctor) return notFound("Shifokor topilmadi");

    const allowed = await canManageDoctor(auth, doctor);
    if (!allowed) return forbidden();

    const blocks = await prisma.doctorBlockedDate.findMany({
      where: { doctorId: params.id },
      orderBy: { createdAt: "desc" },
    });

    return ok(blocks);
  } catch {
    return error("Server xatosi", 500);
  }
}

/**
 * POST /api/doctors/[id]/blocked-dates
 * Yangi blok qo'shish.
 * Body: { type: 'recurring'|'once', weekday?: 0-6, date?: 'YYYY-MM-DD', reason?: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();

    const doctor = await prisma.doctor.findUnique({
      where: { id: params.id },
      select: { id: true, clinicId: true, userId: true },
    });
    if (!doctor) return notFound("Shifokor topilmadi");

    const allowed = await canManageDoctor(auth, doctor);
    if (!allowed) return forbidden();

    const body = await req.json();
    const { type, weekday, date, reason } = body;

    if (!["recurring", "once"].includes(type)) {
      return error("type 'recurring' yoki 'once' bo'lishi kerak");
    }
    if (type === "recurring") {
      if (weekday == null || weekday < 0 || weekday > 6) {
        return error("recurring uchun weekday 0-6 majburiy");
      }
    }
    if (type === "once") {
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return error("once uchun date 'YYYY-MM-DD' formatda majburiy");
      }
    }

    const block = await prisma.doctorBlockedDate.create({
      data: {
        doctorId: params.id,
        type,
        weekday: type === "recurring" ? Number(weekday) : null,
        date: type === "once" ? date : null,
        reason: reason?.trim() || null,
        createdBy: auth.userId,
      },
    });

    return created(block);
  } catch {
    return error("Server xatosi", 500);
  }
}

// ─── Helper ────────────────────────────────────────────────────────────────

async function canManageDoctor(
  auth: { role: string; clinicId: string | null; userId: string },
  doctor: { clinicId: string; userId: string | null }
): Promise<boolean> {
  if (auth.role === "super_admin") return true;
  if (["clinic_admin", "branch_admin"].includes(auth.role)) {
    return auth.clinicId === doctor.clinicId;
  }
  if (auth.role === "doctor") {
    // Faqat o'z profili
    return doctor.userId === auth.userId;
  }
  return false;
}
