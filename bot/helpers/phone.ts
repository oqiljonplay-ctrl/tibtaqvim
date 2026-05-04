/**
 * O'zbekiston raqamlarini +998XXXXXXXXX formatga keltiradi
 *
 * Misollar:
 *   "998914434000"      → "+998914434000"
 *   "+998 91 443 40 00" → "+998914434000"
 *   "0914434000"        → "+998914434000"
 *   "914434000"         → "+998914434000"
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;

  let cleaned = phone.replace(/[\s\-()+\.]/g, "");

  if (!/^\d+$/.test(cleaned)) {
    return null;
  }

  if (cleaned.startsWith("998") && cleaned.length === 12) {
    // 998xxxxxxxxx → +998xxxxxxxxx
  } else if (cleaned.length === 9) {
    cleaned = "998" + cleaned;
  } else if (cleaned.length === 10 && cleaned.startsWith("0")) {
    cleaned = "998" + cleaned.slice(1);
  } else if (cleaned.length === 12 && cleaned.startsWith("998")) {
    // already correct
  } else {
    return null;
  }

  if (cleaned.length !== 12) return null;

  return "+" + cleaned;
}

export function isValidUzbekPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return normalized !== null && /^\+998\d{9}$/.test(normalized);
}
