import { prisma } from "@/lib/prisma";
import { parsePaymentConfig } from "@/lib/payment/config-schema";

export interface ClickClinicInfo {
  clinicId: string;
  secretKey: string;
  merchantId: string;
  enabled: boolean;
}

/**
 * Click service_id + merchant_trans_id (appointment.id) orqali klinikani topadi.
 * Avval appointment orqali, fallback - service_id orqali.
 */
export async function resolveClinicForClick(args: {
  serviceId: string;
  merchantTransId: string;
}): Promise<ClickClinicInfo | null> {
  const appointment = await prisma.appointment.findUnique({
    where: { id: args.merchantTransId },
    include: {
      clinic: { select: { id: true, paymentConfig: true } },
    },
  });

  if (appointment) {
    const cfg = parsePaymentConfig(appointment.clinic.paymentConfig);
    if (cfg?.click?.enabled && cfg.click.serviceId === args.serviceId) {
      return {
        clinicId: appointment.clinic.id,
        secretKey: cfg.click.secretKey,
        merchantId: cfg.click.merchantId,
        enabled: true,
      };
    }
  }

  const clinics = await prisma.clinic.findMany({
    select: { id: true, paymentConfig: true },
  });

  for (const c of clinics) {
    const cfg = parsePaymentConfig(c.paymentConfig);
    if (cfg?.click?.enabled && cfg.click.serviceId === args.serviceId) {
      return {
        clinicId: c.id,
        secretKey: cfg.click.secretKey,
        merchantId: cfg.click.merchantId,
        enabled: true,
      };
    }
  }

  return null;
}
