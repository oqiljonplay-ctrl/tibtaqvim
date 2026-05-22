import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getStaffInfo,
  buildCaptionPrefix,
  buildFullCaption,
  logRelay,
} from "@/lib/telegram/relay";

export const dynamic = "force-dynamic";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const ALLOWED_ROLES = [
  "super_admin",
  "clinic_admin",
  "branch_admin",
  "doctor",
  "receptionist",
];

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    null;
  const userAgent = req.headers.get("user-agent") || null;

  try {
    const auth = requireAuth(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }
    if (!ALLOWED_ROLES.includes(auth.role)) {
      return NextResponse.json(
        { success: false, error: { message: "Forbidden" } },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { telegramId, message, appointmentId, patientName } = body;

    if (!telegramId || typeof telegramId !== "string") {
      return NextResponse.json(
        { success: false, error: { message: "telegramId required" } },
        { status: 400 }
      );
    }

    const text = String(message || "").trim();
    if (!text || text.length < 1 || text.length > 3000) {
      return NextResponse.json(
        { success: false, error: { message: "Xabar 1-3000 belgi" } },
        { status: 400 }
      );
    }

    const staff = await getStaffInfo(auth.userId);
    if (!staff) {
      return NextResponse.json(
        { success: false, error: { message: "Xodim topilmadi" } },
        { status: 404 }
      );
    }

    const prefix = buildCaptionPrefix(staff);
    const fullText = buildFullCaption(prefix, text);

    const tgRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegramId,
          text: fullText,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      }
    );

    const tgJson = await tgRes.json();

    if (!tgJson.ok) {
      await logRelay({
        appointmentId,
        staffUserId: auth.userId,
        patientTelegramId: telegramId,
        patientName,
        kind: "message",
        caption: text,
        success: false,
        errorMessage: tgJson.description || "Telegram error",
        ip,
        userAgent,
      });

      const userMessage =
        tgJson.error_code === 403
          ? "Bemor botni bloklagan"
          : tgJson.error_code === 400
          ? "Telegram ID noto'g'ri"
          : tgJson.description || "Telegram xatosi";

      return NextResponse.json(
        {
          success: false,
          error: { message: userMessage, code: tgJson.error_code },
        },
        { status: 502 }
      );
    }

    await logRelay({
      appointmentId,
      staffUserId: auth.userId,
      patientTelegramId: telegramId,
      patientName,
      kind: "message",
      caption: text,
      success: true,
      tgMessageId: tgJson.result?.message_id,
      ip,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      data: { messageId: tgJson.result?.message_id },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Server xatosi";
    console.error("[telegram-relay/send-message] error:", err);
    return NextResponse.json(
      { success: false, error: { message: msg } },
      { status: 500 }
    );
  }
}
