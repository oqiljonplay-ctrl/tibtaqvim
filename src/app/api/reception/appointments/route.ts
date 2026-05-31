import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, error } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { getBranchScope } from "@/lib/branch-scope";

export const dynamic = "force-dynamic";

/**
 * GET /api/reception/appointments?date=YYYY-MM-DD
 *
 * Qabulxona uchun bronlar — 2 bo'lim:
 *   pending: to'lov kutilmoqda
 *   paid:    to'langan (shifokorga uzatildi)
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth) return error("Unauthorized", 401);

  const allowedRoles = ["receptionist", "clinic_admin", "branch_admin", "super_admin"];
  if (!allowedRoles.includes(auth.role)) return error("Ruxsat yo'q", 403);

  try {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");
    const date = dateParam ? new Date(dateParam + "T00:00:00.000Z") : new Date(new Date().toLocaleDateString("sv-SE") + "T00:00:00.000Z");

    const scope = getBranchScope(auth);
    const where: any = {
      date,
      status: { not: "cancelled" },
    };
    if (scope.clinicId) where.clinicId = scope.clinicId;
    if (scope.branchId !== undefined) where.branchId = scope.branchId;

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        service: { select: { id: true, name: true, type: true, price: true } },
        doctor: { select: { id: true, firstName: true, lastName: true, specialty: true } },
        user: { select: { id: true, telegramId: true, tibId: true, firstName: true, lastName: true, fatherName: true } },
      },
      orderBy: [{ queueNumber: "asc" }, { createdAt: "asc" }],
    });

    const pending = appointments.filter((a) => a.paymentStatus === "pending");
    const paid = appointments.filter(
      (a) => a.paymentStatus === "paid" || a.paymentStatus === "not_required"
    );

    return ok({
      date: dateParam ?? new Date().toLocaleDateString("sv-SE"),
      pending: pending.map(serialize),
      paid: paid.map(serialize),
      counts: { pending: pending.length, paid: paid.length, total: appointments.length },
    });
  } catch (err: any) {
    console.error("[GET /api/reception/appointments]", err);
    return error("Server xatosi", 500);
  }
}

function buildPatientName(a: any): string {
  if (a.user?.firstName) {
    return [a.user.firstName, a.user.lastName, a.user.fatherName].filter(Boolean).join(" ");
  }
  return a.patientName ?? "";
}

function serialize(a: any) {
  return {
    id: a.id,
    patientName: buildPatientName(a),
    patientPhone: a.patientPhone,
    queueNumber: a.queueNumber,
    status: a.status,
    paymentStatus: a.paymentStatus,
    queueMode: a.queueMode,
    date: a.date,
    address: a.address,
    notes: a.notes,
    service: a.service
      ? { id: a.service.id, name: a.service.name, type: a.service.type, price: a.service.price ? Number(a.service.price) : 0 }
      : null,
    doctor: a.doctor
      ? { id: a.doctor.id, name: [a.doctor.lastName, a.doctor.firstName].filter(Boolean).join(" "), specialty: a.doctor.specialty }
      : null,
    paidAmount: a.paidAmount ?? null,
    appliedDiscountPercent: a.appliedDiscountPercent ?? 0,
    patientTelegramId: a.user?.telegramId ?? null,
    tibId: a.user?.tibId ?? null,
    locationLat: a.locationLat ?? null,
    locationLng: a.locationLng ?? null,
    liveLat: a.liveLat ?? null,
    liveLng: a.liveLng ?? null,
    liveStartedAt: a.liveStartedAt ? a.liveStartedAt.toISOString() : null,
    liveExpiresAt: a.liveExpiresAt ? a.liveExpiresAt.toISOString() : null,
    liveLastUpdatedAt: a.liveLastUpdatedAt ? a.liveLastUpdatedAt.toISOString() : null,
    liveStatus: a.liveStatus ?? null,
  };
}
