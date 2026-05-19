import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decimalSumToTiyin } from "@/lib/payment/money";
import { getClickCheckoutUrlForAppointment } from "@/lib/payment/click/checkout-url";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { appointmentId?: string; returnUrl?: string };
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
  if (appointment.status === "cancelled" || appointment.status === "missed") {
    return NextResponse.json({ error: "Qabul bekor qilingan" }, { status: 400 });
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

  const result = await getClickCheckoutUrlForAppointment({
    appointmentId: appointment.id,
    clinicPaymentConfig: appointment.clinic.paymentConfig,
    amountTiyin,
    returnUrl: body.returnUrl,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ url: result.url, amount: Number(amountTiyin) });
}
