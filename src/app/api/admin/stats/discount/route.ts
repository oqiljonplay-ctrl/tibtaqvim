import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, error, unauthorized, forbidden } from "@/lib/api-response";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

function getRangeDate(rangeDays: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - rangeDays);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth) return unauthorized();
  if (!["clinic_admin", "super_admin", "branch_admin"].includes(auth.role)) return forbidden();

  const clinicId = auth.role === "super_admin" ? null : auth.clinicId;
  const whereBase = clinicId ? { clinicId } : {};

  const rangeParam = req.nextUrl.searchParams.get("range");
  const rangeDays = rangeParam ? parseInt(rangeParam, 10) : 30;
  const fromDate = getRangeDate(isNaN(rangeDays) ? 30 : rangeDays);
  const toDate = new Date();

  const paidAtFilter = { gte: fromDate, lte: toDate };

  try {
    // X = jami haqiqiy tushum (paid + paidAt filtr)
    const xAgg = await prisma.appointment.aggregate({
      where: { paymentStatus: "paid", paidAt: paidAtFilter, ...whereBase },
      _sum: { paidAmount: true },
    });

    // Z = chegirmali to'lovlardan tushgan summa
    const zAgg = await prisma.appointment.aggregate({
      where: { paymentStatus: "paid", appliedDiscountPercent: { gt: 0 }, paidAt: paidAtFilter, ...whereBase },
      _sum: { paidAmount: true },
    });

    // Y = chegirilgan pul (narx − paidAmount, faqat chegirmali bronlar)
    // GREATEST(price - paidAmount, 0) — manfiy himoya
    let yRows: [{ total: string }];
    if (clinicId) {
      yRows = await prisma.$queryRaw<[{ total: string }]>(
        Prisma.sql`
          SELECT COALESCE(SUM(GREATEST(CAST(s.price AS NUMERIC) - a."paidAmount", 0)), 0)::text AS total
          FROM appointments a
          INNER JOIN services s ON s.id = a."serviceId"
          WHERE a."paymentStatus" = 'paid'
            AND a."appliedDiscountPercent" > 0
            AND a."paidAt" IS NOT NULL
            AND a."paidAt" >= ${fromDate}
            AND a."paidAt" <= ${toDate}
            AND a."clinicId" = ${clinicId}
        `
      );
    } else {
      yRows = await prisma.$queryRaw<[{ total: string }]>(
        Prisma.sql`
          SELECT COALESCE(SUM(GREATEST(CAST(s.price AS NUMERIC) - a."paidAmount", 0)), 0)::text AS total
          FROM appointments a
          INNER JOIN services s ON s.id = a."serviceId"
          WHERE a."paymentStatus" = 'paid'
            AND a."appliedDiscountPercent" > 0
            AND a."paidAt" IS NOT NULL
            AND a."paidAt" >= ${fromDate}
            AND a."paidAt" <= ${toDate}
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
