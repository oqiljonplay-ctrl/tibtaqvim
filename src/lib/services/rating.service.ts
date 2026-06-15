import { prisma } from "@/lib/prisma";

// ─── Konstantalar (og'ish taqiqlangan) ───────────────────────────────────────
const BAYES_C = 5;
const RECENCY_DAYS = 90;
const RECENCY_WEIGHT = 2;
const ACTIVITY_DAYS = 30;
const W_PATIENT = 0.55, W_RETURN = 0.20, W_ARRIVED = 0.15, W_ACTIVITY = 0.10;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
void RECENCY_DAYS; void RECENCY_WEIGHT;

export function combineComposite(p: {
  patientScore: number;
  returnRate: number | null;
  arrivedRate: number | null;
  activityScore: number | null;
}): number {
  const parts: { w: number; v: number }[] = [{ w: W_PATIENT, v: p.patientScore }];
  if (p.returnRate !== null) parts.push({ w: W_RETURN, v: p.returnRate * 5 });
  if (p.arrivedRate !== null) parts.push({ w: W_ARRIVED, v: p.arrivedRate * 5 });
  if (p.activityScore !== null) parts.push({ w: W_ACTIVITY, v: p.activityScore * 5 });
  const W = parts.reduce((s, x) => s + x.w, 0);
  const val = parts.reduce((s, x) => s + (x.w / W) * x.v, 0);
  return Math.round(val * 100) / 100;
}

export async function getRatingPrior(): Promise<number> {
  const row = await prisma.globalSetting.findUnique({ where: { key: "ratingPrior" } });
  const v = (row?.value as { value?: number } | null)?.value;
  return typeof v === "number" ? v : 4.5;
}

export async function computePatientScore(
  employeeId: string,
  prior: number
): Promise<{ patientScore: number | null; ratingCount: number }> {
  const rows = await prisma.$queryRaw<{ n_raters: bigint; sum_avg: string | number; rating_count: bigint }[]>`
    WITH per_patient AS (
      SELECT "userId",
             SUM(stars * CASE WHEN "createdAt" >= NOW() - INTERVAL '90 days' THEN 2 ELSE 1 END)
             / SUM(CASE WHEN "createdAt" >= NOW() - INTERVAL '90 days' THEN 2.0 ELSE 1.0 END) AS patient_avg
      FROM doctor_ratings
      WHERE "employeeId" = ${employeeId} AND "userId" IS NOT NULL
      GROUP BY "userId"
    )
    SELECT (SELECT COUNT(*) FROM per_patient)                       AS n_raters,
           (SELECT COALESCE(SUM(patient_avg), 0) FROM per_patient)  AS sum_avg,
           (SELECT COUNT(*) FROM doctor_ratings WHERE "employeeId" = ${employeeId}) AS rating_count
  `;
  const nRaters = Number(rows[0].n_raters);
  const sumAvg = Number(rows[0].sum_avg);
  const ratingCount = Number(rows[0].rating_count);
  const patientScore = ratingCount === 0
    ? null
    : (prior * BAYES_C + sumAvg) / (BAYES_C + nRaters);
  return { patientScore, ratingCount };
}

export async function computeFactors(employeeId: string): Promise<{
  returnRate: number | null;
  arrivedRate: number | null;
  activityScore: number | null;
}> {
  const f = await prisma.$queryRaw<{ return_rate: string | null; arrived_rate: string | null; my_30d: bigint }[]>`
    WITH my_doctors AS (SELECT id FROM doctors WHERE "employeeId" = ${employeeId}),
    appts AS (
      SELECT a.status, a."userId", a.date FROM appointments a
      JOIN my_doctors d ON a."doctorId" = d.id
      WHERE a.status IN ('arrived','missed','cancelled','expired')
    ),
    patient_arrived AS (
      SELECT "userId", COUNT(*) AS c FROM appts
      WHERE status = 'arrived' AND "userId" IS NOT NULL GROUP BY "userId"
    )
    SELECT
      (SELECT COUNT(*) FILTER (WHERE c >= 2)::numeric / NULLIF(COUNT(*)::numeric, 0) FROM patient_arrived) AS return_rate,
      (SELECT COUNT(*) FILTER (WHERE status = 'arrived')::numeric / NULLIF(COUNT(*)::numeric, 0) FROM appts) AS arrived_rate,
      (SELECT COUNT(*) FROM appts WHERE status = 'arrived' AND date >= CURRENT_DATE - INTERVAL '30 days') AS my_30d
  `;
  const mx = await prisma.$queryRaw<{ max_30d: bigint | null }[]>`
    SELECT MAX(cnt) AS max_30d FROM (
      SELECT d."employeeId", COUNT(*) AS cnt FROM appointments a
      JOIN doctors d ON a."doctorId" = d.id
      WHERE a.status = 'arrived' AND a.date >= CURRENT_DATE - INTERVAL '30 days'
        AND d."employeeId" IS NOT NULL
      GROUP BY d."employeeId"
    ) t
  `;
  const returnRate = f[0].return_rate === null ? null : Number(f[0].return_rate);
  const arrivedRate = f[0].arrived_rate === null ? null : Number(f[0].arrived_rate);
  const max30 = Number(mx[0].max_30d ?? 0);
  const activityScore = max30 === 0 ? null : Math.min(Number(f[0].my_30d) / max30, 1);
  return { returnRate, arrivedRate, activityScore };
}

