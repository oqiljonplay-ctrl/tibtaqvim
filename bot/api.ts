// HTTP calls: only for booking and services (business logic lives in API routes)
// Direct DB: all user operations — avoids self-referential HTTP timeout issues on Vercel
import { getOrCreateUser } from "@/lib/services/user.service";
import { prisma } from "@/lib/prisma";
import { assignTibId } from "@/lib/services/tib-id.service";

const API_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function fetchServices(
  clinicId: string,
  date?: string
): Promise<{ services: any[]; enableWebapp: boolean }> {
  const url = new URL(`${API_URL}/api/services`);
  url.searchParams.set("clinicId", clinicId);
  if (date) url.searchParams.set("date", date);

  const res = await fetch(url.toString());
  const json = await res.json();
  return {
    services: json.success ? json.data : [],
    enableWebapp: json.enableWebapp ?? true,
  };
}

export async function fetchDoctors(clinicId: string) {
  const res = await fetch(`${API_URL}/api/admin/doctors?clinicId=${clinicId}`);
  const json = await res.json();
  return json.success ? json.data : [];
}

export async function bookAppointment(data: {
  clinicId: string;
  serviceId: string;
  doctorId?: string;
  slotId?: string;
  date: string;
  patientName: string;
  patientPhone: string;
  address?: string;
  userId?: string;
}) {
  const res = await fetch(`${API_URL}/api/book`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, source: "bot" }),
  });
  return res.json();
}

// Direct DB — previously used HTTP which caused silent failures on Vercel.
// getOrCreateUser assigns tibId atomically and links unlinked appointments.
export async function registerPatient(opts: {
  phone: string;
  firstName: string;
  telegramId: number;
  clinicId: string;
}): Promise<{ tibId: string | null; userId: string | null }> {
  try {
    const user = await getOrCreateUser({
      phone: opts.phone,
      firstName: opts.firstName,
      telegramId: String(opts.telegramId),
      clinicId: opts.clinicId,
    });
    return { tibId: user.tibId, userId: user.id };
  } catch {
    return { tibId: null, userId: null };
  }
}

export async function fetchSlots(serviceId: string, date: string) {
  const res = await fetch(`${API_URL}/api/slots?serviceId=${serviceId}&date=${date}`);
  const json = await res.json();
  return json.success ? json.data : [];
}

// Direct DB — registers user at /start, returns tibId for display
export async function registerUserAtStart(
  telegramId: number,
  firstName: string
): Promise<{ tibId: string | null }> {
  try {
    const user = await getOrCreateUser({
      telegramId: String(telegramId),
      firstName,
    });
    return { tibId: user.tibId };
  } catch {
    return { tibId: null };
  }
}

// Direct DB — fast lookup by telegramId, auto-assigns tibId if missing
export async function fetchUserByTelegramId(
  telegramId: number
): Promise<{ firstName: string; phone: string | null; tibId: string | null; hasPhone: boolean } | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { telegramId: String(telegramId) },
      select: { id: true, firstName: true, phone: true, tibId: true },
    });
    if (!user) return null;

    let tibId = user.tibId;
    if (!tibId) {
      tibId = await assignTibId(user.id);
    }

    return {
      firstName: user.firstName,
      phone: user.phone,
      tibId,
      hasPhone: !!user.phone,
    };
  } catch {
    return null;
  }
}
