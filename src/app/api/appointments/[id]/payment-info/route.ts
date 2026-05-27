import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parsePaymentConfig, isProviderEnabled } from "@/lib/payment/config-schema";
import { decimalSumToTiyin, formatSum } from "@/lib/payment/money";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const tgid = new URL(req.url).searchParams.get("tgid");

  const appointment = await prisma.appointment.findUnique({
    where: { id: params.id },
    include: {
      service: true,
      clinic: { select: { paymentConfig: true } },
      user: { select: { telegramId: true } },
    },
  });
  if (!appointment) {
    return NextResponse.json({ error: "Topilmadi" }, { status: 404 });
  }

  // Ownership tekshiruvi: bemor faqat o'z bronini ko'radi
  if (!tgid || appointment.user?.telegramId !== tgid) {
    return NextResponse.json({ error: "Ruxsat yo'q" }, { status: 403 });
  }

  const amountTiyin = decimalSumToTiyin(appointment.service.prePaymentAmount);
  const config = parsePaymentConfig(appointment.clinic.paymentConfig);

  return NextResponse.json({
    id: appointment.id,
    patientName: appointment.patientName,
    date: appointment.date.toISOString().slice(0, 10),
    serviceName: appointment.service.name,
    amount: amountTiyin ? Number(amountTiyin) : 0,
    amountFormatted: amountTiyin ? formatSum(amountTiyin) : "0 so'm",
    paymentStatus: appointment.paymentStatus,
    providers: {
      payme: isProviderEnabled(config, "payme"),
      click: isProviderEnabled(config, "click"),
    },
  });
}
