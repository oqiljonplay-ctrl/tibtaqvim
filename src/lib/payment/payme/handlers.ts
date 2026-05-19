import { prisma } from "@/lib/prisma";
import { PAYMENT_AUDIT_ACTIONS } from "@/lib/audit/actions";
import { decimalSumToTiyin } from "@/lib/payment/money";
import { PaymeError, PAYME_ERROR_CODES } from "./errors";
import type {
  CheckPerformTransactionParams,
  CheckPerformTransactionResult,
  CreateTransactionParams,
  CreateTransactionResult,
  PerformTransactionParams,
  PerformTransactionResult,
  CancelTransactionParams,
  CancelTransactionResult,
  CheckTransactionParams,
  CheckTransactionResult,
  GetStatementParams,
  GetStatementResult,
  PaymeCancelReason,
} from "./types";

// ============ 1. CheckPerformTransaction ============

export async function handleCheckPerformTransaction(
  params: CheckPerformTransactionParams,
  clinicId: string
): Promise<CheckPerformTransactionResult> {
  const { amount, account } = params;

  if (!account?.appointment_id) {
    throw new PaymeError(
      PAYME_ERROR_CODES.ACCOUNT_NOT_FOUND,
      "appointment_id",
      { uz: "Qabul ID si yo'q", ru: "ID приёма отсутствует", en: "Missing appointment_id" }
    );
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: account.appointment_id },
    include: {
      service: true,
      clinic: { select: { id: true } },
    },
  });

  if (!appointment) {
    throw new PaymeError(PAYME_ERROR_CODES.ACCOUNT_NOT_FOUND, "appointment_id");
  }

  if (appointment.clinicId !== clinicId) {
    throw new PaymeError(PAYME_ERROR_CODES.ACCOUNT_NOT_FOUND, "appointment_id");
  }

  if (appointment.status === "cancelled" || appointment.status === "missed") {
    throw new PaymeError(PAYME_ERROR_CODES.APPOINTMENT_NOT_PAYABLE, "appointment_id");
  }

  if (!appointment.service.requiresPrePayment) {
    throw new PaymeError(PAYME_ERROR_CODES.APPOINTMENT_NOT_PAYABLE, "appointment_id");
  }

  const expectedTiyin = decimalSumToTiyin(appointment.service.prePaymentAmount);
  if (expectedTiyin === null || expectedTiyin <= 0n) {
    throw new PaymeError(PAYME_ERROR_CODES.APPOINTMENT_NOT_PAYABLE, "appointment_id");
  }

  if (BigInt(amount) !== expectedTiyin) {
    throw new PaymeError(PAYME_ERROR_CODES.INVALID_AMOUNT);
  }

  return { allow: true };
}

// ============ 2. CreateTransaction ============

export async function handleCreateTransaction(
  params: CreateTransactionParams,
  clinicId: string
): Promise<CreateTransactionResult> {
  const { id: paymeId, amount, account } = params;

  const existing = await prisma.payment.findUnique({
    where: {
      provider_tx_unique: { provider: "payme", providerTxId: paymeId },
    },
  });

  if (existing) {
    if (existing.state === "cancelled" || existing.state === "failed") {
      throw new PaymeError(PAYME_ERROR_CODES.CANNOT_PERFORM_OPERATION);
    }
    return {
      create_time: existing.createdAt.getTime(),
      transaction: existing.id,
      state: 1,
    };
  }

  const checkResult = await handleCheckPerformTransaction({ amount, account }, clinicId);
  if (!checkResult.allow) {
    throw new PaymeError(PAYME_ERROR_CODES.CANNOT_PERFORM_OPERATION);
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: account.appointment_id },
    select: { id: true, clinicId: true, userId: true },
  });
  if (!appointment) {
    throw new PaymeError(PAYME_ERROR_CODES.ACCOUNT_NOT_FOUND, "appointment_id");
  }

  const activePayment = await prisma.payment.findFirst({
    where: {
      appointmentId: appointment.id,
      provider: "payme",
      state: { in: ["pending", "authorized"] },
    },
  });
  if (activePayment) {
    throw new PaymeError(PAYME_ERROR_CODES.CANNOT_PERFORM_OPERATION);
  }

  const payment = await prisma.payment.create({
    data: {
      appointmentId: appointment.id,
      clinicId: appointment.clinicId,
      userId: appointment.userId,
      provider: "payme",
      providerTxId: paymeId,
      amount: BigInt(amount),
      state: "authorized",
      authorizedAt: new Date(),
      rawCreate: params as unknown as object,
    },
  });

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { paymentStatus: "pending" },
  });

  await prisma.auditLog.create({
    data: {
      actorId: "payme-system",
      clinicId: appointment.clinicId,
      action: PAYMENT_AUDIT_ACTIONS.PAYMENT_AUTHORIZED,
      payload: { paymentId: payment.id, provider: "payme", paymeId },
    },
  });

  return {
    create_time: payment.createdAt.getTime(),
    transaction: payment.id,
    state: 1,
  };
}