export async function recomputeEmployeeRating(
  employeeId: string,
  opts: { factorsFresh: boolean }
): Promise<void> {
  const prior = await getRatingPrior();
  const { patientScore, ratingCount } = await computePatientScore(employeeId, prior);

  if (ratingCount === 0) {
    // Baho bo'lmasa ham prior (4.5) ko'rsatiladi — NULL emas
    await prisma.employee.update({
      where: { id: employeeId },
      data: {
        compositeRating: prior,
        ratingCount: 0,
        ratingPatientScore: prior,
        ratingReturnRate: null,
        ratingArrivedRate: null,
        ratingActivityScore: null,
        ratingLastUpdatedAt: new Date(),
      },
    });
    return;
  }

  let returnRate: number | null;
  let arrivedRate: number | null;
  let activityScore: number | null;

  if (opts.factorsFresh) {
    const factors = await computeFactors(employeeId);
    returnRate = factors.returnRate;
    arrivedRate = factors.arrivedRate;
    activityScore = factors.activityScore;
  } else {
    const emp = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { ratingReturnRate: true, ratingArrivedRate: true, ratingActivityScore: true },
    });
    returnRate = emp?.ratingReturnRate != null ? Number(emp.ratingReturnRate) : null;
    arrivedRate = emp?.ratingArrivedRate != null ? Number(emp.ratingArrivedRate) : null;
    activityScore = emp?.ratingActivityScore != null ? Number(emp.ratingActivityScore) : null;
  }

  const composite = combineComposite({ patientScore: patientScore!, returnRate, arrivedRate, activityScore });

  await prisma.employee.update({
    where: { id: employeeId },
    data: {
      compositeRating: composite,
      ratingCount,
      ratingPatientScore: patientScore,
      ratingReturnRate: returnRate,
      ratingArrivedRate: arrivedRate,
      ratingActivityScore: activityScore,
      ratingLastUpdatedAt: new Date(),
    },
  });
}

export async function recomputeAllRatings(): Promise<{
  processed: number;
  prior: number;
  priorIsReal: boolean;
}> {
  const stats = await prisma.$queryRaw<{ total: number; avg: string | null }[]>`
    SELECT COUNT(*)::int AS total, AVG(stars)::text AS avg FROM doctor_ratings
  `;
  const total = Number(stats[0].total);
  const currentPriorRow = await prisma.globalSetting.findUnique({ where: { key: "ratingPrior" } });
  const currentPriorVal = currentPriorRow?.value as { value: number; dynamic: boolean; threshold: number; isReal: boolean } | null;
  const threshold = currentPriorVal?.threshold ?? 100;

  let priorIsReal = currentPriorVal?.isReal ?? false;
  let prior = currentPriorVal?.value ?? 4.5;

  if (total > threshold && stats[0].avg != null) {
    const newPrior = Math.round(Number(stats[0].avg) * 100) / 100;
    await prisma.globalSetting.update({
      where: { key: "ratingPrior" },
      data: {
        value: { value: newPrior, dynamic: true, threshold, isReal: true },
        updatedAt: new Date(),
      },
    });
    prior = newPrior;
    priorIsReal = true;
  }

  const employees = await prisma.$queryRaw<{ employeeId: string }[]>`
    SELECT DISTINCT "employeeId" FROM employment_stints WHERE role = 'doctor'
    UNION
    SELECT DISTINCT "employeeId" FROM doctors WHERE "employeeId" IS NOT NULL AND "isActive" = true
  `;

  for (const { employeeId } of employees) {
    await recomputeEmployeeRating(employeeId, { factorsFresh: true });
  }

  return { processed: employees.length, prior, priorIsReal };
}
