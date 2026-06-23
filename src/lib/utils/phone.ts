export const CIS_RULES: { code: string; len: number; label: string }[] = [
  { code: "+998", len: 9,  label: "O'zbekiston" },
  { code: "+7",   len: 10, label: "Rossiya/Qozog'iston" },
  { code: "+996", len: 9,  label: "Qirg'iziston" },
  { code: "+992", len: 9,  label: "Tojikiston" },
  { code: "+993", len: 8,  label: "Turkmaniston" },
  { code: "+994", len: 9,  label: "Ozarbayjon" },
  { code: "+374", len: 8,  label: "Armaniston" },
  { code: "+375", len: 9,  label: "Belarus" },
  { code: "+373", len: 8,  label: "Moldova" },
  { code: "+380", len: 9,  label: "Ukraina" },
];

/**
 * Kanonik <kod><raqam> qaytaradi yoki noto'g'ri bo'lsa null.
 * Kirish: +998 90 111-11-11, 998901234567, 901234567, 0901234567
 * Harf yoki axlat (masalan "TIBBIYOT") → null qaytaradi.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = String(raw).trim().replace(/[\s\-()]/g, "");
  if (!s) return null;
  // Harf bor bo'lsa — axlat → null
  if (/[a-zA-Z]/.test(s)) return null;
  // 00xxx → +xxx
  if (s.startsWith("00")) s = "+" + s.slice(2);
  // O'zbekiston qisqartmalari (orqaga moslik):
  if (/^998\d{9}$/.test(s)) return "+" + s;
  if (/^0\d{9}$/.test(s)) return "+998" + s.slice(1);
  if (/^9\d{8}$/.test(s)) return "+998" + s;
  // Umumiy MDH tekshiruvi:
  if (s.startsWith("+")) {
    for (const r of CIS_RULES) {
      const re = new RegExp(`^\\${r.code}\\d{${r.len}}$`);
      if (re.test(s)) return s;
    }
  }
  return null;
}

/** Telefon to'liq va kanonik formatdami. */
export function isValidPhone(v: string | null | undefined): boolean {
  return normalizePhone(v) !== null;
}
