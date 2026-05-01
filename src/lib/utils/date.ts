const TZ = process.env.CLINIC_TIMEZONE || "Asia/Tashkent";

export function getTodayInTZ(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: TZ });
}

export function getDateRange(dateStr: string): { gte: Date; lte: Date } {
  return {
    gte: new Date(dateStr + "T00:00:00.000Z"),
    lte: new Date(dateStr + "T23:59:59.999Z"),
  };
}

export function getTodayRange(): { gte: Date; lte: Date } {
  return getDateRange(getTodayInTZ());
}
