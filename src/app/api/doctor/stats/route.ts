import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireEmVerified } from "@/lib/auth";
import { ok, error, unauthorized, forbidden, notFound, serverError } from "@/lib/api-response";

// GET /api/doctor/stats?clinicId=...  OR  ?combined=true
// revenue UMUMAN yo'q — paidAmount bu endpointda select/sum qilinmaydi
export async function GET(req: NextRequest) {
  try {
    const auth = requireAuth(req);
    if (!auth) return unauthorized();
    if (auth.role !== "doctor") return forbidden();

    if (!(await requireEmVerified(req, auth))) {
      return error({ code: "EM_REQUIRED", message: "EM id tasdiqlanmagan" }, 403);
    }

    const { searchParams } = new URL(req.url);
    const clinicIdParam = searchParams.get("clinicId");
    const combined      = searchParams.get("combined") === "true";

    // Doctor → employeeId. Faol doctor birinchi, aks holda employeeId bo'lgan eng so'nggi yozuv.
    const doctor =
      (await prisma.doctor.findFirst({
        where: { userId: auth.userId, isActive: true },
        select: { id: true, clinicId: true, employeeId: true },
      })) ??
      (await prisma.doctor.findFirst({
        where: { userId: auth.userId, employeeId: { not: null } },
        orderBy: { createdAt: "desc" },
        select: { id: true, clinicId: true, employeeId: true },
      }));
    if (!doctor) return notFound("Shifokor topilmadi");
    if (!doctor.employeeId) return error("EM bog'lanmagan", 404);

    // Employee rating cache
    const employee = await prisma.employee.findUnique({
      where: { id: doctor.employeeId },
      select: {
        compositeRating:     true,
        ratingCount:         true,
        ratingPatientScore:  true,
        ratingReturnRate:    true,
        ratingArrivedRate:   true,
        ratingActivityScore: true,
        ratingLastUpdatedAt: true,
      },
    });

    // All stints for this employee
    const allStintsRaw = await prisma.employmentStint.findMany({
      where: { employeeId: doctor.employeeId, role: "doctor" },
      orderBy: { startDate: "desc" },
      select: { id: true, startDate: true, endDate: true, clinicId: true, role: true },
      distinct: ["clinicId"],
    });

    // Clinics this doctor has worked in
    const clinicIds = [...new Set(allStintsRaw.map((s) => s.clinicId))];
    const clinics = await prisma.clinic.findMany({
      where: { id: { in: clinicIds } },
      select: { id: true, name: true },
    });
    const clinicMap = new Map(clinics.map((c) => [c.id, c.name]));

    // All stints (not just distinct)
    const allStints = await prisma.employmentStint.findMany({
      where: { employeeId: doctor.employeeId, role: "doctor" },
      orderBy: { startDate: "desc" },
      select: { id: true, startDate: true, endDate: true, clinicId: true, role: true },
    });

    // Determine which stints to use
    interface StintPeriod { id: string; startDate: Date; endDate: Date | null; clinicId: string; role: string }
    let selectedStints: StintPeriod[];

    if (combined) {
      selectedStints = allStints;
    } else if (clinicIdParam) {
      selectedStints = allStints.filter((s) => s.clinicId === clinicIdParam);
    } else {
      // Default: current clinic stints
      selectedStints = allStints.filter((s) => s.clinicId === doctor.clinicId);
    }

    if (selectedStints.length === 0) {
      return ok({
        clinics: clinics.map((c) => ({ id: c.id, name: c.name })),
        ratingBreakdown: buildRatingBreakdown(employee),
        totalAppointments: 0,
        uniquePatients: 0,
        returnRate: null,
        statusBreakdown: [],
        workedDays: 0,
        topServices: [],
        newPatients: 0,
        monthlyDynamics: [],
        ratings: { count: 0, avg: null },
      });
    }

    const now = new Date();

    // Collect all doctorIds for this employee (across all clinics in selected stints)
    const stintClinicIds = [...new Set(selectedStints.map((s) => s.clinicId))];
    const doctorRecords = await prisma.doctor.findMany({
      where: { employeeId: doctor.employeeId, clinicId: { in: stintClinicIds } },
      select: { id: true, clinicId: true },
    });

    // Build filter: OR over (doctorId, clinicId, dateRange)
    const dateFilters = [];
    for (const d of doctorRecords) {
      const clinicStints = selectedStints.filter((s) => s.clinicId === d.clinicId);
      for (const s of clinicStints) {
        dateFilters.push({
          doctorId: d.id,
          clinicId: d.clinicId,
          date: { gte: s.startDate, lte: s.endDate ?? now },
        });
      }
    }

    if (dateFilters.length === 0) {
      return ok({
        clinics: clinics.map((c) => ({ id: c.id, name: c.name })),
        ratingBreakdown: buildRatingBreakdown(employee),
        totalAppointments: 0,
        uniquePatients: 0,
        returnRate: null,
        statusBreakdown: [],
        workedDays: 0,
        topServices: [],
        newPatients: 0,
        monthlyDynamics: [],
        ratings: { count: 0, avg: null },
      });
    }

    const apptWhere = dateFilters.length === 1 ? dateFilters[0] : { OR: dateFilters };

    // Fetch appointments — NO paidAmount, NO paymentStatus, NO paidAt
    const appointments = await prisma.appointment.findMany({
      where: apptWhere,
      select: {
        id: true,
        status: true,
        patientPhone: true,
        date: true,
        serviceId: true,
        clinicId: true,
        doctorId: true,
        service: { select: { name: true } },
      },
    });

    // Compute metrics
    const total = appointments.length;
    const uniquePhones = new Set(appointments.map((a) => a.patientPhone));
    const uniquePatients = uniquePhones.size;

    const arrivedByPhone = new Map<string, number>();
    for (const a of appointments) {
      if (a.status === "arrived") {
        arrivedByPhone.set(a.patientPhone, (arrivedByPhone.get(a.patientPhone) ?? 0) + 1);
      }
    }
    const p1 = [...arrivedByPhone.values()].filter((c) => c >= 1).length;
    const p2 = [...arrivedByPhone.values()].filter((c) => c >= 2).length;
    const returnRate = p1 > 0 ? Math.round((p2 / p1) * 1000) / 1000 : null;

    const statusMap = new Map<string, number>();
    for (const a of appointments) {
      statusMap.set(a.status, (statusMap.get(a.status) ?? 0) + 1);
    }
    const statusBreakdown = [...statusMap.entries()]
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);

    const workedDaysSet = new Set(
      appointments
        .filter((a) => a.status === "arrived")
        .map((a) => new Date(a.date).toISOString().slice(0, 10))
    );
    const workedDays = workedDaysSet.size;

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

    const monthAppts = new Map<string, number>();
    for (const a of appointments) {
      const m = new Date(a.date).toISOString().slice(0, 7);
      monthAppts.set(m, (monthAppts.get(m) ?? 0) + 1);
    }

    // Ratings for this employee in selected date ranges
    const ratingDateFilters = selectedStints.map((s) => ({
      createdAt: { gte: s.startDate, lte: s.endDate ?? now },
      clinicId: s.clinicId,
    }));
    const ratingsWhere = {
      employeeId: doctor.employeeId,
      OR: ratingDateFilters,
    };
    const ratingsList = await prisma.doctorRating.findMany({
      where: ratingsWhere,
      select: { stars: true, createdAt: true },
    });

    const ratingCount = ratingsList.length;
    const ratingAvg =
      ratingCount > 0
        ? Math.round((ratingsList.reduce((s, r) => s + Number(r.stars), 0) / ratingCount) * 100) / 100
        : null;

    const monthRatings = new Map<string, { count: number; sum: number }>();
    for (const r of ratingsList) {
      const m = new Date(r.createdAt).toISOString().slice(0, 7);
      const entry = monthRatings.get(m) ?? { count: 0, sum: 0 };
      entry.count++;
      entry.sum += Number(r.stars);
      monthRatings.set(m, entry);
    }

    const allMonths = new Set([...monthAppts.keys(), ...monthRatings.keys()]);
    const monthlyDynamics = [...allMonths]
      .sort()
      .map((month) => {
        const apptCount = monthAppts.get(month) ?? 0;
        const rInfo = monthRatings.get(month);
        return {
          month,
          appointments: apptCount,
          ratingCount: rInfo?.count ?? 0,
          avgStars: rInfo && rInfo.count > 0 ? Math.round((rInfo.sum / rInfo.count) * 100) / 100 : null,
        };
      });

    // newPatients
    const phonesArr = [...uniquePhones];
    let newPatients = 0;
    if (phonesArr.length > 0) {
      for (const dr of doctorRecords) {
        const clinicStints = selectedStints.filter((s) => s.clinicId === dr.clinicId);
        if (clinicStints.length === 0) continue;

        const firstVisits = await prisma.appointment.findMany({
          where: { clinicId: dr.clinicId, patientPhone: { in: phonesArr } },
          orderBy: [{ patientPhone: "asc" }, { date: "asc" }],
          distinct: ["patientPhone"],
          select: { patientPhone: true, date: true, doctorId: true },
        });

        for (const fv of firstVisits) {
          if (fv.doctorId !== dr.id) continue;
          const inRange = clinicStints.some((s) => {
            const end = s.endDate ?? now;
            return fv.date >= s.startDate && fv.date <= end;
          });
          if (inRange) newPatients++;
        }
      }
    }

    return ok({
      clinics: clinics.map((c) => ({ id: c.id, name: c.name, stintCount: allStints.filter((s) => s.clinicId === c.id).length })),
      ratingBreakdown: buildRatingBreakdown(employee),
      totalAppointments: total,
      uniquePatients,
      returnRate,
      statusBreakdown,
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

function buildRatingBreakdown(emp: {
  compositeRating: { toString(): string } | null;
  ratingCount: number;
  ratingPatientScore:  { toString(): string } | null;
  ratingReturnRate:    { toString(): string } | null;
  ratingArrivedRate:   { toString(): string } | null;
  ratingActivityScore: { toString(): string } | null;
  ratingLastUpdatedAt: Date | null;
} | null) {
  if (!emp) return null;
  return {
    compositeRating:     emp.compositeRating     != null ? Number(emp.compositeRating)     : null,
    ratingCount:         emp.ratingCount,
    patientScore:        emp.ratingPatientScore  != null ? Number(emp.ratingPatientScore)  : null,
    returnRate:          emp.ratingReturnRate    != null ? Number(emp.ratingReturnRate)    : null,
    arrivedRate:         emp.ratingArrivedRate   != null ? Number(emp.ratingArrivedRate)   : null,
    activityScore:       emp.ratingActivityScore != null ? Number(emp.ratingActivityScore) : null,
    lastUpdatedAt:       emp.ratingLastUpdatedAt,
  };
}
