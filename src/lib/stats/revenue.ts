// Yagona daromad sharti: paymentStatus='paid' AND paidAt IS NOT NULL
// SUM = SUM(paidAmount) — price fallback yo'q (paidAt bo'lsa paidAmount ham bor)

export const PAID_REVENUE_WHERE = {
  paymentStatus: "paid" as const,
  paidAt: { not: null as null },
};

export function sumPaidAmount(rows: { paidAmount: number | null }[]): number {
  return rows.reduce((s, r) => s + (r.paidAmount ?? 0), 0);
}
