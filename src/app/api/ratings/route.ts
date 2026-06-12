import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, error } from "@/lib/api-response";
import { resolveWebappTelegramId } from "@/lib/telegram/webapp-auth";
import { recomputeEmployeeRating } from "@/lib/services/rating.service";
import { rateLimit } from "@/lib/rate-limit";

// POST /api/ratings
// Body: { telegramId, appointmentId, stars, comment? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { telegramId: rawTelegramId, appointmentId, stars, comment } = body;

    // 1. stars validatsiya (DB dan oldin)
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

    // Rate limit: telegramId bo'yicha 10/min
    const allowed = await rateLimit(`rating:${telegramId}`, 10, 60_000);
    if (!allowed) return error("Juda ko'p so'rov. Biroz kuting.", 429);

    // 2. user topish
    const user = await prisma.user.findUnique({
      where: { telegramId: String(telegramId) },
      select: { id: true, telegramId: true },
    });
    if (!user) return error("Foydalanuvchi topilmadi", 404);

    // 3. appointment topish
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { doctor: { select: { employeeId: true, clinicId: true } } },
    });
    if (!appointment) return error("Bron topilmadi", 404);

    // 4. bron egasi tekshiruvi
    if (appointment.userId !== user.id) return error("Bu bron sizga tegishli emas", 403);

    // 5. arrived status tekshiruvi
    if (appointment.status !== "arrived")
      return error("Baholash faqat qabul yakunlangach mumkin", 400);

    // 6. doctor+employee tekshiruvi
    if (!appointment.doctorId || !appointment.doctor?.employeeId)
      return error("Bu bronni baholab bo'lmaydi", 400);

    const employeeId = appointment.doctor.employeeId;

    // 7. baho yaratish
    let rating;
    try {
      rating = await prisma.doctorRating.create({
        data: {
          employeeId,
          doctorId: appointment.doctorId,
          clinicId: appointment.clinicId,
          appointmentId: appointment.id,
          userId: user.id,
          telegramId: String(user.telegramId),
          dependentId: appointment.dependentId ?? null,
          stars,
          comment: comment?.trim() || null,
        },
      });
    } catch (err: unknown) {
      const e = err as { code?: string };
      if (e.code === "P2002") return error("Bu qabul allaqachon baholangan", 409);
      throw err;
    }

    // 8. composite recompute
    await recomputeEmployeeRating(employeeId, { factorsFresh: false });

    // 9. audit log
    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        clinicId: appointment.clinicId,
        action: "rating.created",
        payload: { ratingId: rating.id, stars, appointmentId, employeeId },
      },
    }).catch(() => {});

    const updatedEmp = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { compositeRating: true, ratingCount: true },
    });

    return ok({
      ok: true,
      stars,
      ratingId: rating.id,
      compositeRating: updatedEmp?.compositeRating != null ? Number(updatedEmp.compositeRating) : null,
      ratingCount: updatedEmp?.ratingCount ?? 0,
    });
  } catch {
    return error("Server xatosi", 500);
  }
}
