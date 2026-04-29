import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, unauthorized, forbidden, notFound } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { getClinicConfig, createAuditLog } from "@/lib/services/config.service";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = requireAuth(req);
  if (!user) return unauthorized();
  if (user.role !== "super_admin") return forbidden();

  const clinic = await prisma.clinic.findFirst({ where: { id: params.id, deletedAt: null } });
  if (!clinic) return notFound("Klinika topilmadi");

  const settings = await getClinicConfig(params.id);
  return ok(settings);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = requireAuth(req);
  if (!user) return unauthorized();
  if (user.role !== "super_admin") return forbidden();

  const clinic = await prisma.clinic.findFirst({ where: { id: params.id, deletedAt: null } });
  if (!clinic) return notFound("Klinika topilmadi");

  const body = await req.json();
  const {
    dailyLimit,
    timezone,
    bookingWindowDays,
    allowSameDay,
    enableQueue,
    enableSlots,
    enableHomeService,
    enableWebapp,
    enableBot,
  } = body;

  const settings = await prisma.clinicSettings.upsert({
    where: { clinicId: params.id },
    create: {
      clinicId: params.id,
      dailyLimit: dailyLimit ?? 40,
      timezone: timezone ?? "Asia/Tashkent",
      bookingWindowDays: bookingWindowDays ?? 7,
      allowSameDay: allowSameDay ?? true,
      enableQueue: enableQueue ?? true,
      enableSlots: enableSlots ?? true,
      enableHomeService: enableHomeService ?? false,
      enableWebapp: enableWebapp ?? true,
      enableBot: enableBot ?? true,
    },
    update: {
      ...(dailyLimit !== undefined && { dailyLimit }),
      ...(timezone !== undefined && { timezone }),
      ...(bookingWindowDays !== undefined && { bookingWindowDays }),
      ...(allowSameDay !== undefined && { allowSameDay }),
      ...(enableQueue !== undefined && { enableQueue }),
      ...(enableSlots !== undefined && { enableSlots }),
      ...(enableHomeService !== undefined && { enableHomeService }),
      ...(enableWebapp !== undefined && { enableWebapp }),
      ...(enableBot !== undefined && { enableBot }),
    },
  });

  await createAuditLog(user.userId, "SETTINGS_UPDATED", { clinicId: params.id, changes: body }, params.id);

  return ok(settings);
}
