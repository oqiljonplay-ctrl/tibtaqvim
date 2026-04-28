const API_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export async function fetchServices(clinicId: string, date?: string) {
  const url = new URL(`${API_URL}/api/services`);
  url.searchParams.set("clinicId", clinicId);
  if (date) url.searchParams.set("date", date);

  const res = await fetch(url.toString());
  const json = await res.json();
  return json.success ? json.data : [];
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

export async function fetchTibId(phone: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/api/user/tib?phone=${encodeURIComponent(phone)}`);
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
