/**
 * Barcha telefon raqamlarni yagona formatga keltiradi: +998XXXXXXXXX
 *
 * Qoidalar:
 *  +998901234567  → +998901234567  (to'g'ri)
 *   998901234567  → +998901234567  ('+' qo'shish)
 *    901234567    → +998901234567  (mahalliy 9 raqam)
 *   0901234567    → +998901234567  (boshidagi 0 o'rniga +998)
 */
export function normalizePhone(raw: string): string {
  // Faqat raqamlar va boshidagi '+' ni qoldirish
  const digits = raw.replace(/[\s\-\(\)]/g, "");

  // +998XXXXXXXXX (13 ta belgi) — to'g'ri format
  if (/^\+998\d{9}$/.test(digits)) return digits;

  // 998XXXXXXXXX (12 ta raqam) — '+' qo'shish
  if (/^998\d{9}$/.test(digits)) return "+" + digits;

  // 0XXXXXXXXX (10 ta raqam, 0 bilan boshlanadi) — 0 → +998
  if (/^0\d{9}$/.test(digits)) return "+998" + digits.slice(1);

  // 9XXXXXXXX (9 ta raqam, 9 bilan boshlanadi) — +998 qo'shish
  if (/^9\d{8}$/.test(digits)) return "+998" + digits;

  // Noma'lum format — trimlab qaytarish (validator xatoni ko'rsatadi)
  return digits;
}
