import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, created, error, unauthorized, forbidden } from "@/lib/api-response";
function tgSend(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return Promise.resolve();
  return fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  }).catch(() => {});
}

// POST /api/doctor/job-requests — so'rov yuborish
export async function POST(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (auth.role !== "doctor") return forbidden();

    const body = await req.json();
    const { clinicId, message, role = "doctor" } = body;
    if (!clinicId) return error("clinicId majburiy");

    const employee = await prisma.employee.findUnique({
      where: { userId: auth.userId },
      select: { id: true, emId: true, firstName: true, lastName: true, maxJobRequests: true, maxClinics: true },
    });
    if (!employee) return error("Xodim topilmadi", 404);

    // Limit tekshiruvi
    const [pendingCount, activeCount] = await Promise.all([
      prisma.jobRequest.count({ where: { employeeId: employee.id, status: "pending" } }),
      prisma.employmentStint.count({ where: { employeeId: employee.id, endDate: null } }),
    ]);

    if (pendingCount >= employee.maxJobRequests) {
      return error(`Siz bir vaqtda ${employee.maxJobRequests} tadan ko'p so'rov yubora olmaysiz`, 400);
    }
    if (activeCount >= employee.maxClinics) {
      return error(`Siz ${employee.maxClinics} ta klinikadan oshiq ishlayolmaysiz`, 400);
    }

    // Allaqachon bu klinikada faol stintmi?
    const activeStint = await prisma.employmentStint.findFirst({
      where: { employeeId: employee.id, clinicId, endDate: null },
    });
    if (activeStint) return error("Siz bu klinikada allaqachon ishlaysiz", 409);

    // Unique constraint: pending so'rov mavjudmi?
    const existing = await prisma.jobRequest.findFirst({
      where: { employeeId: employee.id, clinicId, status: "pending" },
    });
    if (existing) return error("Bu klinikaga allaqachon so'rov yuborilgan", 409);

    const jobRequest = await prisma.jobRequest.create({
      data: {
        employeeId: employee.id,
        clinicId,
        role,
        status: "pending",
        message: message?.trim() || null,
      },
    });

    // Admin'ga Telegram xabar (fire-and-forget)
    try {
      const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { name: true } });
      const admins = await prisma.user.findMany({
        where: { clinicId, role: "clinic_admin", telegramId: { not: null }, isActive: true },
        select: { telegramId: true },
      });
      const msg = `📨 Yangi ishga kirish so'rovi:\n👤 ${employee.firstName} ${employee.lastName ?? ""} (${employee.emId})\n🏥 ${clinic?.name ?? clinicId}\nRol: ${role}${message ? `\n💬 ${message}` : ""}`;
      for (const admin of admins) {
        if (admin.telegramId) {
          tgSend(admin.telegramId, msg);
        }
      }
    } catch {}

    return created(jobRequest);
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === "P2002") return error("Bu klinikaga allaqachon so'rov yuborilgan", 409);
    return error("Server xatosi", 500);
  }
}

// GET /api/doctor/job-requests — o'zining so'rovlari
export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (auth.role !== "doctor") return forbidden();

    const employee = await prisma.employee.findUnique({
      where: { userId: auth.userId },
      select: { id: true },
    });
    if (!employee) return error("Xodim topilmadi", 404);

    const requests = await prisma.jobRequest.findMany({
      where: { employeeId: employee.id },
      include: { clinic: { select: { id: true, name: true, logoUrl: true, address: true } } },
      orderBy: { createdAt: "desc" },
    });

    return ok(requests);
  } catch {
    return error("Server xatosi", 500);
  }
}
