import { InlineKeyboardButton } from "node-telegram-bot-api";
import {
  generateCalendarMatrix,
  getMonthLabel,
  prevMonth,
  nextMonth,
  WEEKDAY_LABELS,
} from "../../src/lib/calendar";

const TZ = process.env.CLINIC_TIMEZONE || "Asia/Tashkent";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function mkCalendarKeyboard(year: number, month: number): InlineKeyboardButton[][] {
  const matrix = generateCalendarMatrix(year, month, TZ);
  const label = getMonthLabel(year, month);
  const prev = prevMonth(year, month);
  const next = nextMonth(year, month);

  const rows: InlineKeyboardButton[][] = [];

  // Header: ‹  Aprel 2026  ›
  rows.push([
    { text: "‹", callback_data: `cal:month:${prev.year}-${pad(prev.month)}` },
    { text: label, callback_data: "cal:noop" },
    { text: "›", callback_data: `cal:month:${next.year}-${pad(next.month)}` },
  ]);

  // Weekday labels
  rows.push(WEEKDAY_LABELS.map((d) => ({ text: d, callback_data: "cal:noop" })));

  // Day rows
  for (const week of matrix) {
    rows.push(
      week.map((cell) => {
        if (!cell) return { text: " ", callback_data: "cal:noop" };
        if (cell.disabled) return { text: "·", callback_data: "cal:noop" };
        const text = cell.isToday ? `[${cell.day}]` : String(cell.day);
        return { text, callback_data: `cal:day:${cell.dateStr}` };
      })
    );
  }

  return rows;
}

export function currentYearMonth(tz = TZ): { year: number; month: number } {
  const str = new Date().toLocaleDateString("sv-SE", { timeZone: tz });
  const [y, m] = str.split("-");
  return { year: parseInt(y), month: parseInt(m) };
}
