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

// Kelajakda: xodim/xizmat klinikalar orasida ko'chirilganda ishlatiladigan
// audit action nomlari. Hali hech qanday ishlatuvchi kod yo'q.
export const CLINIC_CHANGE_AUDIT_ACTIONS = {
  DOCTOR_CLINIC_CHANGE: "doctor.clinic_change",
  SERVICE_CLINIC_CHANGE: "service.clinic_change",
  STAFF_CLINIC_CHANGE: "staff.clinic_change",
} as const;

export type ClinicChangeAuditAction =
  (typeof CLINIC_CHANGE_AUDIT_ACTIONS)[keyof typeof CLINIC_CHANGE_AUDIT_ACTIONS];
