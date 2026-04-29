import { normalizePhone } from "@/lib/utils/phone";

export interface BookingInput {
  clinicId: string;
  serviceId: string;
  doctorId?: string;
  slotId?: string;
  date: string;
  patientName: string;
  patientPhone: string;
  address?: string;
  source?: "bot" | "webapp";
  userId?: string;
}

function sanitizeText(value: string): string {
  // HTML/script injection, null byte va boshqa xavfli belgilarni olib tashlash
  return value.replace(/[<>{}|\\^`\x00-\x1F]/g, "").trim();
}

export function validateBookingInput(data: Partial<BookingInput>): string | null {
  if (!data.clinicId) return "clinicId majburiy";
  if (!data.serviceId) return "serviceId majburiy";
  if (!data.date) return "date majburiy";

  if (!data.patientName) return "patientName majburiy";
  const name = sanitizeText(data.patientName);
  if (name.length < 2) return "patientName kamida 2 harf bo'lishi kerak";
  if (name.length > 100) return "patientName 100 ta belgidan oshmasligi kerak";

  if (!data.patientPhone) return "patientPhone majburiy";
  const phone = normalizePhone(data.patientPhone);
  if (!/^\+998\d{9}$/.test(phone)) return "patientPhone format noto'g'ri (+998XXXXXXXXX)";

  if (data.address !== undefined && data.address !== null) {
    const addr = sanitizeText(data.address);
    if (addr.length > 300) return "address 300 ta belgidan oshmasligi kerak";
  }

  const date = new Date(data.date);
  if (isNaN(date.getTime())) return "date format noto'g'ri (YYYY-MM-DD)";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  if (date < today) return "O'tgan sanaga bron qilib bo'lmaydi";

  return null;
}
