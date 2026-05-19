import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import {
  parsePaymentConfig,
  validatePaymentConfigOrThrow,
} from "@/lib/payment/config-schema";
import { encryptSecret } from "@/lib/payment/secrets";
import { PAYMENT_AUDIT_ACTIONS } from "@/lib/audit/actions";

/**
 * GET /api/admin/clinics/[id]/payment-config
 * Klinikaning to'lov konfiguratsiyasini qaytaradi (secretKey mask bilan).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireAuth(req);
  if (!auth) return NextResponse.json({ error: "Auth kerak" }, { status: 401 });

  if (
    auth.role !== "super_admin" &&
    !(auth.role === "clinic_admin" && auth.clinicId === params.id)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const clinic = await prisma.clinic.findUnique({
    where: { id: params.id },
    select: { paymentConfig: true },
  });
  if (!clinic) return NextResponse.json({ error: "Klinika topilmadi" }, { status: 404 });

  const config = parsePaymentConfig(clinic.paymentConfig);

  // secretKey'ni mask qilib qaytarish
  const safeConfig = config
    ? {
        payme: config.payme
          ? {
              ...config.payme,
              secretKey: maskKey(config.payme.secretKey),
            }
          : undefined,
        click: config.click
          ? {
              ...config.click,
              secretKey: maskKey(config.click.secretKey),
            }
          : undefined,
      }
    : null;

  return NextResponse.json({ config: safeConfig });
}

/**
 * PATCH /api/admin/clinics/[id]/payment-config
 * Body: { payme?: { enabled, merchantId, secretKey, testMode, accountFieldName, cashboxId } }
 * secretKey bo'sh string kelsa — eski key saqlanadi.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = requireAuth(req);
  if (!auth) return NextResponse.json({ error: "Auth kerak" }, { status: 401 });

  if (
    auth.role !== "super_admin" &&
    !(auth.role === "clinic_admin" && auth.clinicId === params.id)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as {
    payme?: {
      enabled?: boolean;
      merchantId?: string;
      secretKey?: string;
      testMode?: boolean;
      accountFieldName?: string;
      cashboxId?: string;
    };
  };

  const clinic = await prisma.clinic.findUnique({
    where: { id: params.id },
    select: { paymentConfig: true },
  });
  if (!clinic) return NextResponse.json({ error: "Klinika topilmadi" }, { status: 404 });

  const existing = parsePaymentConfig(clinic.paymentConfig);

  const mergedPayme = body.payme
    ? {
        enabled: body.payme.enabled ?? existing?.payme?.enabled ?? false,
        merchantId: body.payme.merchantId ?? existing?.payme?.merchantId ?? "",
        secretKey:
          body.payme.secretKey && body.payme.secretKey.length > 0
            ? encryptSecret(body.payme.secretKey)
            : (existing?.payme?.secretKey ?? ""),
        testMode: body.payme.testMode ?? existing?.payme?.testMode ?? true,
        accountFieldName:
          body.payme.accountFieldName ??
          existing?.payme?.accountFieldName ??
          "appointment_id",
        cashboxId: body.payme.cashboxId ?? existing?.payme?.cashboxId,
      }
    : existing?.payme;

  const newConfig = {
    ...(mergedPayme ? { payme: mergedPayme } : {}),
    ...(existing?.click ? { click: existing.click } : {}),
  };

  try {
    const validated = validatePaymentConfigOrThrow(newConfig);
    await prisma.clinic.update({
      where: { id: params.id },
      data: { paymentConfig: validated as object },
    });

    await prisma.auditLog.create({
      data: {
        actorId: auth.userId,
        clinicId: params.id,
        action: PAYMENT_AUDIT_ACTIONS.PAYMENT_CONFIG_UPDATED,
        payload: { provider: "payme" },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Xato";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 4) return "****";
  return key.slice(0, 2) + "****" + key.slice(-2);
}
