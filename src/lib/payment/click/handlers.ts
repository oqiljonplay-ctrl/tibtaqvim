import { prisma } from "@/lib/prisma";
import { PAYMENT_AUDIT_ACTIONS } from "@/lib/audit/actions";
import { decimalSumToTiyin, sumToTiyin } from "@/lib/payment/money";
import { decryptSecret } from "@/lib/payment/secrets";
import { ClickError, CLICK_ERROR_CODES } from "./errors";
import {
  buildPrepareSignString,
  buildCompleteSignString,
  constantTimeEqual,
} from "./signature";
import { resolveClinicForClick } from "./resolve-clinic";
import type {
  ClickPrepareRequest,
  ClickCompleteRequest,
  ClickPrepareResponse,
  ClickCompleteResponse,
} from "./types";

// ============ Prepare (action = 0) ============

export async function handleClickPrepare(
  req: ClickPrepareRequest
): Promise<ClickPrepareResponse> {
  const clinic = await resolveClinicForClick({
    serviceId: req.service_id,
    merchantTransId: req.merchant_trans_id,
  });
  if (!clinic || !clinic.enabled) {
    throw new ClickError(CLICK_ERROR_CODES.USER_NOT_FOUND);
  }

  const expectedSign = buildPrepareSignString({
    clickTransId: req.click_trans_id,
    serviceId: req.service_id,
    secretKey: decryptSecret(clinic.secretKey),
    merchantTransId: req.merchant_trans_id,
    amount: req.amount,
    action: req.action,
    signTime: req.sign_time,
  });
  if (!constantTimeEqual(expectedSign, req.sign_string)) {
    throw new ClickError(CLICK_ERROR_CODES.SIGN_CHECK_FAILED);
  }

  if (req.action !== "0") {
    throw new ClickError(CLICK_ERROR_CODES.ACTION_NOT_FOUND);
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: req.merchant_trans_id },
    include: { service: true },
  });
  if (!appointment) {
    throw new ClickError(CLICK_ERROR_CODES.USER_NOT_FOUND);
  }
  if (appointment.clinicId !== clinic.clinicId) {
    throw new ClickError(CLICK_ERROR_CODES.USER_NOT_FOUND);
  }
  if (appointment.status === "cancelled" || appointment.status === "missed") {
    throw new ClickError(CLICK_ERROR_CODES.TRANSACTION_CANCELLED);
  }
  if (appointment.paymentStatus === "paid") {
    throw new ClickError(CLICK_ERROR_CODES.ALREADY_PAID);
  }

  const expectedTiyin = decimalSumToTiyin(appointment.service.prePaymentAmount);
  if (!expectedTiyin || expectedTiyin <= 0n) {
    throw new ClickError(CLICK_ERROR_CODES.INVALID_AMOUNT);
  }
  const incomingTiyin = sumToTiyin(req.amount);
  if (incomingTiyin !== expectedTiyin) {
    throw new ClickError(CLICK_ERROR_CODES.INVALID_AMOUNT);
  }

  const existing = await prisma.payment.findUnique({
    where: {
      provider_tx_unique: {
        provider: "click",
        providerTxId: req.click_trans_id,
      },
    },
  });

  if (existing) {
    if (existing.state === "cancelled" || existing.state === "failed") {
      throw new ClickError(CLICK_ERROR_CODES.TRANSACTION_CANCELLED);
    }
    return {
      click_trans_id: req.click_trans_id,
      merchant_trans_id: req.merchant_trans_id,
      merchant_prepare_id: existing.id,
      error: 0,
      error_note: "Success",
    };
  }

  const activeOther = await prisma.payment.findFirst({
    where: {
      appointmentId: appointment.id,
      state: { in: ["pending", "authorized"] },
    },
  });
  if (activeOther) {
    throw new ClickError(CLICK_ERROR_CODES.ALREADY_PAID);
  }

  const payment = await prisma.payment.create({
    data: {
      appointmentId: appointment.id,
      clinicId: appointment.clinicId,
      userId: appointment.userId,
      provider: "click",
      providerTxId: req.click_trans_id,
      amount: incomingTiyin,
      state: "authorized",
      authorizedAt: new Date(),
      rawCreate: req as unknown as object,
    },
  });

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: { paymentStatus: "pending" },
  });

  await prisma.auditLog.create({
    data: {
      actorId: "click-system",
      clinicId: appointment.clinicId,
      action: PAYMENT_AUDIT_ACTIONS.PAYMENT_AUTHORIZED,
      payload: {
        paymentId: payment.id,
        provider: "click",
        clickTransId: req.click_trans_id,
      },
    },
  });

  return {
    click_trans_id: req.click_trans_id,
    merchant_trans_id: req.merchant_trans_id,
    merchant_prepare_id: payment.id,
    error: 0,
    error_note: "Success",
  };
}

