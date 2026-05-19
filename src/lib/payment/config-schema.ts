/**
 * Klinika to'lov konfiguratsiyasi.
 * `clinics.paymentConfig` (jsonb) ichida saqlanadi.
 *
 * SECURITY: Hozir secret'lar OCHIQ matnda. Sprint 4 da KMS/encryption qo'shiladi.
 * Shu uchun barcha o'qish/yozish encryptSecret/decryptSecret orqali bo'lishi shart.
 */

export interface PaymeConfig {
  enabled: boolean;
  merchantId: string;
  cashboxId?: string;
  secretKey: string;
  testMode: boolean;
  accountFieldName: string;
}

export interface ClickConfig {
  enabled: boolean;
  merchantId: string;
  serviceId: string;
  merchantUserId?: string;
  secretKey: string;
  testMode: boolean;
}

export interface PaymentConfig {
  payme?: PaymeConfig;
  click?: ClickConfig;
}

export function parsePaymentConfig(raw: unknown): PaymentConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const result: PaymentConfig = {};

  if (obj.payme && typeof obj.payme === "object") {
    const p = obj.payme as Record<string, unknown>;
    if (
      typeof p.enabled === "boolean" &&
      typeof p.merchantId === "string" &&
      typeof p.secretKey === "string" &&
      typeof p.testMode === "boolean" &&
      typeof p.accountFieldName === "string"
    ) {
      result.payme = {
        enabled: p.enabled,
        merchantId: p.merchantId,
        cashboxId: typeof p.cashboxId === "string" ? p.cashboxId : undefined,
        secretKey: p.secretKey,
        testMode: p.testMode,
        accountFieldName: p.accountFieldName,
      };
    }
  }

  if (obj.click && typeof obj.click === "object") {
    const c = obj.click as Record<string, unknown>;
    if (
      typeof c.enabled === "boolean" &&
      typeof c.merchantId === "string" &&
      typeof c.serviceId === "string" &&
      typeof c.secretKey === "string" &&
      typeof c.testMode === "boolean"
    ) {
      result.click = {
        enabled: c.enabled,
        merchantId: c.merchantId,
        serviceId: c.serviceId,
        merchantUserId:
          typeof c.merchantUserId === "string" ? c.merchantUserId : undefined,
        secretKey: c.secretKey,
        testMode: c.testMode,
      };
    }
  }

  if (!result.payme && !result.click) return null;
  return result;
}

export function validatePaymentConfigOrThrow(input: unknown): PaymentConfig {
  const parsed = parsePaymentConfig(input);
  if (!parsed) {
    throw new Error(
      "Yaroqsiz paymentConfig: Payme yoki Click konfiguratsiyasi yo'q yoki noto'g'ri tuzilgan."
    );
  }
  return parsed;
}

export function isProviderEnabled(
  config: PaymentConfig | null,
  provider: "payme" | "click"
): boolean {
  if (!config) return false;
  return Boolean(config[provider]?.enabled);
}
