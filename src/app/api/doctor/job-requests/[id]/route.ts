import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound } from "@/lib/api-response";

type Params = { params: { id: string } };

// DELETE /api/doctor/job-requests/[id] — so'rovni bekor qilish
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (auth.role !== "doctor") return forbidden();

    const employee = await prisma.employee.findUnique({
      where: { userId: auth.userId },
      select: { id: true },
    });
    if (!employee) return error("Xodim topilmadi", 404);

    const jobRequest = await prisma.jobRequest.findUnique({ where: { id: params.id } });
    if (!jobRequest) return notFound("So'rov topilmadi");
    if (jobRequest.employeeId !== employee.id) return forbidden();
    if (jobRequest.status !== "pending") return error("Faqat kutilayotgan so'rovni bekor qilish mumkin", 400);

    await prisma.jobRequest.update({
      where: { id: params.id },
      data: { status: "cancelled" },
    });

    return ok({ cancelled: true });
  } catch {
    return error("Server xatosi", 500);
  }
}
