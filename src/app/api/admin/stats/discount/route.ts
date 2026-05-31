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

  try {
    const cf = clinicId ? Prisma.sql`AND "clinicId" = ${clinicId}` : Prisma.empty;

    // X = jami haqiqiy tushum (barcha paid bronlar paidAmount yig'indisi)
    const xRows = await prisma.$queryRaw<[{ total: string }]>(
      Prisma.sql`
        SELECT COALESCE(SUM("paidAmount"), 0)::text AS total
        FROM appointments
        WHERE "paymentStatus" = 'paid'
        ${cf}
      `
    );

    // Z = chegirmali to'lovlardan tushgan summa
    const zRows = await prisma.$queryRaw<[{ total: string }]>(
      Prisma.sql`
        SELECT COALESCE(SUM("paidAmount"), 0)::text AS total
        FROM appointments
        WHERE "paymentStatus" = 'paid'
          AND "appliedDiscountPercent" > 0
        ${cf}
      `
    );

    // Y = chegirilgan pul (xizmat narxi − to'langan summa, faqat chegirmali bronlar)
    const yRows = await prisma.$queryRaw<[{ total: string }]>(
      Prisma.sql`
        SELECT COALESCE(
          SUM(CAST(s.price AS NUMERIC) - a."paidAmount"), 0
        )::text AS total
        FROM appointments a
        INNER JOIN services s ON s.id = a."serviceId"
        WHERE a."paymentStatus" = 'paid'
          AND a."appliedDiscountPercent" > 0
        ${cf}
      `
    );

    const x = Number(xRows[0]?.total ?? 0);
    const z = Number(zRows[0]?.total ?? 0);
    const y = Number(yRows[0]?.total ?? 0);

    return ok({ x, y, z });
  } catch (err) {
    console.error("[stats/discount]", err);
    return error("Server xatosi", 500);
  }
}
