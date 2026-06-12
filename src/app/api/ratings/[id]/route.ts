import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, error } from "@/lib/api-response";
import { resolveWebappTelegramId } from "@/lib/telegram/webapp-auth";
import { recomputeEmployeeRating } from "@/lib/services/rating.service";

type Params = { params: { id: string } };

// PATCH /api/ratings/[id]
// Body: { telegramId, stars }
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    // 1. ratingEditWindow tekshiruvi
    const windowRow = await prisma.globalSetting.findUnique({ where: { key: "ratingEditWindow" } });
    const windowVal = windowRow?.value as { enabled?: boolean; hours?: number } | null;
    if (!windowVal || windowVal.enabled !== true) {
      return error("Bahoni o'zgartirish imkoni yopiq", 403);
    }
    const windowHours = windowVal.hours ?? 24;

    const body = await req.json();
    const { telegramId: rawTelegramId, stars } = body;

    // stars validatsiya
    if (
      typeof stars !== "number" ||
      stars < 0.5 ||
      stars > 5 ||
      !Number.isInteger(stars * 2)
    ) {
      return error("Baho 0.5–5.0 oralig'ida, 0.5 qadam bilan bo'lishi kerak", 400);
    }

    const auth = resolveWebappTelegramId(req, rawTelegramId ? String(rawTelegramId) : null);
    if (!auth) return error("Autentifikatsiya talab qilinadi", 401);
    const { telegramId } = auth;

    const user = await prisma.user.findUnique({
      where: { telegramId: String(telegramId) },
      select: { id: true, telegramId: true },
    });
    if (!user) return error("Foydalanuvchi topilmadi", 404);

    const rating = await prisma.doctorRating.findUnique({ where: { id: params.id } });
    if (!rating) return error("Baho topilmadi", 404);

    // 2. egachilik tekshiruvi
    if (rating.telegramId !== String(user.telegramId)) return error("Ruxsat yo'q", 403);

    // 3. tahrirlash muddati tekshiruvi
    const ageMs = Date.now() - new Date(rating.createdAt).getTime();
    if (ageMs > windowHours * 3_600_000) return error("Tahrirlash muddati o'tgan", 403);

    await prisma.doctorRating.update({
      where: { id: params.id },
      data: { stars, updatedAt: new Date() },
    });

    await recomputeEmployeeRating(rating.employeeId, { factorsFresh: false });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        clinicId: rating.clinicId,
        action: "rating.updated",
        payload: { ratingId: params.id, newStars: stars, employeeId: rating.employeeId },
      },
    }).catch(() => {});

    const updatedEmp = await prisma.employee.findUnique({
      where: { id: rating.employeeId },
      select: { compositeRating: true, ratingCount: true },
    });

    return ok({
      ok: true,
      compositeRating: updatedEmp?.compositeRating != null ? Number(updatedEmp.compositeRating) : null,
      ratingCount: updatedEmp?.ratingCount ?? 0,
    });
  } catch {
    return error("Server xatosi", 500);
  }
}
