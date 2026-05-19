import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { decimalSumToTiyin } from "@/lib/payment/money";
import { getCheckoutUrlForAppointment } from "@/lib/payment/payme/checkout-url";

export const runtime = "nodejs";

/**
 * POST /api/payments/payme/create-link
 * Body: { appointmentId: string, returnUrl?: string, lang?: 'uz'|'ru'|'en' }
 * Response: { url: string, amount: number } | { error: string }
 */
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "Auth kerak" }, { status: 401 });
  }

  let body: { appointmentId?: string; returnUrl?: string; lang?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Yaroqsiz JSON" }, { status: 400 });
  }

  if (!body.appointmentId || typeof body.appointmentId !== "string") {
    return NextResponse.json({ error: "appointmentId majburiy" }, { status: 400 });
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: body.appointmentId },
    include: {
      service: true,
      clinic: { select: { id: true, paymentConfig: true } },
    },
  });

  if (!appointment) {
    return NextResponse.json({ error: "Qabul topilmadi" }, { status: 404 });
  }

  if (
    auth.role !== "super_admin" &&
    auth.role !== "clinic_admin" &&
    appointment.userId !== auth.userId
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (appointment.status === "cancelled" || appointment.status === "missed") {
    return NextResponse.json(
      { error: "Qabul bekor qilingan yoki o'tib ketgan" },
      { status: 400 }
    );
  }
  if (appointment.paymentStatus === "paid") {
    return NextResponse.json({ error: "Allaqachon to'langan" }, { status: 400 });
  }
  if (!appointment.service.requiresPrePayment) {
    return NextResponse.json(
      { error: "Bu xizmat uchun to'lov talab qilinmaydi" },
      { status: 400 }
    );
  }

  const amountTiyin = decimalSumToTiyin(appointment.service.prePaymentAmount);
  if (!amountTiyin || amountTiyin <= 0n) {
    return NextResponse.json({ error: "Summa noto'g'ri" }, { status: 400 });
  }

  const result = await getCheckoutUrlForAppointment({
    appointmentId: appointment.id,
    clinicPaymentConfig: appointment.clinic.paymentConfig,
    amountTiyin,
    returnUrl: body.returnUrl,
    lang: (body.lang as "uz" | "ru" | "en") || "uz",
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ url: result.url, amount: Number(amountTiyin) });
}
