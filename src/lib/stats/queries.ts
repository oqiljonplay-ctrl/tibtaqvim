import { prisma } from "@/lib/prisma";
import { StatsScope, buildAppointmentsWhere } from "./access";

export interface KpiData {
  todayBookings: number;
  yesterdayBookings: number;
  thisWeekBookings: number;
  lastWeekBookings: number;
  thisMonthBookings: number;
  lastMonthBookings: number;
  thisMonthRevenue: number;
  newPatientsThisMonth: number;
  activePatients: number;
  arrivedCount: number;
  missedCount: number;
  conversionRate: number;
  activeLiveCount: number;
}

function getDateRanges() {
  const now = new Date();

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dayOfWeek = today.getDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - daysFromMonday);

  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(monthStart);

  return { today, yesterday, tomorrow, weekStart, lastWeekStart, monthStart, lastMonthStart, lastMonthEnd };
}

export async function fetchKpi(scope: StatsScope): Promise<KpiData> {
  const baseWhere = buildAppointmentsWhere(scope);
  const r = getDateRanges();

  const [
    todayBookings,
    yesterdayBookings,
    thisWeekBookings,
    lastWeekBookings,
    thisMonthBookings,
    lastMonthBookings,
    revenueAgg,
    newPatients,
    activePatientsResult,
    arrivedCount,
    missedCount,
    activeLiveCount,
  ] = await Promise.all([
    prisma.appointment.count({
      where: { ...baseWhere, date: { gte: r.today, lt: r.tomorrow } },
    }),
    prisma.appointment.count({
      where: { ...baseWhere, date: { gte: r.yesterday, lt: r.today } },
    }),
    prisma.appointment.count({
      where: { ...baseWhere, date: { gte: r.weekStart, lt: r.tomorrow } },
    }),
    prisma.appointment.count({
      where: { ...baseWhere, date: { gte: r.lastWeekStart, lt: r.weekStart } },
    }),
    prisma.appointment.count({
      where: { ...baseWhere, date: { gte: r.monthStart, lt: r.tomorrow } },
    }),
    prisma.appointment.count({
      where: { ...baseWhere, date: { gte: r.lastMonthStart, lt: r.lastMonthEnd } },
    }),
    prisma.appointment.findMany({
      where: { ...baseWhere, date: { gte: r.monthStart, lt: r.tomorrow }, paymentStatus: "paid" },
      select: { paidAmount: true, service: { select: { price: true } } },
    }),
    prisma.user.count({
      where: {
        role: "patient",
        createdAt: { gte: r.monthStart },
        ...(scope.clinicId ? { clinicId: scope.clinicId } : {}),
      },
    }),
    prisma.appointment.findMany({
      where: { ...baseWhere, date: { gte: r.monthStart, lt: r.tomorrow } },
      select: { userId: true },
      distinct: ["userId"],
    }),
    prisma.appointment.count({
      where: { ...baseWhere, date: { gte: r.monthStart, lt: r.tomorrow }, status: "arrived" },
    }),
    prisma.appointment.count({
      where: { ...baseWhere, date: { gte: r.monthStart, lt: r.tomorrow }, status: "missed" },
    }),
    prisma.appointment.count({
      where: { ...baseWhere, liveStatus: "active" },
    }),
  ]);

  const thisMonthRevenue = revenueAgg.reduce(
    (sum, a) => sum + (a.paidAmount != null ? a.paidAmount : Number(a.service?.price ?? 0)),
    0
  );
  const totalCompleted = arrivedCount + missedCount;
  const conversionRate = totalCompleted > 0 ? Math.round((arrivedCount / totalCompleted) * 100) : 0;

  return {
    todayBookings,
    yesterdayBookings,
    thisWeekBookings,
    lastWeekBookings,
    thisMonthBookings,
    lastMonthBookings,
    thisMonthRevenue,
    newPatientsThisMonth: newPatients,
    activePatients: activePatientsResult.length,
    arrivedCount,
    missedCount,
    conversionRate,
    activeLiveCount,
  };
}
