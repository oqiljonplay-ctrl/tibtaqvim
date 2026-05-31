interface BlockCheckSettings {
  is24Hours: boolean;
  holidays: string[];
}

export function isDateBlocked(
  dateStr: string,
  settings: BlockCheckSettings
): { blocked: boolean; reason?: string } {
  if (settings.is24Hours) {
    return { blocked: false };
  }

  // "T12:00:00" — UTC/+5 timezone farqini bartaraf etadi (12 soat — xavfsiz marja)
  const d = new Date(dateStr + "T12:00:00");
  if (d.getDay() === 0) {
    return { blocked: true, reason: "Dam kuni (Yakshanba)" };
  }

  if (settings.holidays.includes(dateStr)) {
    return { blocked: true, reason: "Bayram kuni" };
  }

  return { blocked: false };
}

export async function isDateBlockedForClinic(
  clinicId: string,
  dateStr: string
): Promise<{ blocked: boolean; reason?: string }> {
  const { prisma } = await import("@/lib/prisma");
  const settings = await prisma.clinicSettings.findUnique({
    where: { clinicId },
    select: { is24Hours: true, holidays: true },
  });
  if (!settings) return { blocked: false };

  const holidays = Array.isArray(settings.holidays)
    ? (settings.holidays as string[])
    : [];
  return isDateBlocked(dateStr, { is24Hours: settings.is24Hours, holidays });
}

// Shifokor darajasida blok — klinika tipidan MUSTAQIL (24/7 da ham ishlaydi)
export async function isDateBlockedForDoctor(
  doctorId: string,
  dateStr: string
): Promise<{ blocked: boolean; reason?: string }> {
  const { prisma } = await import("@/lib/prisma");
  const d = new Date(dateStr + "T12:00:00"); // timezone trick — UTC+5 xavfsiz
  const weekday = d.getDay();

  const block = await prisma.doctorBlockedDate.findFirst({
    where: {
      doctorId,
      OR: [
        { type: "recurring", weekday },
        { type: "once", date: dateStr },
      ],
    },
    select: { reason: true, type: true },
  });

  if (!block) return { blocked: false };
  const reason =
    block.reason ??
    (block.type === "recurring" ? "Shifokor bu kuni kelmaydi" : "Shifokor bugun ishlamaydi");
  return { blocked: true, reason };
}

// Klinika + shifokor ikkala qatlam — processBooking uchun
export async function isDateBlockedFull(
  clinicId: string,
  doctorId: string | null | undefined,
  dateStr: string
): Promise<{ blocked: boolean; reason?: string; source?: "clinic" | "doctor" }> {
  const clinicBlock = await isDateBlockedForClinic(clinicId, dateStr);
  if (clinicBlock.blocked) return { ...clinicBlock, source: "clinic" };

  if (doctorId) {
    const docBlock = await isDateBlockedForDoctor(doctorId, dateStr);
    if (docBlock.blocked) return { ...docBlock, source: "doctor" };
  }

  return { blocked: false };
}
