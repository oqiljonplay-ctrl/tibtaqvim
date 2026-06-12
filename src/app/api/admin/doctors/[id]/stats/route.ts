import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound, serverError } from "@/lib/api-response";

type Params = { params: Promise<{ id: string }> };

interface StintPeriod {
  id: string;
  startDate: Date;
  endDate: Date | null;
  role: string;
}

// GET /api/admin/doctors/[id]/stats?stintId=...  OR  ?combined=true
export async function GET(req: NextRequest, { params }: Params) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (!["clinic_admin", "branch_admin", "super_admin"].includes(auth.role)) return forbidden();

    const { id: doctorId } = await params;
    const { searchParams } = new URL(req.url);
    const combined = searchParams.get("combined") === "true";
    const stintId = searchParams.get("stintId");

    // 1. doctor → employeeId
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
      select: { id: true, clinicId: true, employeeId: true, firstName: true, lastName: true },
    });
    if (!doctor) return notFound("Shifokor topilmadi");
    if (auth.role !== "super_admin" && doctor.clinicId !== auth.clinicId) return forbidden();
    if (!doctor.employeeId) return error("EM bog'lanmagan", 404);

    const clinicId = doctor.clinicId;

    // 2. Stintlar (faqat shu klinikadagi doctor stintlari)
    const allStints = await prisma.employmentStint.findMany({
      where: { employeeId: doctor.employeeId, clinicId, role: "doctor" },
      orderBy: { startDate: "desc" },
      select: { id: true, startDate: true, endDate: true, role: true },
    });

    // 3. Davr tanlash
    let selectedStints: StintPeriod[];
    if (combined) {
      selectedStints = allStints;
    } else if (stintId) {
      const found = allStints.find((s) => s.id === stintId);
      if (!found) return error("Stint topilmadi", 404);
      selectedStints = [found];
    } else {
      selectedStints = allStints.length > 0 ? [allStints[0]] : [];
    }

    if (selectedStints.length === 0) {
      return ok({
        stints: allStints,
        totalAppointments: 0,
        uniquePatients: 0,
        returnRate: null,
        statusBreakdown: [],
        revenue: 0,
        workedDays: 0,
        topServices: [],
        newPatients: 0,
        monthlyDynamics: [],
        ratings: { count: 0, avg: null },
      });
    }

    const now = new Date();

    // 4. Appointment base filter
    const dateFilter = selectedStints.map((s) => ({
      date: { gte: s.startDate, lte: s.endDate ?? now },
    }));
    const apptWhere = {
      doctorId: doctor.id,
      clinicId,
      ...(dateFilter.length === 1 ? dateFilter[0] : { OR: dateFilter }),
    };

    // 5. Fetch appointments (all fields needed for JS computation)
    const appointments = await prisma.appointment.findMany({
      where: apptWhere,
      select: {
        id: true,
        status: true,
        patientPhone: true,
        date: true,
        paymentStatus: true,
        paidAmount: true,
        paidAt: true,
        serviceId: true,
        service: { select: { name: true } },
      },
    });

    // --- Compute metrics in JS ---

    const total = appointments.length;

    const uniquePhones = new Set(appointments.map((a) => a.patientPhone));
    const uniquePatients = uniquePhones.size;

    // returnRate: arrived by patientPhone
    const arrivedByPhone = new Map<string, number>();
    for (const a of appointments) {
      if (a.status === "arrived") {
        arrivedByPhone.set(a.patientPhone, (arrivedByPhone.get(a.patientPhone) ?? 0) + 1);
      }
    }
    const phonesWith1 = [...arrivedByPhone.values()].filter((c) => c >= 1).length;
    const phonesWith2 = [...arrivedByPhone.values()].filter((c) => c >= 2).length;
    const returnRate = phonesWith1 > 0 ? Math.round((phonesWith2 / phonesWith1) * 1000) / 1000 : null;

    // statusBreakdown
    const statusMap = new Map<string, number>();
    for (const a of appointments) {
      statusMap.set(a.status, (statusMap.get(a.status) ?? 0) + 1);
    }
    const statusBreakdown = [...statusMap.entries()]
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);

    // revenue: paidAmount where paymentStatus='paid' AND paidAt NOT NULL
    const revenue = appointments
      .filter((a) => a.paymentStatus === "paid" && a.paidAt !== null)
      .reduce((sum, a) => sum + (a.paidAmount ?? 0), 0);

    // workedDays: distinct dates with arrived
    const workedDatesSet = new Set(
      appointments
        .filter((a) => a.status === "arrived")
        .map((a) => new Date(a.date).toISOString().slice(0, 10))
    );
    const workedDays = workedDatesSet.size;

    // topServices
    const serviceMap = new Map<string, { name: string; count: number }>();
    for (const a of appointments) {
      if (a.serviceId && a.service) {
        const entry = serviceMap.get(a.serviceId) ?? { name: a.service.name, count: 0 };
        entry.count++;
        serviceMap.set(a.serviceId, entry);
      }
    }
    const topServices = [...serviceMap.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // monthlyDynamics: group appointments by YYYY-MM
    const monthAppts = new Map<string, number>();
    for (const a of appointments) {
      const m = new Date(a.date).toISOString().slice(0, 7);
      monthAppts.set(m, (monthAppts.get(m) ?? 0) + 1);
    }

    // Ratings for this employee in this clinic within selected date ranges
    const ratingDateFilter = selectedStints.map((s) => ({
      createdAt: { gte: s.startDate, lte: s.endDate ?? now },
    }));
    const ratingsWhere = {
      employeeId: doctor.employeeId,
      clinicId,
      ...(ratingDateFilter.length === 1 ? ratingDateFilter[0] : { OR: ratingDateFilter }),
    };

    const ratingsList = await prisma.doctorRating.findMany({
      where: ratingsWhere,
      select: { stars: true, createdAt: true },
    });

    const ratingCount = ratingsList.length;
    const ratingAvg =
      ratingCount > 0
        ? Math.round(
            (ratingsList.reduce((s, r) => s + Number(r.stars), 0) / ratingCount) * 100
          ) / 100
        : null;

    // Merge monthly ratings
    const monthRatings = new Map<string, { count: number; sum: number }>();
    for (const r of ratingsList) {
      const m = new Date(r.createdAt).toISOString().slice(0, 7);
      const entry = monthRatings.get(m) ?? { count: 0, sum: 0 };
      entry.count++;
      entry.sum += Number(r.stars);
      monthRatings.set(m, entry);
    }

    // Build monthly dynamics (union of months from appts + ratings)
    const allMonths = new Set([...monthAppts.keys(), ...monthRatings.keys()]);
    const monthlyDynamics = [...allMonths]
      .sort()
      .map((month) => {
        const apptCount = monthAppts.get(month) ?? 0;
        const rInfo = monthRatings.get(month);
        const avgStars = rInfo && rInfo.count > 0 ? Math.round((rInfo.sum / rInfo.count) * 100) / 100 : null;
        return { month, appointments: apptCount, ratingCount: rInfo?.count ?? 0, avgStars };
      });

    // newPatients: patientPhones whose first-ever appointment in clinic falls in our date range with this doctor
    const phonesArr = [...uniquePhones];
    let newPatients = 0;
    if (phonesArr.length > 0) {
      // Fetch first appointment per phone in this clinic (across all time)
      const firstVisits = await prisma.appointment.findMany({
        where: { clinicId, patientPhone: { in: phonesArr } },
        orderBy: [{ patientPhone: "asc" }, { date: "asc" }],
        distinct: ["patientPhone"],
        select: { patientPhone: true, date: true, doctorId: true },
      });

      for (const fv of firstVisits) {
        if (fv.doctorId !== doctor.id) continue;
        // Check if fv.date falls in any selected stint
        const inRange = selectedStints.some((s) => {
          const end = s.endDate ?? now;
          return fv.date >= s.startDate && fv.date <= end;
        });
        if (inRange) newPatients++;
      }
    }

    return ok({
      stints: allStints.map((s) => ({
        id: s.id,
        startDate: s.startDate,
        endDate: s.endDate,
        role: s.role,
      })),
      totalAppointments: total,
      uniquePatients,
      returnRate,
      statusBreakdown,
      revenue,
      workedDays,
      topServices,
      newPatients,
      monthlyDynamics,
      ratings: { count: ratingCount, avg: ratingAvg },
    });
  } catch {
    return serverError();
  }
}
