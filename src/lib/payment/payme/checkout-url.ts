import { parsePaymentConfig } from "@/lib/payment/config-schema";
import type { PaymeConfig } from "@/lib/payment/config-schema";

export interface PaymeCheckoutOptions {
  config: PaymeConfig;
  appointmentId: string;
  amountTiyin: bigint;
  returnUrl?: string;
  lang?: "uz" | "ru" | "en";
}

/**
 * Payme checkout URL generatsiya qilish.
 * Format: https://checkout.paycom.uz/<base64(m=...;ac.appointment_id=...;a=...;l=...;c=...)>
 */
export function buildPaymeCheckoutUrl(opts: PaymeCheckoutOptions): string {
  const { config, appointmentId, amountTiyin, returnUrl, lang = "uz" } = opts;

  const parts: string[] = [
    `m=${config.merchantId}`,
    `ac.appointment_id=${appointmentId}`,
    `a=${amountTiyin.toString()}`,
    `l=${lang}`,
  ];
  if (returnUrl) parts.push(`c=${returnUrl}`);

  const base64 = Buffer.from(parts.join(";"), "utf-8").toString("base64");
  const baseUrl = config.testMode
    ? "https://checkout.test.paycom.uz"
    : "https://checkout.paycom.uz";

  return `${baseUrl}/${base64}`;
}

export async function getCheckoutUrlForAppointment(args: {
  appointmentId: string;
  clinicPaymentConfig: unknown;
  amountTiyin: bigint;
  returnUrl?: string;
  lang?: "uz" | "ru" | "en";
}): Promise<{ url: string } | { error: string }> {
  const config = parsePaymentConfig(args.clinicPaymentConfig);
  if (!config?.payme?.enabled) {
    return { error: "Payme bu klinika uchun yoqilmagan" };
  }
  const url = buildPaymeCheckoutUrl({
    config: config.payme,
    appointmentId: args.appointmentId,
    amountTiyin: args.amountTiyin,
    returnUrl: args.returnUrl,
    lang: args.lang,
  });
  return { url };
}
