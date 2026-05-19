-- Sprint 1: Payment Foundation
-- Enum'lar

CREATE TYPE "PaymentProvider" AS ENUM ('payme', 'click');

CREATE TYPE "PaymentState" AS ENUM (
  'pending',
  'authorized',
  'paid',
  'cancelled',
  'failed',
  'refunded',
  'partial_refunded'
);

CREATE TYPE "RefundState" AS ENUM ('pending', 'succeeded', 'failed');

-- payments jadvali

CREATE TABLE "payments" (
  "id"            TEXT NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "clinicId"      TEXT NOT NULL,
  "userId"        TEXT,
  "provider"      "PaymentProvider" NOT NULL,
  "providerTxId"  TEXT,
  "amount"        BIGINT NOT NULL,
  "currency"      TEXT NOT NULL DEFAULT 'UZS',
  "state"         "PaymentState" NOT NULL DEFAULT 'pending',
  "rawCallback"   JSONB,
  "rawCreate"     JSONB,
  "errorCode"     TEXT,
  "errorMessage"  TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  "authorizedAt"  TIMESTAMP(3),
  "paidAt"        TIMESTAMP(3),
  "cancelledAt"   TIMESTAMP(3),

  CONSTRAINT "payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_tx_unique" UNIQUE ("provider", "providerTxId"),
  CONSTRAINT "payments_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "payments_clinicId_fkey"      FOREIGN KEY ("clinicId")      REFERENCES "clinics"("id")       ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "payments_userId_fkey"        FOREIGN KEY ("userId")        REFERENCES "users"("id")          ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "payments_appointmentId_idx"   ON "payments"("appointmentId");
CREATE INDEX "payments_clinicId_state_idx"  ON "payments"("clinicId", "state");
CREATE INDEX "payments_state_createdAt_idx" ON "payments"("state", "createdAt");

-- refunds jadvali

CREATE TABLE "refunds" (
  "id"              TEXT NOT NULL,
  "paymentId"       TEXT NOT NULL,
  "amount"          BIGINT NOT NULL,
  "reason"          TEXT,
  "state"           "RefundState" NOT NULL DEFAULT 'pending',
  "providerRefundId" TEXT,
  "rawCallback"     JSONB,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "refunds_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "refunds_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "refunds_paymentId_idx" ON "refunds"("paymentId");
