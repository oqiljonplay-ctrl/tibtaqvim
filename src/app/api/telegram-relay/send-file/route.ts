import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getStaffInfo,
  buildCaptionPrefix,
  buildFullCaption,
  logRelay,
} from "@/lib/telegram/relay";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const ALLOWED_ROLES = [
  "super_admin",
  "clinic_admin",
  "branch_admin",
  "doctor",
  "receptionist",
];

const ALLOWED_MIME = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

const MAX_PHOTO_SIZE = 10 * 1024 * 1024;
const MAX_DOC_SIZE = 20 * 1024 * 1024;

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

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const telegramId = formData.get("telegramId") as string | null;
    const caption = (formData.get("caption") as string | null)?.trim() || null;
    const appointmentId = formData.get("appointmentId") as string | null;
    // DB dan haqiqiy ism (markaziy manba)
    let patientName: string | null = formData.get("patientName") as string | null;
    if (telegramId) {
      const patientUser = await prisma.user.findUnique({
        where: { telegramId },
        select: { firstName: true, lastName: true, fatherName: true },
      });
      if (patientUser) {
        patientName = [patientUser.firstName, patientUser.lastName, patientUser.fatherName].filter(Boolean).join(" ");
      }
    }

    if (!file) {
      return NextResponse.json(
        { success: false, error: { message: "Fayl topilmadi" } },
        { status: 400 }
      );
    }
    if (!telegramId) {
      return NextResponse.json(
        { success: false, error: { message: "telegramId required" } },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: `Format qo'llab-quvvatlanmaydi: ${file.type}`,
          },
        },
        { status: 400 }
      );
    }

    const isImage = file.type.startsWith("image/");
    const maxSize = isImage ? MAX_PHOTO_SIZE : MAX_DOC_SIZE;

    if (file.size > maxSize) {
      const limitMB = (maxSize / (1024 * 1024)).toFixed(0);
      return NextResponse.json(
        {
          success: false,
          error: {
            message: `Fayl ${limitMB} MB dan oshmasin (sizniki ${(
              file.size /
              (1024 * 1024)
            ).toFixed(1)} MB)`,
          },
        },
        { status: 400 }
      );
    }

    if (caption && caption.length > 1024) {
      return NextResponse.json(
        {
          success: false,
          error: { message: "Izoh 1024 belgi (Telegram cheklov)" },
        },
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
    const fullCaption = buildFullCaption(prefix, caption, staff.clinicName);

    const tgFormData = new FormData();
    tgFormData.append("chat_id", telegramId);
    tgFormData.append("caption", fullCaption);
    tgFormData.append("parse_mode", "HTML");

    const fieldName = isImage ? "photo" : "document";
    const endpoint = isImage ? "sendPhoto" : "sendDocument";

    tgFormData.append(fieldName, file, file.name || `file_${Date.now()}`);

    const tgRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/${endpoint}`,
      { method: "POST", body: tgFormData }
    );

    const tgJson = await tgRes.json();

    if (!tgJson.ok) {
      await logRelay({
        appointmentId,
        staffUserId: auth.userId,
        patientTelegramId: telegramId,
        patientName,
        kind: isImage ? "photo" : "document",
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        caption,
        success: false,
        errorMessage: tgJson.description,
        ip,
        userAgent,
      });

      const userMessage =
        tgJson.error_code === 403
          ? "Bemor botni bloklagan"
          : tgJson.error_code === 400
          ? "So'rov xato"
          : tgJson.description || "Telegram xatosi";

      return NextResponse.json(
        { success: false, error: { message: userMessage } },
        { status: 502 }
      );
    }

    await logRelay({
      appointmentId,
      staffUserId: auth.userId,
      patientTelegramId: telegramId,
      patientName,
      kind: isImage ? "photo" : "document",
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      caption,
      success: true,
      tgMessageId: tgJson.result?.message_id,
      ip,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      data: {
        messageId: tgJson.result?.message_id,
        fileSize: file.size,
        fileName: file.name,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Server xatosi";
    console.error("[telegram-relay/send-file] error:", err);
    return NextResponse.json(
      { success: false, error: { message: msg } },
      { status: 500 }
    );
  }
}
