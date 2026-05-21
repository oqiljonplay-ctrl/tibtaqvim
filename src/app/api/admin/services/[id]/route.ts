import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound } from "@/lib/api-response";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (!["super_admin", "clinic_admin"].includes(auth.role)) return forbidden();

    const data = await req.json();

    const service = await prisma.service.findUnique({ where: { id: params.id } });
    if (!service) return notFound();
    if (auth.role !== "super_admin" && service.clinicId !== auth.clinicId) return forbidden();

    const { doctorIds, ...rest } = data;

    const updated = await prisma.service.update({
      where: { id: params.id },
      data: {
        ...(rest.name !== undefined && { name: rest.name }),
        ...(rest.price !== undefined && { price: rest.price }),
        ...(rest.dailyLimit !== undefined && { dailyLimit: rest.dailyLimit }),
        // TODO: Bosqich 2 - slot tizimi yoqilganda rest.requiresSlot qaytariladi
        ...(rest.requiresAddress !== undefined && { requiresAddress: rest.requiresAddress }),
        ...(rest.requiresPrePayment !== undefined && { requiresPrePayment: rest.requiresPrePayment }),
        ...(rest.prePaymentAmount !== undefined && { prePaymentAmount: rest.prePaymentAmount }),
        ...(rest.description !== undefined && { description: rest.description }),
        ...(rest.sortOrder !== undefined && { sortOrder: rest.sortOrder }),
        ...(rest.isActive !== undefined && { isActive: rest.isActive }),
        ...(Array.isArray(doctorIds)
          ? {
              doctors: {
                deleteMany: {},
                create: doctorIds.map((doctorId: string) => ({ doctorId })),
              },
            }
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

    return ok({
      ...updated,
      price: Number(updated.price),
      prePaymentAmount: updated.prePaymentAmount ? Number(updated.prePaymentAmount) : null,
      doctors: updated.doctors.map((sd) => sd.doctor),
    });
  } catch {
    return error("Server error", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (!["super_admin", "clinic_admin"].includes(auth.role)) return forbidden();

    const service = await prisma.service.findUnique({ where: { id: params.id } });
    if (!service) return notFound();
    if (auth.role !== "super_admin" && service.clinicId !== auth.clinicId) return forbidden();

    const [appointmentCount, slotCount] = await Promise.all([
      prisma.appointment.count({ where: { serviceId: params.id } }),
      prisma.slot.count({ where: { serviceId: params.id } }),
    ]);

    const hasReferences = appointmentCount > 0 || slotCount > 0;

    if (hasReferences) {
      await prisma.$transaction([
        prisma.serviceDoctor.deleteMany({ where: { serviceId: params.id } }),
        prisma.service.update({ where: { id: params.id }, data: { isActive: false } }),
      ]);
      return ok({
        deleted: false,
        deactivated: true,
        message: `Xizmat deaktivatsiya qilindi (${appointmentCount} bron, ${slotCount} slot bog'langani uchun butunlay o'chirilmadi)`,
        appointmentCount,
        slotCount,
      });
    }

    await prisma.$transaction([
      prisma.serviceDoctor.deleteMany({ where: { serviceId: params.id } }),
      prisma.service.delete({ where: { id: params.id } }),
    ]);
    return ok({
      deleted: true,
      deactivated: false,
      message: "Xizmat butunlay o'chirildi",
    });
  } catch {
    return error("Server error", 500);
  }
}
