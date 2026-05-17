import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// ===================================================================
// TYPES
// ===================================================================

export type ChartRange = 7 | 14 | 30 | 90;

export interface DailyPoint {
  date: string;
  label: string;
  count: number;
}

export interface RevenuePoint {
  date: string;
  label: string;
  revenue: number;
}

export interface BreakdownItem {
  id: string;
  name: string;
  value: number;
  color?: string;
}

export interface HourlyPoint {
  hour: number;
  label: string;
  count: number;
}

export interface ChartsResponse {
  range: ChartRange;
  startDate: string;
  endDate: string;
  daily: DailyPoint[];
  revenue: RevenuePoint[];
  services: BreakdownItem[];
  statuses: BreakdownItem[];
  doctors: BreakdownItem[];
  hours: HourlyPoint[];
}

// ===================================================================
// HELPERS
// ===================================================================

function getDateRange(rangeDays: ChartRange): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);

  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  startDate.setDate(startDate.getDate() - (rangeDays - 1));

  return { startDate, endDate };
}

function toIsoDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function toUzLabel(d: Date): string {
  const months = [
    "yan", "fev", "mar", "apr", "may", "iyn",
    "iyl", "avg", "sen", "okt", "noy", "dek",
  ];
  return `${d.getDate()}-${months[d.getMonth()]}`;
}

function fillDateGaps<T extends { date: string }>(
  data: T[],
  startDate: Date,
  endDate: Date,
  defaultFactory: (date: string, label: string) => T
): T[] {
  const map = new Map(data.map((item) => [item.date, item]));
  const result: T[] = [];

  const current = new Date(startDate);
  while (current <= endDate) {
    const isoDate = toIsoDate(current);
    const label = toUzLabel(current);
    result.push(map.has(isoDate) ? map.get(isoDate)! : defaultFactory(isoDate, label));
    current.setDate(current.getDate() + 1);
  }

  return result;
}

// clinicId null = super_admin (barcha klinikalar) → WHERE filtri yo'q
function clinicSql(clinicId: string | null): Prisma.Sql {
  return clinicId ? Prisma.sql`AND "clinicId" = ${clinicId}` : Prisma.empty;
}

// ===================================================================
// 1. KUNLIK BRONLAR TRENDI (Line chart)
// ===================================================================

export async function getDailyBookings(
  clinicId: string | null,
  range: ChartRange
): Promise<DailyPoint[]> {
  const { startDate, endDate } = getDateRange(range);
  const cf = clinicSql(clinicId);

  const rows = await prisma.$queryRaw<Array<{ date: Date; count: bigint }>>(
    Prisma.sql`
      SELECT
        DATE("createdAt") AS date,
        COUNT(*) AS count
      FROM appointments
      WHERE
        "createdAt" >= ${startDate}
        AND "createdAt" <= ${endDate}
        ${cf}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `
  );

  const raw: DailyPoint[] = rows.map((r) => ({
    date: toIsoDate(new Date(r.date)),
    label: toUzLabel(new Date(r.date)),
    count: Number(r.count),
  }));

  return fillDateGaps(raw, startDate, endDate, (date, label) => ({
    date, label, count: 0,
  }));
}

// ===================================================================
// 2. KUNLIK DAROMAD TRENDI (Area chart) — faqat status='arrived'
// ===================================================================

export async function getDailyRevenue(
  clinicId: string | null,
  range: ChartRange
): Promise<RevenuePoint[]> {
  const { startDate, endDate } = getDateRange(range);
  const cf = clinicId
    ? Prisma.sql`AND a."clinicId" = ${clinicId}`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<Array<{ date: Date; revenue: string | number }>>(
    Prisma.sql`
      SELECT
        DATE(a."createdAt") AS date,
        COALESCE(SUM(s.price), 0) AS revenue
      FROM appointments a
      INNER JOIN services s ON s.id = a."serviceId"
      WHERE
        a."createdAt" >= ${startDate}
        AND a."createdAt" <= ${endDate}
        AND a.status = 'arrived'
        ${cf}
      GROUP BY DATE(a."createdAt")
      ORDER BY date ASC
    `
  );

  const raw: RevenuePoint[] = rows.map((r) => ({
    date: toIsoDate(new Date(r.date)),
    label: toUzLabel(new Date(r.date)),
    revenue: Number(r.revenue),
  }));

  return fillDateGaps(raw, startDate, endDate, (date, label) => ({
    date, label, revenue: 0,
  }));
}

// ===================================================================
// 3. XIZMATLAR BO'YICHA TAQSIMOT (Donut)
// ===================================================================

const SERVICE_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#6366f1",
];

export async function getServicesBreakdown(
  clinicId: string | null,
  range: ChartRange
): Promise<BreakdownItem[]> {
  const { startDate, endDate } = getDateRange(range);
  const cfAppt = clinicId ? Prisma.sql`AND a."clinicId" = ${clinicId}` : Prisma.empty;
  const cfSvc  = clinicId ? Prisma.sql`AND s."clinicId" = ${clinicId}` : Prisma.empty;

  const rows = await prisma.$queryRaw<Array<{ id: string; name: string; count: bigint }>>(
    Prisma.sql`
      SELECT
        s.id,
        s.name,
        COUNT(a.id) AS count
      FROM services s
      LEFT JOIN appointments a
        ON a."serviceId" = s.id
        AND a."createdAt" >= ${startDate}
        AND a."createdAt" <= ${endDate}
        ${cfAppt}
      WHERE s."isActive" = true
        ${cfSvc}
      GROUP BY s.id, s.name
      HAVING COUNT(a.id) > 0
      ORDER BY count DESC
      LIMIT 10
    `
  );

  return rows.map((r, i) => ({
    id: r.id,
    name: r.name,
    value: Number(r.count),
    color: SERVICE_COLORS[i % SERVICE_COLORS.length],
  }));
}

