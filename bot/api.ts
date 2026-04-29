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
}) {
  const res = await fetch(`${API_URL}/api/book`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, source: "bot" }),
  });
  return res.json();
}

export async function registerPatient(opts: {
  phone: string;
  firstName: string;
  telegramId: number;
  clinicId: string;
}): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/api/user/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts),
    });
    const json = await res.json();
    return json.success ? (json.data?.tibId ?? null) : null;
  } catch {
    return null;
  }
}

export async function fetchSlots(serviceId: string, date: string) {
  const res = await fetch(`${API_URL}/api/slots?serviceId=${serviceId}&date=${date}`);
  const json = await res.json();
  return json.success ? json.data : [];
}

export async function fetchUserByTelegramId(
  telegramId: number
): Promise<{ firstName: string; phone: string; tibId?: string | null } | null> {
  try {
    const res = await fetch(`${API_URL}/api/user/by-telegram?telegramId=${telegramId}`);
    const json = await res.json();
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}