// ============ 3. PerformTransaction ============

export async function handlePerformTransaction(
  params: PerformTransactionParams,
  clinicId: string
): Promise<PerformTransactionResult> {
  const { id: paymeId } = params;

  const payment = await prisma.payment.findUnique({
    where: {
      provider_tx_unique: { provider: "payme", providerTxId: paymeId },
    },
  });

  if (!payment) {
    throw new PaymeError(PAYME_ERROR_CODES.TRANSACTION_NOT_FOUND);
  }
  if (payment.clinicId !== clinicId) {
    throw new PaymeError(PAYME_ERROR_CODES.TRANSACTION_NOT_FOUND);
  }

  if (payment.state === "paid") {
    return {
      transaction: payment.id,
      perform_time: payment.paidAt?.getTime() ?? Date.now(),
      state: 2,
    };
  }

  if (payment.state !== "authorized") {
    throw new PaymeError(PAYME_ERROR_CODES.CANNOT_PERFORM_OPERATION);
  }

  const ageMs = Date.now() - payment.createdAt.getTime();
  if (ageMs > 12 * 60 * 60 * 1000) {
    throw new PaymeError(PAYME_ERROR_CODES.CANNOT_PERFORM_OPERATION);
  }

  const now = new Date();
  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: { state: "paid", paidAt: now },
  });

  await prisma.appointment.update({
    where: { id: payment.appointmentId },
    data: { paymentStatus: "paid" },
  });

  await prisma.auditLog.create({
    data: {
      actorId: "payme-system",
      clinicId: payment.clinicId,
      action: PAYMENT_AUDIT_ACTIONS.PAYMENT_PAID,
      payload: { paymentId: payment.id, provider: "payme", paymeId },
    },
  });

  return {
    transaction: updated.id,
    perform_time: now.getTime(),
    state: 2,
  };
}

// ============ 4. CancelTransaction ============

