export const PAYMENT_AUDIT_ACTIONS = {
  PAYMENT_CREATED: "payment.created",
  PAYMENT_AUTHORIZED: "payment.authorized",
  PAYMENT_PAID: "payment.paid",
  PAYMENT_CANCELLED: "payment.cancelled",
  PAYMENT_FAILED: "payment.failed",
  PAYMENT_REFUNDED: "payment.refunded",
  PAYMENT_WEBHOOK_RECEIVED: "payment.webhook.received",
  PAYMENT_WEBHOOK_REJECTED: "payment.webhook.rejected",
  PAYMENT_CONFIG_UPDATED: "clinic.payment_config.updated",
} as const;

export type PaymentAuditAction =
  (typeof PAYMENT_AUDIT_ACTIONS)[keyof typeof PAYMENT_AUDIT_ACTIONS];
