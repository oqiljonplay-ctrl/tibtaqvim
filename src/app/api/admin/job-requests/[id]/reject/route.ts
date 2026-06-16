import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound } from "@/lib/api-response";

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

// POST /api/admin/job-requests/[id]/reject
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (!["super_admin", "clinic_admin", "branch_admin"].includes(auth.role)) return forbidden();

    const jobRequest = await prisma.jobRequest.findUnique({
      where: { id: params.id },
      include: {
        employee: { select: { userId: true, firstName: true, lastName: true, emId: true } },
        clinic: { select: { name: true } },
      },
    });
    if (!jobRequest) return notFound("So'rov topilmadi");
    if (jobRequest.status !== "pending") return error("So'rov allaqachon ko'rib chiqilgan", 400);
    if (auth.role !== "super_admin" && jobRequest.clinicId !== auth.clinicId) return forbidden();

    await prisma.jobRequest.update({
      where: { id: params.id },
      data: { status: "rejected", decidedBy: auth.userId, decidedAt: new Date() },
    });

    // Xodimga Telegram xabar (fire-and-forget) — faqat xodim boshlagan so'rovlarda
    if (jobRequest.initiatedBy === "employee" && jobRequest.employee.userId) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: jobRequest.employee.userId },
          select: { telegramId: true },
        });
        if (user?.telegramId) {
          const msg = `❌ ${jobRequest.clinic.name} klinikasi so'rovingizni rad etdi.\n👤 ${jobRequest.employee.firstName} ${jobRequest.employee.lastName ?? ""} (${jobRequest.employee.emId})`;
          tgSend(user.telegramId, msg);
        }
      } catch {}
    }

    return ok({ rejected: true });
  } catch {
    return error("Server xatosi", 500);
  }
}
