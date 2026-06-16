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

// POST /api/doctor/clinic-invitations/[id]/decline — taklifni rad etish
export async function POST(req: NextRequest, { params }: Params) {
  const auth = requireAuth(req);
  if (!auth) return unauthorized();
  if (auth.role !== "doctor") return forbidden();

  const employee = await prisma.employee.findUnique({
    where: { userId: auth.userId },
    select: { id: true, firstName: true, lastName: true, emId: true },
  });
  if (!employee) return error("Xodim topilmadi", 404);

  const invitation = await prisma.jobRequest.findUnique({
    where: { id: params.id },
    include: { clinic: { select: { id: true, name: true } } },
  });
  if (!invitation) return notFound("Taklif topilmadi");
  if (invitation.employeeId !== employee.id) return forbidden();
  if (invitation.initiatedBy !== "clinic") return error("Bu taklif emas", 400);
  if (invitation.status !== "pending") return error("Taklif allaqachon ko'rib chiqilgan", 400);

  await prisma.jobRequest.update({
    where: { id: params.id },
    data: { status: "rejected", decidedBy: auth.userId, decidedAt: new Date() },
  });

  // Klinika adminlariga Telegram xabar (fire-and-forget)
  try {
    const admins = await prisma.user.findMany({
      where: { clinicId: invitation.clinicId, role: { in: ["clinic_admin", "branch_admin"] } },
      select: { telegramId: true },
    });
    const msg = `❌ ${employee.firstName} ${employee.lastName ?? ""} (${employee.emId}) ${invitation.clinic.name} klinikasi taklifini rad etdi.`;
    admins.forEach((a) => { if (a.telegramId) tgSend(a.telegramId, msg); });
  } catch {}

  return ok({ declined: true });
}
