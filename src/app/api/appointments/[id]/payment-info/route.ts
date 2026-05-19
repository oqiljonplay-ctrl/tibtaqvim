import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parsePaymentConfig, isProviderEnabled } from "@/lib/payment/config-schema";
import { decimalSumToTiyin, formatSum } from "@/lib/payment/money";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: params.id },
    include: {
      service: true,
      clinic: { select: { paymentConfig: true } },
    },
  });
  if (!appointment) {
    return NextResponse.json({ error: "Topilmadi" }, { status: 404 });
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
