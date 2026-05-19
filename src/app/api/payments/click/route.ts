import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ClickError, CLICK_ERROR_CODES } from "@/lib/payment/click/errors";
import { handleClickPrepare, handleClickComplete } from "@/lib/payment/click/handlers";
import { PAYMENT_AUDIT_ACTIONS } from "@/lib/audit/actions";
import type {
  ClickPrepareRequest,
  ClickCompleteRequest,
} from "@/lib/payment/click/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REQUIRED_FIELDS = [
  "click_trans_id",
  "service_id",
  "merchant_trans_id",
  "amount",
  "action",
  "error",
  "error_note",
  "sign_time",
  "sign_string",
  "click_paydoc_id",
];

export async function POST(req: NextRequest) {
  let params: Record<string, string>;
  try {
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      params = await req.json();
    } else {
      const formData = await req.formData();
      params = {};
      for (const [k, v] of formData.entries()) {
        params[k] = String(v);
      }
    }
  } catch {
    return clickResponse(CLICK_ERROR_CODES.ERROR_IN_REQUEST);
  }

  for (const field of REQUIRED_FIELDS) {
    if (!(field in params) || params[field] === undefined) {
      if (field === "merchant_prepare_id") continue;
      return clickResponse(CLICK_ERROR_CODES.ERROR_IN_REQUEST);
    }
  }

  const action = params.action;

  await prisma.auditLog
    .create({
      data: {
        actorId: "click-system",
        clinicId: null,
        action: PAYMENT_AUDIT_ACTIONS.PAYMENT_WEBHOOK_RECEIVED,
        payload: {
          provider: "click",
          action,
          click_trans_id: params.click_trans_id,
          merchant_trans_id: params.merchant_trans_id,
        },
      },
    })
    .catch(() => {});

  try {
    if (action === "0") {
      const result = await handleClickPrepare(params as unknown as ClickPrepareRequest);
      return NextResponse.json(result);
    } else if (action === "1") {
      if (!params.merchant_prepare_id) {
        return clickResponse(CLICK_ERROR_CODES.ERROR_IN_REQUEST);
      }
      const result = await handleClickComplete(
        params as unknown as ClickCompleteRequest
      );
      return NextResponse.json(result);
    } else {
      return clickResponse(CLICK_ERROR_CODES.ACTION_NOT_FOUND);
    }
  } catch (e) {
    if (e instanceof ClickError) {
      await prisma.auditLog
        .create({
          data: {
            actorId: "click-system",
            clinicId: null,
            action: PAYMENT_AUDIT_ACTIONS.PAYMENT_WEBHOOK_REJECTED,
            payload: {
              provider: "click",
              action,
              error: e.code,
              note: e.note,
            },
          },
        })
        .catch(() => {});
      return NextResponse.json(e.toResponse());
    }
    console.error("[Click] System error:", e);
    return clickResponse(CLICK_ERROR_CODES.ERROR_IN_REQUEST, "Internal error");
  }
}

export async function GET() {
  return NextResponse.json({
    error: CLICK_ERROR_CODES.ERROR_IN_REQUEST,
    error_note: "Only POST allowed",
  });
}

function clickResponse(code: number, note?: string) {
  return NextResponse.json(new ClickError(code, note).toResponse());
}