// ============ Complete (action = 1) ============

export async function handleClickComplete(
  req: ClickCompleteRequest
): Promise<ClickCompleteResponse> {
  const clinic = await resolveClinicForClick({
    serviceId: req.service_id,
    merchantTransId: req.merchant_trans_id,
  });
  if (!clinic || !clinic.enabled) {
    throw new ClickError(CLICK_ERROR_CODES.USER_NOT_FOUND);
  }

  const expectedSign = buildCompleteSignString({
    clickTransId: req.click_trans_id,
    serviceId: req.service_id,
    secretKey: decryptSecret(clinic.secretKey),
    merchantTransId: req.merchant_trans_id,
    merchantPrepareId: req.merchant_prepare_id,
    amount: req.amount,
    action: req.action,
    signTime: req.sign_time,
  });
  if (!constantTimeEqual(expectedSign, req.sign_string)) {
    throw new ClickError(CLICK_ERROR_CODES.SIGN_CHECK_FAILED);
  }

  if (req.action !== "1") {
    throw new ClickError(CLICK_ERROR_CODES.ACTION_NOT_FOUND);
  }

  const payment = await prisma.payment.findUnique({
    where: { id: req.merchant_prepare_id },
    include: { appointment: { select: { status: true } } },
  });
  if (!payment) {
    throw new ClickError(CLICK_ERROR_CODES.TRANSACTION_NOT_FOUND);
  }
  if (payment.providerTxId !== req.click_trans_id) {
    throw new ClickError(CLICK_ERROR_CODES.TRANSACTION_NOT_FOUND);
  }
  if (payment.clinicId !== clinic.clinicId) {
    throw new ClickError(CLICK_ERROR_CODES.TRANSACTION_NOT_FOUND);
  }

  if (payment.state === "paid") {
    return {
      click_trans_id: req.click_trans_id,
      merchant_trans_id: req.merchant_trans_id,
      merchant_confirm_id: payment.id,
      error: 0,
      error_note: "Success",
    };
  }
  if (payment.state === "failed" || payment.state === "cancelled") {
    throw new ClickError(CLICK_ERROR_CODES.TRANSACTION_CANCELLED);
  }
  if (payment.state !== "authorized") {
    throw new ClickError(CLICK_ERROR_CODES.TRANSACTION_NOT_FOUND);
  }

  const clickError = parseInt(req.error, 10);

  if (clickError < 0) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        state: "failed",
        errorCode: req.error,
        errorMessage: req.error_note,
        rawCallback: req as unknown as object,
      },
    });
    await prisma.appointment.update({
      where: { id: payment.appointmentId },
      data: { paymentStatus: "failed" },
    });
    await prisma.auditLog.create({
      data: {
        actorId: "click-system",
        clinicId: payment.clinicId,
        action: PAYMENT_AUDIT_ACTIONS.PAYMENT_FAILED,
        payload: {
          paymentId: payment.id,
          provider: "click",
          clickTransId: req.click_trans_id,
          error: req.error,
          errorNote: req.error_note,
        },
      },
    });
    throw new ClickError(CLICK_ERROR_CODES.TRANSACTION_NOT_FOUND);
  }

  const now = new Date();
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      state: "paid",
      paidAt: now,
      rawCallback: req as unknown as object,
    },
  });
  await prisma.appointment.update({
    where: { id: payment.appointmentId },
    data: { paymentStatus: "paid" },
  });
  await prisma.auditLog.create({
    data: {
      actorId: "click-system",
      clinicId: payment.clinicId,
      action: PAYMENT_AUDIT_ACTIONS.PAYMENT_PAID,
      payload: {
        paymentId: payment.id,
        provider: "click",
        clickTransId: req.click_trans_id,
      },
    },
  });

  return {
    click_trans_id: req.click_trans_id,
    merchant_trans_id: req.merchant_trans_id,
    merchant_confirm_id: payment.id,
    error: 0,
    error_note: "Success",
  };
}
