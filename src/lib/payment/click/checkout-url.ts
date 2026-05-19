import { parsePaymentConfig } from "@/lib/payment/config-schema";
import type { ClickConfig } from "@/lib/payment/config-schema";

export interface ClickCheckoutOptions {
  config: ClickConfig;
  appointmentId: string;
  amountTiyin: bigint;
  returnUrl?: string;
}

/**
 * Click checkout URL.
 * Format: https://my.click.uz/services/pay?service_id=...&merchant_id=...&amount=...&transaction_param=...
 * Click amount ni SO'M (verguldan keyin 2 raqam) qabul qiladi.
 */
export function buildClickCheckoutUrl(opts: ClickCheckoutOptions): string {
  const { config, appointmentId, amountTiyin, returnUrl } = opts;

  const sum = (Number(amountTiyin) / 100).toFixed(2);

  const params = new URLSearchParams({
    service_id: config.serviceId,
    merchant_id: config.merchantId,
    amount: sum,
    transaction_param: appointmentId,
  });
  if (returnUrl) params.set("return_url", returnUrl);
  if (config.merchantUserId) params.set("merchant_user_id", config.merchantUserId);

  return `https://my.click.uz/services/pay?${params.toString()}`;
}

export async function getClickCheckoutUrlForAppointment(args: {
  appointmentId: string;
  clinicPaymentConfig: unknown;
  amountTiyin: bigint;
  returnUrl?: string;
}): Promise<{ url: string } | { error: string }> {
  const config = parsePaymentConfig(args.clinicPaymentConfig);
  if (!config?.click?.enabled) {
    return { error: "Click bu klinika uchun yoqilmagan" };
  }
  const url = buildClickCheckoutUrl({
    config: config.click,
    appointmentId: args.appointmentId,
    amountTiyin: args.amountTiyin,
    returnUrl: args.returnUrl,
  });
  return { url };
}
