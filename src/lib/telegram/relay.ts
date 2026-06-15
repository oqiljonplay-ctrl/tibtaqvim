import { prisma } from "@/lib/prisma";

interface StaffInfo {
  firstName: string;
  lastName: string | null;
  role: string;
  specialty?: string | null;
  clinicName?: string | null;
}

export function buildCaptionPrefix(staff: StaffInfo): string {
  const fullName = [staff.firstName, staff.lastName].filter(Boolean).join(" ");

  switch (staff.role) {
    case "super_admin":
      return `\u{1F451} Administrator`;
    case "clinic_admin":
    case "branch_admin":
      return `\u{1F3E5} Klinika ${fullName}`;
    case "doctor":
      return staff.specialty
        ? `\u{1F468}‍⚕️ Dr. ${fullName} (${staff.specialty})`
        : `\u{1F468}‍⚕️ Dr. ${fullName}`;
    case "receptionist":
      return `\u{1F4CB} Qabulxona`;
    default:
      return `\u{1F3E5} Xodim`;
  }
}

export function buildFullCaption(prefix: string, text: string | null, clinicName?: string | null): string {
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const body = text ? `\n\n${escape(text)}` : "";
  const footer = clinicName ? `\n\n<i>— ${escape(clinicName)}</i>` : "";
  return `<b>${escape(prefix)}:</b>${body}${footer}`;
}

export async function logRelay(params: {
  appointmentId?: string | null;
  staffUserId: string;
  patientTelegramId: string;
  patientName?: string | null;
  kind: "message" | "photo" | "document";
  fileName?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  caption?: string | null;
  tgMessageId?: number | null;
  success: boolean;
  errorMessage?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}) {
  try {
    await prisma.telegramRelayLog.create({
      data: {
        appointmentId: params.appointmentId || null,
        staffUserId: params.staffUserId,
        patientTelegramId: params.patientTelegramId,
        patientName: params.patientName || null,
        kind: params.kind,
        fileName: params.fileName || null,
        fileSize: params.fileSize || null,
        mimeType: params.mimeType || null,
        caption: params.caption || null,
        tgMessageId: params.tgMessageId || null,
        success: params.success,
        errorMessage: params.errorMessage || null,
        ip: params.ip || null,
        userAgent: params.userAgent || null,
      },
    });
  } catch (err) {
    console.warn("[telegram-relay] audit log failed:", err);
  }
}

export async function getStaffInfo(userId: string): Promise<StaffInfo | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      firstName: true,
      lastName: true,
      role: true,
      doctors: { select: { specialty: true }, take: 1 },
      clinic: { select: { name: true } },
    },
  });

  if (!user) return null;

  return {
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    specialty: user.doctors[0]?.specialty || null,
    clinicName: user.clinic?.name || null,
  };
}