// ===================================================================
// 4. STATUS TAQSIMOTI (Donut)
// ===================================================================

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  booked:    { label: "Kutmoqda",      color: "#f59e0b" },
  arrived:   { label: "Keldi",          color: "#10b981" },
  missed:    { label: "Kelmadi",        color: "#ef4444" },
  cancelled: { label: "Bekor qilindi",  color: "#6b7280" },
};

export async function getStatusBreakdown(
  clinicId: string | null,
  range: ChartRange
): Promise<BreakdownItem[]> {
  const { startDate, endDate } = getDateRange(range);
  const cf = clinicSql(clinicId);

  const rows = await prisma.$queryRaw<Array<{ status: string; count: bigint }>>(
    Prisma.sql`
      SELECT
        status::text AS status,
        COUNT(*) AS count
      FROM appointments
      WHERE
        "createdAt" >= ${startDate}
        AND "createdAt" <= ${endDate}
        ${cf}
      GROUP BY status
      ORDER BY count DESC
    `
  );

  return rows.map((r) => {
    const meta = STATUS_LABELS[r.status] ?? { label: r.status, color: "#9ca3af" };
    return {
      id: r.status,
      name: meta.label,
      value: Number(r.count),
      color: meta.color,
    };
  });
}

// ===================================================================
// 5. SHIFOKORLAR BO'YICHA BRONLAR (Bar)
// ===================================================================

const DOCTOR_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#6366f1",
];

export async function getDoctorsBreakdown(
  clinicId: string | null,
  range: ChartRange
): Promise<BreakdownItem[]> {
  const { startDate, endDate } = getDateRange(range);
  const cfAppt = clinicId ? Prisma.sql`AND a."clinicId" = ${clinicId}` : Prisma.empty;
  const cfDoc  = clinicId ? Prisma.sql`AND d."clinicId" = ${clinicId}` : Prisma.empty;

  const rows = await prisma.$queryRaw<Array<{
    id: string;
    firstName: string;
    lastName: string;
    count: bigint;
  }>>(
    Prisma.sql`
      SELECT
        d.id,
        d."firstName",
        d."lastName",
        COUNT(a.id) AS count
      FROM doctors d
      LEFT JOIN appointments a
        ON a."doctorId" = d.id
        AND a."createdAt" >= ${startDate}
        AND a."createdAt" <= ${endDate}
        ${cfAppt}
      WHERE d."isActive" = true
        ${cfDoc}
      GROUP BY d.id, d."firstName", d."lastName"
      HAVING COUNT(a.id) > 0
      ORDER BY count DESC
      LIMIT 10
    `
  );

  return rows.map((r, i) => ({
    id: r.id,
    name: `${r.lastName} ${r.firstName.charAt(0)}.`,
    value: Number(r.count),
    color: DOCTOR_COLORS[i % DOCTOR_COLORS.length],
  }));
}

// ===================================================================
// 6. SOATLAR BO'YICHA BRONLAR (Bar, 0-23)
// ===================================================================

export async function getHourlyBreakdown(
  clinicId: string | null,
  range: ChartRange
): Promise<HourlyPoint[]> {
  const { startDate, endDate } = getDateRange(range);
  const cf = clinicSql(clinicId);

  const rows = await prisma.$queryRaw<Array<{ hour: number; count: bigint }>>(
    Prisma.sql`
      SELECT
        EXTRACT(HOUR FROM "createdAt" AT TIME ZONE 'Asia/Tashkent')::int AS hour,
        COUNT(*) AS count
      FROM appointments
      WHERE
        "createdAt" >= ${startDate}
        AND "createdAt" <= ${endDate}
        ${cf}
      GROUP BY hour
      ORDER BY hour ASC
    `
  );

  const map = new Map(rows.map((r) => [Number(r.hour), Number(r.count)]));

  return Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    label: `${h.toString().padStart(2, "0")}:00`,
    count: map.get(h) ?? 0,
  }));
}

// ===================================================================
// MASTER FUNCTION — barchasini parallel chaqirish
// ===================================================================

export async function getAllChartsData(
  clinicId: string | null,
  range: ChartRange
): Promise<ChartsResponse> {
  const { startDate, endDate } = getDateRange(range);

  const [daily, revenue, services, statuses, doctors, hours] = await Promise.all([
    getDailyBookings(clinicId, range),
    getDailyRevenue(clinicId, range),
    getServicesBreakdown(clinicId, range),
    getStatusBreakdown(clinicId, range),
    getDoctorsBreakdown(clinicId, range),
    getHourlyBreakdown(clinicId, range),
  ]);

  return {
    range,
    startDate: toIsoDate(startDate),
    endDate: toIsoDate(endDate),
    daily,
    revenue,
    services,
    statuses,
    doctors,
    hours,
  };
}
