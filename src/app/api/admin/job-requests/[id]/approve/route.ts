import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound } from "@/lib/api-response";
import { attachEmployeeToClinic, ApiError } from "@/lib/services/employment.service";
function tgSend(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return Promise.resolve();
  return fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  }).catch(() => {});
}

type Params = { params: { id: string } };

// POST /api/admin/job-requests/[id]/approve
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (!["super_admin", "clinic_admin", "branch_admin"].includes(auth.role)) return forbidden();

    const body = await req.json().catch(() => ({}));
    const { serviceIds, branchId } = body;

    const jobRequest = await prisma.jobRequest.findUnique({
      where: { id: params.id },
      include: {
        employee: { select: { emId: true, firstName: true, lastName: true, userId: true } },
        clinic: { select: { name: true } },
      },
    });
    if (!jobRequest) return notFound("So'rov topilmadi");
    if (jobRequest.status !== "pending") return error("So'rov allaqachon ko'rib chiqilgan", 400);

    if (auth.role !== "super_admin" && jobRequest.clinicId !== auth.clinicId) return forbidden();

    const result = await prisma.$transaction((tx) =>
      attachEmployeeToClinic(tx as Parameters<typeof attachEmployeeToClinic>[0], {
        emId: jobRequest.employee.emId,
        clinicId: jobRequest.clinicId,
        role: jobRequest.role as "doctor" | "receptionist",
        branchId: branchId ?? null,
        serviceIds: Array.isArray(serviceIds) ? serviceIds : [],
      })
    );

    await prisma.jobRequest.update({
      where: { id: params.id },
      data: { status: "approved", decidedBy: auth.userId, decidedAt: new Date() },
    });

    // Xodimga Telegram xabar (fire-and-forget)
    try {
      if (jobRequest.employee.userId) {
        const user = await prisma.user.findUnique({
          where: { id: jobRequest.employee.userId },
          select: { telegramId: true },
        });
        if (user?.telegramId) {
          const msg = `🎉 Tabriklaymiz! ${jobRequest.clinic.name} klinikasi sizni ishga qabul qildi!\n👤 ${jobRequest.employee.firstName} ${jobRequest.employee.lastName ?? ""} (${jobRequest.employee.emId})`;
          tgSend(user.telegramId, msg);
        }
      }
    } catch {}

    return ok({ approved: true, ...result });
  } catch (err) {
    if (err instanceof ApiError) return error(err.message, err.statusCode);
    return error("Server xatosi", 500);
  }
}
