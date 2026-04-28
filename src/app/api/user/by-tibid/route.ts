import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, error, unauthorized } from "@/lib/api-response";
import { requireAuth } from "@/lib/auth";

// GET /api/user/by-tibid?tibId=tib000001
// Reception panel uchun tezkor qidiruv (tibId unique index ishlatadi)
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth) return unauthorized();

  const tibId = new URL(req.url).searchParams.get("tibId");
  if (!tibId) return error("tibId majburiy");

  // findUnique → tibId unique index orqali tezkor qidiruv
  const user = await prisma.user.findUnique({
    where: { tibId },
    select: {
      id: true,
      tibId: true,
      firstName: true,
      lastName: true,
      phone: true,
      telegramId: true,
      role: true,
      appointments: {
        where: { clinicId: auth.role === "super_admin" ? undefined : auth.clinicId ?? "" },
        orderBy: { date: "desc" },
        take: 10,
        select: {
          id: true,
          date: true,
          status: true,
          queueNumber: true,
          service: { select: { name: true, type: true } },
          doctor: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  if (!user) return error("Foydalanuvchi topilmadi", 404);

  return ok(user);
}