export async function handleCancelTransaction(
  params: CancelTransactionParams,
  clinicId: string
): Promise<CancelTransactionResult> {
  const { id: paymeId, reason } = params;

  const payment = await prisma.payment.findUnique({
    where: {
      provider_tx_unique: { provider: "payme", providerTxId: paymeId },
    },
  });

  if (!payment) {
    throw new PaymeError(PAYME_ERROR_CODES.TRANSACTION_NOT_FOUND);
  }
  if (payment.clinicId !== clinicId) {
    throw new PaymeError(PAYME_ERROR_CODES.TRANSACTION_NOT_FOUND);
  }

  if (payment.state === "cancelled" || payment.state === "refunded") {
    return {
      transaction: payment.id,
      cancel_time: payment.cancelledAt?.getTime() ?? Date.now(),
      state: payment.state === "refunded" ? -2 : -1,
    };
  }

  const newState: "cancelled" | "refunded" =
    payment.state === "paid" ? "refunded" : "cancelled";
  const rpcState: -1 | -2 = payment.state === "paid" ? -2 : -1;

  if (payment.state === "paid") {
    const appointment = await prisma.appointment.findUnique({
      where: { id: payment.appointmentId },
      select: { status: true },
    });
    if (appointment?.status === "arrived") {
      throw new PaymeError(PAYME_ERROR_CODES.CANNOT_CANCEL_COMPLETED);
    }
  }

  const now = new Date();
  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      state: newState,
      cancelledAt: now,
      errorCode: `payme_cancel_reason_${reason}`,
    },
  });

  await prisma.appointment.update({
    where: { id: payment.appointmentId },
    data: { paymentStatus: newState === "refunded" ? "refunded" : "cancelled" },
  });

  await prisma.auditLog.create({
    data: {
      actorId: "payme-system",
      clinicId: payment.clinicId,
      action:
        newState === "refunded"
          ? PAYMENT_AUDIT_ACTIONS.PAYMENT_REFUNDED
          : PAYMENT_AUDIT_ACTIONS.PAYMENT_CANCELLED,
      payload: { paymentId: payment.id, provider: "payme", paymeId, reason },
    },
  });

  return {
    transaction: updated.id,
    cancel_time: now.getTime(),
    state: rpcState,
  };
}

// ============ 5. CheckTransaction ============

export async function handleCheckTransaction(
  params: CheckTransactionParams,
  clinicId: string
): Promise<CheckTransactionResult> {
  const { id: paymeId } = params;

  const payment = await prisma.payment.findUnique({
    where: {
      provider_tx_unique: { provider: "payme", providerTxId: paymeId },
    },
  });

  if (!payment || payment.clinicId !== clinicId) {
    throw new PaymeError(PAYME_ERROR_CODES.TRANSACTION_NOT_FOUND);
  }

  const rpcState: -2 | -1 | 1 | 2 =
    payment.state === "paid" ? 2 :
    payment.state === "authorized" ? 1 :
    payment.state === "refunded" ? -2 :
    payment.state === "cancelled" ? -1 : 1;

  let reason: PaymeCancelReason | null = null;
  if (payment.errorCode?.startsWith("payme_cancel_reason_")) {
    const r = parseInt(payment.errorCode.replace("payme_cancel_reason_", ""), 10);
    if (r >= 1 && r <= 10) reason = r as PaymeCancelReason;
  }

  return {
    create_time: payment.createdAt.getTime(),
    perform_time: payment.paidAt?.getTime() ?? 0,
    cancel_time: payment.cancelledAt?.getTime() ?? 0,
    transaction: payment.id,
    state: rpcState,
    reason,
  };
}

// ============ 6. GetStatement ============

export async function handleGetStatement(
  params: GetStatementParams,
  clinicId: string
): Promise<GetStatementResult> {
  const { from, to } = params;

  const payments = await prisma.payment.findMany({
    where: {
      clinicId,
      provider: "payme",
      createdAt: { gte: new Date(from), lte: new Date(to) },
    },
    orderBy: { createdAt: "asc" },
  });

  return {
    transactions: payments.map((p) => {
      let reason: PaymeCancelReason | null = null;
      if (p.errorCode?.startsWith("payme_cancel_reason_")) {
        const r = parseInt(p.errorCode.replace("payme_cancel_reason_", ""), 10);
        if (r >= 1 && r <= 10) reason = r as PaymeCancelReason;
      }

      const rpcState: -2 | -1 | 1 | 2 =
        p.state === "paid" ? 2 :
        p.state === "authorized" ? 1 :
        p.state === "refunded" ? -2 :
        p.state === "cancelled" ? -1 : 1;

      return {
        id: p.providerTxId ?? "",
        time: p.createdAt.getTime(),
        amount: Number(p.amount),
        account: { appointment_id: p.appointmentId },
        create_time: p.createdAt.getTime(),
        perform_time: p.paidAt?.getTime() ?? 0,
        cancel_time: p.cancelledAt?.getTime() ?? 0,
        transaction: p.id,
        state: rpcState,
        reason,
        receivers: null,
      };
    }),
  };
}
