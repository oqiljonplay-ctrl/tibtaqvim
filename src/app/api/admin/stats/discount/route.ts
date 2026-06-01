import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, error, unauthorized, forbidden } from "@/lib/api-response";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth) return unauthorized();
  if (!["clinic_admin", "super_admin", "branch_admin"].includes(auth.role)) return forbidden();

  const clinicId = auth.role === "super_admin" ? null : auth.clinicId;
  const whereBase = clinicId ? { clinicId } : {};

  try {
    // X = jami haqiqiy tushum (barcha paid bronlar)
    const xAgg = await prisma.appointment.aggregate({
      where: { paymentStatus: "paid", ...whereBase },
      _sum: { paidAmount: true },
    });

    // Z = chegirmali to'lovlardan tushgan summa
    const zAgg = await prisma.appointment.aggregate({
      where: { paymentStatus: "paid", appliedDiscountPercent: { gt: 0 }, ...whereBase },
      _sum: { paidAmount: true },
    });

    // Y = chegirilgan pul (narx − paidAmount, faqat chegirmali bronlar)
    // service.price kerak → raw SQL, lekin clinicId uchun 2 variant
    let yRows: [{ total: string }];
    if (clinicId) {
      yRows = await prisma.$queryRaw<[{ total: string }]>(
        Prisma.sql`
          SELECT COALESCE(SUM(CAST(s.price AS NUMERIC) - a."paidAmount"), 0)::text AS total
          FROM appointments a
          INNER JOIN services s ON s.id = a."serviceId"
          WHERE a."paymentStatus" = 'paid'
            AND a."appliedDiscountPercent" > 0
            AND a."clinicId" = ${clinicId}
        `
      );
    } else {
      yRows = await prisma.$queryRaw<[{ total: string }]>(
        Prisma.sql`
          SELECT COALESCE(SUM(CAST(s.price AS NUMERIC) - a."paidAmount"), 0)::text AS total
          FROM appointments a
          INNER JOIN services s ON s.id = a."serviceId"
          WHERE a."paymentStatus" = 'paid'
            AND a."appliedDiscountPercent" > 0
        `
      );
    }

    const x = xAgg._sum.paidAmount ?? 0;
    const z = zAgg._sum.paidAmount ?? 0;
    const y = Number(yRows[0]?.total ?? 0);

    return ok({ x, y, z });
  } catch (err) {
    console.error("[stats/discount]", err);
    return error("Server xatosi", 500);
  }
}
