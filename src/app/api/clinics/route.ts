import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, error } from "@/lib/api-response";

export const dynamic = "force-dynamic";

/**
 * GET /api/clinics
 * Public — bemor uchun klinikalar ro'yxati
 * ?city=Toshkent  ?search=tibtaqvim  ?limit=50  ?offset=0
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const city   = searchParams.get("city")?.trim()   || undefined;
    const search = searchParams.get("search")?.trim() || undefined;
    const limit  = Math.min(parseInt(searchParams.get("limit")  || "50", 10), 100);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0",  10), 0);

    const where: any = {
      isActive:           true,
      deletedAt:          null,
      subscriptionStatus: { in: ["trial", "active"] },
    };

    if (city)   where.city = city;
    if (search) {
      where.OR = [
        { name:        { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const [clinics, total] = await Promise.all([
      prisma.clinic.findMany({
        where,
        select: {
          id:          true,
          name:        true,
          description: true,
          phone:       true,
          address:     true,
          logoUrl:     true,
          city:        true,
          workingHours: true,
          rating:      true,
          ratingCount: true,
          _count: {
            select: {
              branches: { where: { isActive: true } },
              doctors:  { where: { isActive: true } },
              services: { where: { isActive: true } },
            },
          },
        },
        orderBy: [{ rating: "desc" }, { name: "asc" }],
        take:  limit,
        skip:  offset,
      }),
      prisma.clinic.count({ where }),
    ]);

    const items = clinics.map((c) => ({
      id:           c.id,
      name:         c.name,
      description:  c.description,
      phone:        c.phone,
      address:      c.address,
      logoUrl:      c.logoUrl,
      city:         c.city,
      workingHours: c.workingHours,
      rating:       Number(c.rating ?? 0),
      ratingCount:  c.ratingCount,
      branchCount:  c._count.branches,
      doctorCount:  c._count.doctors,
      serviceCount: c._count.services,
    }));

    return ok({ items, total, limit, offset });
  } catch (err) {
    console.error("[GET /api/clinics]", err);
    return error("Failed to fetch clinics", 500);
  }
}
