/**
 * Tibtaqvim ichida pul TIYIN da saqlanadi (BigInt).
 * UI'da SO'M ko'rsatiladi.
 * Provider'lar TIYIN da kutadi (Payme va Click ikkalasi ham).
 */

export function sumToTiyin(sum: number | string): bigint {
  const num = typeof sum === "string" ? parseFloat(sum) : sum;
  if (!Number.isFinite(num) || num < 0) {
    throw new Error(`Yaroqsiz so'm qiymati: ${sum}`);
  }
  return BigInt(Math.round(num * 100));
}

export function tiyinToSum(tiyin: bigint | number | string): number {
  const big = typeof tiyin === "bigint" ? tiyin : BigInt(tiyin);
  return Number(big) / 100;
}

export function formatSum(tiyin: bigint | number | string): string {
  const sum = tiyinToSum(tiyin);
  return new Intl.NumberFormat("uz-UZ", {
    style: "currency",
    currency: "UZS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(sum);
}

export function decimalSumToTiyin(
  decimal: { toString(): string } | null | undefined
): bigint | null {
  if (decimal === null || decimal === undefined) return null;
  return sumToTiyin(decimal.toString());
}
