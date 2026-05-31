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
