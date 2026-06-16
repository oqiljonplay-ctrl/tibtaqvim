import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, error, unauthorized, forbidden } from "@/lib/api-response";
import { normalizeEmId } from "@/lib/services/em-id.service";
import { attachEmployeeToClinic, ApiError } from "@/lib/services/employment.service";
import { createAuditLog } from "@/lib/services/config.service";

function tgSend(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return Promise.resolve();
  return fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  }).catch(() => {});
}

// POST /api/admin/doctors/attach — EM ID bo'yicha shifokorga TAKLIF yuborish (darhol ulamaydi)
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth) return unauthorized();
  if (!["super_admin", "clinic_admin", "branch_admin"].includes(auth.role)) return forbidden();

  const body = await req.json();
  const { emId: rawEmId, serviceIds, branchId: bodyBranchId } = body;

  if (!rawEmId?.trim()) return error("emId majburiy");

  const clinicId = auth.role === "super_admin" ? body.clinicId : auth.clinicId;
  if (!clinicId) return error("clinicId required");

  let resolvedBranchId: string | null = null;
  if (auth.role === "branch_admin") {
    resolvedBranchId = auth.branchId ?? null;
  } else {
    resolvedBranchId = bodyBranchId ?? null;
  }

  try {
    const emId = normalizeEmId(rawEmId.trim());

    // Limit tekshiruvi (tezkor feedback uchun — haqiqiy ulanishda yana tekshiriladi)
    const clinicCheck = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { maxEmployees: true, name: true },
    });
    if (!clinicCheck) return error("Klinika topilmadi", 404);
    if (clinicCheck.maxEmployees === 0) {
      return error("Bu klinikada yangi xodim qo'shish o'chiq (limit 0). Superadmin limitni belgilashi kerak.", 403);
    }
    const activeCount = await prisma.employmentStint.count({ where: { clinicId, endDate: null } });
    if (activeCount >= clinicCheck.maxEmployees) {
      return error(`Klinika xodim limiti to'ldi (${activeCount}/${clinicCheck.maxEmployees}). Yangi xodim qabul qilinmaydi.`, 403);
    }

    // Xodimni topish
    const employee = await prisma.employee.findUnique({
      where: { emId },
      select: { id: true, firstName: true, lastName: true, isActive: true, userId: true, emId: true },
    });
    if (!employee) return error(`EM ID topilmadi: ${emId}`, 404);
    if (!employee.isActive) return error("Bu EM ID faol emas", 400);

    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { name: true },
    });

    // Bu xodimga bu klinikadan allaqachon pending taklif bormi?
    const existingInvitation = await prisma.jobRequest.findFirst({
      where: { employeeId: employee.id, clinicId, initiatedBy: "clinic", status: "pending" },
    });
    if (existingInvitation) {
      return error("Bu xodimga allaqachon taklif yuborilgan (kutilmoqda)", 409);
    }

    // Mutual match tekshiruvi: xodim ham bu klinikaga so'rov yuborganmi?
    const employeeRequest = await prisma.jobRequest.findFirst({
      where: { employeeId: employee.id, clinicId, initiatedBy: "employee", status: "pending" },
    });

    if (employeeRequest) {
      // Mutual match — ikkala tomon xohlaydi → darhol ulash
      const result = await prisma.$transaction(async (tx) => {
        const attached = await attachEmployeeToClinic(tx as Parameters<typeof attachEmployeeToClinic>[0], {
          emId,
          clinicId,
          role: "doctor",
          branchId: resolvedBranchId,
          serviceIds: Array.isArray(serviceIds) ? serviceIds : [],
        });
        // Ikkalasini ham approved qilish
        await tx.jobRequest.update({
          where: { id: employeeRequest.id },
          data: { status: "approved", decidedBy: auth.userId, decidedAt: new Date() },
        });
        return attached;
      });

      // Xodimga Telegram xabar (mutual)
      try {
        if (employee.userId) {
          const user = await prisma.user.findUnique({ where: { id: employee.userId }, select: { telegramId: true } });
          if (user?.telegramId) {
            tgSend(user.telegramId, `✅ ${clinic?.name ?? "Klinika"}ga ulandingiz (ikkala tomon roziligi bilan).\n👤 ${employee.firstName} ${employee.lastName ?? ""} (${employee.emId})`);
          }
        }
      } catch {}

      await createAuditLog(auth.userId, "clinic.invitation_mutual", { clinicId, employeeId: employee.id, emId }, clinicId);

      return ok({ mutual: true, attached: true, doctorId: result.doctorId });
    }

    // Mutual emas — taklif yaratish
    const invitation = await prisma.jobRequest.create({
      data: {
        employeeId: employee.id,
        clinicId,
        role: "doctor",
        status: "pending",
        initiatedBy: "clinic",
      },
    });

    // Xodimga Telegram taklif xabari (fire-and-forget)
    try {
      if (employee.userId) {
        const user = await prisma.user.findUnique({ where: { id: employee.userId }, select: { telegramId: true } });
        if (user?.telegramId) {
          tgSend(user.telegramId, `🏥 ${clinic?.name ?? "Klinika"} sizni ishga taklif qilmoqda.\n👤 ${employee.firstName} ${employee.lastName ?? ""} (${employee.emId})\nIlovaga kirib tasdiqlang yoki rad eting.`);
        }
      }
    } catch {}

    await createAuditLog(auth.userId, "clinic.invitation_sent", { clinicId, employeeId: employee.id, emId, invitationId: invitation.id }, clinicId);

    return ok({ invited: true, invitationId: invitation.id });
  } catch (err) {
    if (err instanceof ApiError) return error(err.message, err.statusCode);
    return error("Server xatosi", 500);
  }
}
