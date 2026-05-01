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

// Returns { tibId, userId } — both needed: userId for appointment linking, tibId for confirmation message.
export async function registerPatient(opts: {
  phone: string;
  firstName: string;
  telegramId: number;
  clinicId: string;
}): Promise<{ tibId: string | null; userId: string | null }> {
  try {
    const res = await fetch(`${API_URL}/api/user/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts),
    });
    const json = await res.json();
    if (json.success) {
      return { tibId: json.data?.tibId ?? null, userId: json.data?.userId ?? null };
    }
    return { tibId: null, userId: null };
  } catch {
    return { tibId: null, userId: null };
  }
}

export async function fetchSlots(serviceId: string, date: string) {
  const res = await fetch(`${API_URL}/api/slots?serviceId=${serviceId}&date=${date}`);
  const json = await res.json();
  return json.success ? json.data : [];
}

// /start da chaqiriladi — phone yo'q, faqat telegramId + firstName
// Maqsad: user DB'da yaratilsin, WebApp ochilganda topilsin
export async function registerUserAtStart(
  telegramId: number,
  firstName: string
): Promise<void> {
  try {
    await fetch(`${API_URL}/api/user/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telegramId, firstName }),
    });
  } catch {}
}

export async function fetchUserByTelegramId(
  telegramId: number
): Promise<{ firstName: string; phone: string | null; tibId?: string | null; hasPhone: boolean } | null> {
  try {
    const res = await fetch(`${API_URL}/api/user/by-telegram?telegramId=${telegramId}`);
    const json = await res.json();
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}
