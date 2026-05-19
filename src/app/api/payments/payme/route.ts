import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parsePaymentConfig } from "@/lib/payment/config-schema";
import { decryptSecret, maskSecret } from "@/lib/payment/secrets";
import { PAYMENT_AUDIT_ACTIONS } from "@/lib/audit/actions";
import { PaymeError, PAYME_ERROR_CODES } from "@/lib/payment/payme/errors";
import {
  handleCheckPerformTransaction,
  handleCreateTransaction,
  handlePerformTransaction,
  handleCancelTransaction,
  handleCheckTransaction,
  handleGetStatement,
} from "@/lib/payment/payme/handlers";
import type {
  PaymeRpcRequest,
  PaymeRpcResponse,
} from "@/lib/payment/payme/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return rpcError(null, PAYME_ERROR_CODES.INVALID_HTTP_METHOD);
}
export async function PUT() {
  return rpcError(null, PAYME_ERROR_CODES.INVALID_HTTP_METHOD);
}
export async function DELETE() {
  return rpcError(null, PAYME_ERROR_CODES.INVALID_HTTP_METHOD);
}

export async function POST(req: NextRequest) {
  let body: PaymeRpcRequest;

  try {
    const rawText = await req.text();
    body = JSON.parse(rawText) as PaymeRpcRequest;
  } catch {
    return rpcError(null, PAYME_ERROR_CODES.JSON_PARSE_ERROR);
  }

  const reqId = body?.id ?? null;

  if (!body || typeof body.method !== "string" || body.params === undefined) {
    return rpcError(reqId, PAYME_ERROR_CODES.INVALID_RPC_REQUEST);
  }

  let clinicId: string | null = null;
  try {
    clinicId = await resolveClinicId(body);
  } catch (e) {
    if (e instanceof PaymeError) {
      return NextResponse.json(e.toRpcError(reqId));
    }
    throw e;
  }

  if (!clinicId) {
    return rpcError(reqId, PAYME_ERROR_CODES.INSUFFICIENT_PRIVILEGE);
  }

  const authHeader = req.headers.get("authorization");
  const authOk = await verifyBasicAuth(authHeader, clinicId);
  if (!authOk) {
    await prisma.auditLog
      .create({
        data: {
          actorId: "payme-system",
          clinicId,
          action: PAYMENT_AUDIT_ACTIONS.PAYMENT_WEBHOOK_REJECTED,
          payload: {
            reason: "auth_failed",
            method: body.method,
            masked: maskSecret(authHeader ?? undefined),
          },
        },
      })
      .catch(() => {});
    return rpcError(reqId, PAYME_ERROR_CODES.INSUFFICIENT_PRIVILEGE);
  }

  await prisma.auditLog
    .create({
      data: {
        actorId: "payme-system",
        clinicId,
        action: PAYMENT_AUDIT_ACTIONS.PAYMENT_WEBHOOK_RECEIVED,
        payload: { method: body.method, params: body.params as object },
      },
    })
    .catch(() => {});

  try {
    let result: unknown;
    switch (body.method) {
      case "CheckPerformTransaction":
        result = await handleCheckPerformTransaction(
          body.params as never,
          clinicId
        );
        break;
      case "CreateTransaction":
        result = await handleCreateTransaction(body.params as never, clinicId);
        break;
      case "PerformTransaction":
        result = await handlePerformTransaction(body.params as never, clinicId);
        break;
      case "CancelTransaction":
        result = await handleCancelTransaction(body.params as never, clinicId);
        break;
      case "CheckTransaction":
        result = await handleCheckTransaction(body.params as never, clinicId);
        break;
      case "GetStatement":
        result = await handleGetStatement(body.params as never, clinicId);
        break;
      default:
        return rpcError(reqId, PAYME_ERROR_CODES.METHOD_NOT_FOUND, body.method);
    }

    const response: PaymeRpcResponse = {
      jsonrpc: "2.0",
      id: reqId,
      result: result as object,
    };
    return NextResponse.json(response);
  } catch (e) {
    if (e instanceof PaymeError) {
      return NextResponse.json(e.toRpcError(reqId));
    }
    console.error("[Payme] System error:", e);
    return rpcError(reqId, PAYME_ERROR_CODES.SYSTEM_ERROR);
  }
}

// ============ Helpers ============

function rpcError(
  id: number | string | null,
  code: number,
  data?: string
): NextResponse {
  return NextResponse.json(new PaymeError(code, data).toRpcError(id));
}

/**
 * params ichidan clinicId ni aniqlash:
 * - account.appointment_id → appointment.clinicId
 * - params.id (paymeId) → Payment.clinicId
 * - GetStatement: birinchi enabled klinika (vaqtinchalik)
 */
async function resolveClinicId(body: PaymeRpcRequest): Promise<string | null> {
  const params = body.params as Record<string, unknown>;

  const account = params?.account as
    | { appointment_id?: string }
    | undefined;
  if (account?.appointment_id && typeof account.appointment_id === "string") {
    const apt = await prisma.appointment.findUnique({
      where: { id: account.appointment_id },
      select: { clinicId: true },
    });
    if (apt) return apt.clinicId;
    throw new PaymeError(
      PAYME_ERROR_CODES.ACCOUNT_NOT_FOUND,
      "appointment_id"
    );
  }

  const paymeId = params?.id;
  if (typeof paymeId === "string") {
    const payment = await prisma.payment.findUnique({
      where: {
        provider_tx_unique: { provider: "payme", providerTxId: paymeId },
      },
      select: { clinicId: true },
    });
    if (payment) return payment.clinicId;
    throw new PaymeError(PAYME_ERROR_CODES.TRANSACTION_NOT_FOUND);
  }

  if (body.method === "GetStatement") {
    const clinics = await prisma.clinic.findMany({
      select: { id: true, paymentConfig: true },
      take: 20,
    });
    for (const clinic of clinics) {
      const cfg = parsePaymentConfig(clinic.paymentConfig);
      if (cfg?.payme?.enabled) return clinic.id;
    }
  }

  return null;
}

async function verifyBasicAuth(
  authHeader: string | null,
  clinicId: string
): Promise<boolean> {
  if (!authHeader) return false;
  const match = authHeader.match(/^\s*Basic\s+(\S+)\s*$/i);
  if (!match) return false;

  let decoded: string;
  try {
    decoded = Buffer.from(match[1], "base64").toString("utf-8");
  } catch {
    return false;
  }

  const colonIdx = decoded.indexOf(":");
  if (colonIdx === -1) return false;
  const login = decoded.slice(0, colonIdx);
  const password = decoded.slice(colonIdx + 1);
  if (login !== "Paycom" || !password) return false;

  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { paymentConfig: true },
  });
  if (!clinic) return false;

  const config = parsePaymentConfig(clinic.paymentConfig);
  if (!config?.payme?.enabled) return false;

  const expectedKey = decryptSecret(config.payme.secretKey);

  if (password.length !== expectedKey.length) return false;
  let diff = 0;
  for (let i = 0; i < password.length; i++) {
    diff |= password.charCodeAt(i) ^ expectedKey.charCodeAt(i);
  }
  return diff === 0;
}
