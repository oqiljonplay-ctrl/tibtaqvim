// Shared calendar utility — used by both bot and webapp
// No process.env reads — caller passes tz if needed

const DEFAULT_TZ = "Asia/Tashkent";

const UZ_MONTHS = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
];

const UZ_WEEKDAYS_SHORT = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];

const UZ_WEEKDAYS_LONG = [
  "Yakshanba", "Dushanba", "Seshanba", "Chorshanba",
  "Payshanba", "Juma", "Shanba",
];

export { UZ_WEEKDAYS_SHORT as WEEKDAY_LABELS };

export type CalendarDay = {
  dateStr: string;
  day: number;
  disabled: boolean;
  isToday: boolean;
} | null;

export function formatDateISO(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function getMonthLabel(year: number, month: number): string {
  return `${UZ_MONTHS[month - 1]} ${year}`;
}

export function prevMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

export function nextMonth(year: number, month: number): { year: number; month: number } {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

export function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const weekday = UZ_WEEKDAYS_LONG[new Date(y, m - 1, d).getDay()];
  return `${weekday}, ${d} ${UZ_MONTHS[m - 1]}`;
}

export function generateCalendarMatrix(
  year: number,
  month: number,
  tz: string = DEFAULT_TZ
): CalendarDay[][] {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: tz });

  const firstDayDow = new Date(year, month - 1, 1).getDay();
  // Mon=0 ... Sun=6
  const startOffset = firstDayDow === 0 ? 6 : firstDayDow - 1;
  const daysInMonth = new Date(year, month, 0).getDate();

  const cells: CalendarDay[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = formatDateISO(year, month, d);
    cells.push({
      dateStr,
      day: d,
      disabled: dateStr < today,
      isToday: dateStr === today,
    });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const matrix: CalendarDay[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    matrix.push(cells.slice(i, i + 7));
  }
  return matrix;
}
