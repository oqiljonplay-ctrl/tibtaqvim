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
    is24Hours,
    holidays,
  } = body;

  // holidays[] formatini tekshirish: har element YYYY-MM-DD bo'lishi kerak
  if (holidays !== undefined) {
    if (!Array.isArray(holidays)) {
      return Response.json({ success: false, error: { message: "holidays massiv bo'lishi kerak" } }, { status: 400 });
    }
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (holidays.some((d: unknown) => typeof d !== "string" || !dateRe.test(d))) {
      return Response.json({ success: false, error: { message: "holidays elementlari YYYY-MM-DD formatida bo'lishi kerak" } }, { status: 400 });
    }
  }

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
      is24Hours: is24Hours ?? false,
      holidays: holidays ?? [],
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
      ...(is24Hours !== undefined && { is24Hours }),
      ...(holidays !== undefined && { holidays }),
    },
  });

  await createAuditLog(user.userId, "SETTINGS_UPDATED", { clinicId: params.id, changes: body }, params.id);

  return ok(settings);
}
