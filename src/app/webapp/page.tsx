"use client";
import { useEffect, useRef, useState } from "react";
import { Calendar } from "@/components/Calendar";
import { Stack } from "@/components/layout";
import { formatDateLabel } from "@/lib/calendar";
import { useClinic } from "@/lib/clinic-context";
import { ClinicSwitcher } from "@/components/webapp/ClinicSwitcher";
import { ClinicLogo } from "@/components/ClinicLogo";

declare global {
  interface Window { Telegram?: { WebApp?: any } }
}

// ─── Types ───────────────────────────────────────────────────────────────────

type AppMode = "loading" | "dashboard" | "booking";
type BookingStep = "services" | "date" | "slots" | "form" | "confirm" | "done";

interface ServiceDoctor {
  id: string; firstName: string; lastName: string; specialty: string; photoUrl: string | null;
  queueMode?: "live" | "online" | "slot";
}
interface Service {
  id: string; name: string; type: string; price: number;
  requiresSlot: boolean; requiresAddress: boolean; requiresPrePayment: boolean;
  dailyLimit: number | null; todayCount: number; isAvailable: boolean;
  defaultQueueMode?: "live" | "online" | "slot";
  doctors: ServiceDoctor[];
}
interface Slot { id: string; startTime: string; endTime: string; available: boolean }
interface TgUser { firstName: string; phone: string | null; tibId: string | null; hasPhone: boolean }
interface AppointmentDoctor {
  id: string;
  firstName: string;
  lastName: string;
  specialty: string;
  photoUrl: string | null;
}

interface AppointmentItem {
  id: string;
  date: string;
  status: "booked" | "arrived" | "missed" | "cancelled";
  queueNumber: number | null;
  queueMode?: "live" | "online" | "slot" | null;
  paymentStatus?: string | null;
  patientName: string;
  serviceId: string;
  service: { name: string; type: string };
  slot?: { startTime: string; endTime: string } | null;
  doctor?: AppointmentDoctor | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const typeEmojis: Record<string, string> = {
  doctor_queue: "👨‍⚕️", diagnostic: "🔬", home_service: "🏠",
};
const typeLabels: Record<string, string> = {
  doctor_queue: "Shifokor navbati", diagnostic: "Diagnostika", home_service: "Uyga chiqish",
};
const statusLabels: Record<string, string> = {
  booked: "Kutilmoqda", arrived: "Keldi", missed: "Kelmadi", cancelled: "Bekor",
};
const statusStyle: Record<string, string> = {
  booked: "bg-blue-50 text-blue-700 border border-blue-200",
  arrived: "bg-green-50 text-green-700 border border-green-200",
  missed: "bg-red-50 text-red-700 border border-red-200",
  cancelled: "bg-gray-100 text-gray-500 border border-gray-200",
};

// ─── Telegram helpers ─────────────────────────────────────────────────────────

function getTelegramId(tg: any): string | null {
  if (!tg) return null;
  if (tg.initDataUnsafe?.user?.id) return String(tg.initDataUnsafe.user.id);
  if (tg.initData) {
    try {
      const u = JSON.parse(decodeURIComponent(new URLSearchParams(tg.initData).get("user") || ""));
      if (u?.id) return String(u.id);
    } catch {}
  }
  return null;
}

// SDK yuklanishini kutadi — beforeInteractive nested layoutda ishlamasligi mumkin
function waitForTelegramSDK(timeoutMs = 3000): Promise<any> {
  return new Promise((resolve) => {
    if (window.Telegram?.WebApp) return resolve(window.Telegram.WebApp);
    const start = Date.now();
    const interval = setInterval(() => {
      if (window.Telegram?.WebApp) {
        clearInterval(interval);
        resolve(window.Telegram.WebApp);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(interval);
        resolve(null);
      }
    }, 50);
  });
}

function getTelegramFirstName(tg: any): string {
  if (tg?.initDataUnsafe?.user?.first_name) return tg.initDataUnsafe.user.first_name;
  if (tg?.initData) {
    try {
      const u = JSON.parse(decodeURIComponent(new URLSearchParams(tg.initData).get("user") || ""));
      return u?.first_name || "";
    } catch {}
  }
  return "";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("uz-UZ", { day: "numeric", month: "long", year: "numeric" });
}

function todayStr() {
  return new Date().toLocaleDateString("sv-SE");
}

function isToday(iso: string) {
  return new Date(iso).toISOString().split("T")[0] === todayStr();
}

function isFuture(iso: string) {
  return new Date(iso) >= new Date(todayStr() + "T00:00:00.000Z");
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function WebApp() {
  // ── App mode ──
  const [appMode, setAppMode] = useState<AppMode>("loading");

  // ── Booking state ──
  const [step, setStep] = useState<BookingStep>("services");
  const [services, setServices] = useState<Service[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  const [bookingLoading, setBookingLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bookingResult, setBookingResult] = useState<any>(null);

  // ── Dashboard state ──
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [dashLoading, setDashLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // ── Shared state ──
  const [tgUser, setTgUser] = useState<TgUser | null>(null);
  const [telegramId, setTelegramId] = useState<string | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [headerDate, setHeaderDate] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [bookingTibId, setBookingTibId] = useState<string | null>(null);

  const [doneCountdown, setDoneCountdown] = useState(5);

  const tgUserRef = useRef<TgUser | null>(null);
  const rebookServiceIdRef = useRef<string | null>(null);

  const { clinic: activeClinic, clinicId: contextClinicId } = useClinic();
  // clinicId sources: context (localStorage/URL) → URL clinicId param → env fallback
  const clinicIdRef = useRef<string>("");

  // ─── Init ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    // Use clinic context first, then legacy URL param, then env fallback
    clinicIdRef.current =
      contextClinicId ||
      urlParams.get("clinicId") ||
      urlParams.get("clinic") ||
      process.env.NEXT_PUBLIC_CLINIC_ID ||
      "";

    // URL-dan mode o'qiymiz — "dashboard" | "booking" | null
    const urlMode = urlParams.get("mode");

    // Rebook uchun serviceId URL dan
    const urlServiceId = urlParams.get("serviceId");
    if (urlServiceId) rebookServiceIdRef.current = urlServiceId;

    setHeaderDate(new Date().toLocaleDateString("uz-UZ", { day: "numeric", month: "long", year: "numeric" }));

    waitForTelegramSDK().then(async (tg) => {
      if (tg) {
        tg.ready();
        tg.expand();
        tg.setHeaderColor?.("#2563eb");
      }

      // STEP 1 — Telegram context log
      console.log("[WebApp] initDataUnsafe:", tg?.initDataUnsafe);

      // tgId: SDK → URL tgid param fallback (bot har doim yuboradi)
      let tgId = getTelegramId(tg);
      if (!tgId) {
        const paramTgId = urlParams.get("tgid");
        if (paramTgId) tgId = paramTgId;
      }
      const tgFirstName = getTelegramFirstName(tg);

      // STEP 2 — telegramId log
      console.log("[WebApp] telegramId:", tgId);

      setTelegramId(tgId);
      // tgId sessionStorage'da saqlash — boshqa sahifalarda URL/initData yo'q bo'lsa ishlatadi
      if (tgId) {
        try { sessionStorage.setItem("tgid", tgId); } catch {}
      } else {
        // Fallback: sessionStorage'dan o'qish (mode=booking reload da URL'da tgid yo'q)
        try { const s = sessionStorage.getItem("tgid"); if (s) tgId = s; } catch {}
      }
      if (tgFirstName) {
        setForm((f) => ({ ...f, name: f.name || tgFirstName }));
      }

      // mode=booking: xizmatlarni yukla + user ma'lumotini ham ol (form step chiqmasin)
      if (urlMode === "booking") {
        setAppMode("booking");
        if (tgId) {
          try {
            const res = await fetch(`/api/user/by-telegram?telegramId=${tgId}`);
            const json = await res.json();
            if (json.success && json.data) {
              tgUserRef.current = json.data as TgUser;
              setTgUser(json.data as TgUser);
              setForm((f) => ({
                ...f,
                name: (json.data.firstName as string) || f.name,
                phone: f.phone || (json.data.phone as string) || "",
              }));
            }
          } catch {}
        }
        loadServices(todayStr());
        setUserLoading(false);
        return;
      }

      // tgId yo'q va mode=dashboard ham yo'q → booking
      if (!tgId && urlMode !== "dashboard") {
        setAppMode("booking");
        loadServices(todayStr());
        setUserLoading(false);
        return;
      }

      // tgId yo'q lekin mode=dashboard → bo'sh dashboard ko'rsat
      if (!tgId) {
        setAppMode("dashboard");
        setUserLoading(false);
        return;
      }

      try {
        const res = await fetch(`/api/user/by-telegram?telegramId=${tgId}`);
        const json = await res.json();

        let user: TgUser | null = null;

        if (json.success && json.data) {
          user = json.data as TgUser;
          tgUserRef.current = user;
          setTgUser(user);
          setForm((f) => ({ ...f, name: user!.firstName || f.name, phone: f.phone || user!.phone || "" }));
        } else {
          const regRes = await fetch("/api/user/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              telegramId: tgId,
              firstName: tgFirstName || "Foydalanuvchi",
              clinicId: clinicIdRef.current || undefined,
            }),
          });
          const regJson = await regRes.json();
          if (regJson.success) {
            user = {
              firstName: tgFirstName || "Foydalanuvchi",
              phone: null,
              tibId: regJson.data.tibId ?? null,
              hasPhone: false,
            };
            tgUserRef.current = user;
            setTgUser(user);
          }
        }

        // STEP 2 — user log
        console.log("[WebApp] user:", user);
        console.log("[WebApp] user.phone:", user?.phone);

        // user mavjud bo'lsa → har doim dashboard
        if (user) {
          setAppMode("dashboard");
          fetchDashboardAppointments(tgId, clinicIdRef.current);
        } else {
          setAppMode("booking");
          loadServices(todayStr());
        }
      } catch (e) {
        console.log("[WebApp] fetch error:", e);
        setAppMode("booking");
        loadServices(todayStr());
      } finally {
        setUserLoading(false);
      }
    });
  }, []);

  // ─── Klinika almashganda dashboard'ni qayta yuklash ────────────────────────
  const didInitRef = useRef(false);
  useEffect(() => {
    if (!didInitRef.current) { didInitRef.current = true; return; }
    if (!contextClinicId) return;
    clinicIdRef.current = contextClinicId;
    if (appMode === "dashboard" && telegramId) {
      setAppointments([]);
      fetchDashboardAppointments(telegramId, contextClinicId);
    }
    if (appMode === "booking") {
      loadServices(todayStr());
    }
  }, [contextClinicId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Done step: 5 soniyadan keyin Telegram WebApp avtomatik yopish
  useEffect(() => {
    if (step !== "done") return;
    setDoneCountdown(5);
    const iv = setInterval(() => {
      setDoneCountdown((c) => {
        if (c <= 1) {
          clearInterval(iv);
          try { window.Telegram?.WebApp?.close(); } catch {}
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [step]);

  // ─── Dashboard functions ───────────────────────────────────────────────────

  async function fetchDashboardAppointments(tgId: string, cId: string) {
    if (!cId && !process.env.NEXT_PUBLIC_CLINIC_ID) return;
    const effectiveCId = cId || process.env.NEXT_PUBLIC_CLINIC_ID || "";
    setDashLoading(true);
    try {
      const res = await fetch(`/api/webapp/appointments?telegramId=${tgId}&clinicId=${effectiveCId}`);
      const json = await res.json();
      if (json.success) setAppointments(json.data);
    } catch {}
    finally { setDashLoading(false); }
  }

  async function cancelAppointment(appointmentId: string) {
    if (!telegramId || cancellingId) return;
    setCancellingId(appointmentId);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/webapp/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId, telegramId }),
      });
      const json = await res.json();
      if (json.success) {
        setAppointments((prev) =>
          prev.map((a) => a.id === appointmentId ? { ...a, status: "cancelled" as const } : a)
        );
      } else {
        setErrorMsg(json.error?.message ?? "Bekor qilishda xatolik");
      }
    } catch {
      setErrorMsg("Tarmoq xatosi.");
    } finally {
      setCancellingId(null);
    }
  }

  function startRebook(serviceId: string) {
    const qs = new URLSearchParams({ clinic: clinicIdRef.current, mode: "booking", serviceId });
    if (telegramId) qs.set("tgid", telegramId);
    window.location.href = `/webapp?${qs}`;
  }

  function goToDashboard() {
    const qs = new URLSearchParams({ clinic: clinicIdRef.current, mode: "dashboard" });
    window.location.href = `/webapp?${qs}`;
  }

  // ─── Booking functions ─────────────────────────────────────────────────────

  async function loadServices(date: string, autoSelectServiceId?: string) {
    setBookingLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/services?clinicId=${clinicIdRef.current}&date=${date}`);
      const json = await res.json();
      if (json.success) {
        setServices(json.data);
        // Auto-select for rebook
        const targetId = autoSelectServiceId ?? rebookServiceIdRef.current;
        if (targetId) {
          rebookServiceIdRef.current = null;
          const match = json.data.find((s: Service) => s.id === targetId);
          if (match?.isAvailable) {
            selectService(match);
            return;
          }
        }
      } else {
        setErrorMsg(json.error?.message ?? "Xizmatlarni yuklashda xatolik");
      }
    } catch {
      setErrorMsg("Tarmoq xatosi.");
    } finally {
      setBookingLoading(false);
    }
  }

  function selectService(s: Service) {
    setSelectedService(s);
    setSelectedDate("");
    setSelectedSlot("");
    setStep("date");
  }

  async function selectDate(date: string) {
    setSelectedDate(date);
    setErrorMsg(null);
    if (selectedService?.requiresSlot) {
      setBookingLoading(true);
      try {
        const res = await fetch(`/api/slots?serviceId=${selectedService.id}&date=${date}`);
        const json = await res.json();
        if (json.success) {
          const available = json.data.filter((s: Slot) => s.available);
          setSlots(available);
          if (available.length > 0) { setStep("slots"); return; }
        } else {
          setErrorMsg(json.error?.message ?? "Uyachalarni yuklashda xatolik");
        }
      } catch {
        setErrorMsg("Tarmoq xatosi.");
      } finally {
        setBookingLoading(false);
      }
    }
    goAfterDateSlot();
  }

  function selectSlot(slotId: string) {
    setSelectedSlot(slotId);
    goAfterDateSlot();
  }

  function goAfterDateSlot() {
    const user = tgUserRef.current;
    if (user?.hasPhone) {
      // Confirm step form.name/phone ni user ma'lumotidan to'ldirish
      setForm((f) => ({
        ...f,
        name: f.name || user.firstName || "",
        phone: f.phone || user.phone || "",
      }));
      setStep("confirm");
    } else {
      setStep("form");
    }
  }

  function handleFormNext(e: React.FormEvent) {
    e.preventDefault();
    setStep("confirm");
  }

  async function handleBook() {
    if (!selectedService || !selectedDate || submitting) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      let resolvedTibId: string | null = tgUser?.tibId ?? null;

      const regRes = await fetch("/api/user/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: form.phone,
          firstName: form.name,
          ...(telegramId ? { telegramId } : {}),
          ...(clinicIdRef.current ? { clinicId: clinicIdRef.current } : {}),
        }),
      });
      const regJson = await regRes.json();
      if (regJson.success) resolvedTibId = regJson.data?.tibId ?? resolvedTibId;

      const payload: Record<string, unknown> = {
        clinicId: clinicIdRef.current,
        serviceId: selectedService.id,
        date: selectedDate,
        patientName: form.name,
        patientPhone: form.phone,
        source: "webapp",
      };
      if (selectedSlot) payload.slotId = selectedSlot;
      if (selectedService.requiresAddress && form.address) payload.address = form.address;

      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (json.success) {
        setBookingResult(json.data);
        setBookingTibId(resolvedTibId);
        setStep("done");
        window.Telegram?.WebApp?.sendData?.(
          JSON.stringify({ success: true, appointmentId: json.data.id })
        );
      } else {
        setErrorMsg(json.error?.message ?? "Xatolik yuz berdi.");
      }
    } catch {
      setErrorMsg("Tarmoq xatosi.");
    } finally {
      setSubmitting(false);
    }
  }

  const displayTibId = tgUser?.tibId ?? bookingTibId;
  const nameIsKnown = (form.name?.length ?? 0) >= 2;

  // ─── Render: Loading ───────────────────────────────────────────────────────

  if (appMode === "loading") {
    return (
      <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">🏥</div>
          <p className="text-gray-400 text-sm animate-pulse">Yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  // ─── Render: Dashboard ─────────────────────────────────────────────────────

  if (appMode === "dashboard") {
    const todayAppts = appointments.filter((a) => isToday(a.date));
    const upcomingAppts = appointments.filter((a) => isFuture(a.date) && !isToday(a.date) && a.status === "booked");
    const historyAppts = appointments.filter((a) => !isFuture(a.date) || a.status === "cancelled" || a.status === "arrived" || a.status === "missed");

    return (
      <div className="w-full min-h-[100dvh] bg-gray-50 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white pt-5 pb-7 px-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-blue-200 text-xs mb-0.5">{headerDate}</p>
              <h1 className="font-bold text-xl">
                Salom, {tgUser?.firstName || "Foydalanuvchi"}! 👋
              </h1>
            </div>
            {displayTibId && (
              <span className="text-xs bg-white/20 backdrop-blur px-3 py-1.5 rounded-full font-mono font-semibold shrink-0 mt-1">
                🆔 {displayTibId}
              </span>
            )}
          </div>
          {tgUser?.phone
            ? <p className="text-blue-200 text-xs mt-2">📞 {tgUser.phone}</p>
            : <p className="text-blue-300 text-xs mt-2 italic">Telefon raqam kiritilmagan</p>
          }
        </div>

        <div className="flex-1 -mt-3 pb-[calc(96px+env(safe-area-inset-bottom))] px-4">
          <Stack gap={4}>

          {/* Clinic switcher */}
          {activeClinic && (
            <div className="mt-3">
              <ClinicSwitcher />
            </div>
          )}

          {/* Error */}
          {errorMsg && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2">
              <span className="text-red-500 shrink-0 mt-0.5">⚠️</span>
              <p className="text-red-700 text-sm flex-1">{errorMsg}</p>
              <button onClick={() => setErrorMsg(null)} className="text-red-400 text-lg leading-none shrink-0">×</button>
            </div>
          )}

          {/* Today's appointment */}
          {dashLoading ? (
            <div className="mt-4 bg-white rounded-2xl shadow-sm border border-gray-100 p-5 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-1/3 mb-3" />
              <div className="h-6 bg-gray-100 rounded w-2/3 mb-2" />
              <div className="h-4 bg-gray-100 rounded w-1/2" />
            </div>
          ) : todayAppts.length > 0 ? (
            <div className="mt-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">📍 Bugungi qabul</p>
              {todayAppts.map((a) => (
                <div key={a.id} className="bg-white rounded-2xl shadow-sm border-2 border-blue-100 p-4 mb-3">
                  {/* Yuqori: emoji + nom + sana */}
                  <div className="flex items-center gap-2.5 mb-3">
                    <span className="text-2xl shrink-0">{typeEmojis[a.service.type] ?? "🏥"}</span>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm leading-tight">{a.service.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDate(a.date)}</p>
                    </div>
                  </div>

                  {/* Navbat raqami — markazda */}
                  {a.queueNumber && (
                    <div className="bg-blue-50 rounded-xl px-4 py-3 text-center mb-4">
                      <p className="text-xs text-blue-500 mb-0.5">Navbat raqami</p>
                      <p className="text-3xl font-bold text-blue-600">#{a.queueNumber}</p>
                    </div>
                  )}
                  {a.slot && (
                    <p className="text-xs text-gray-500 text-center mb-4">
                      🕐 {a.slot.startTime} — {a.slot.endTime}
                    </p>
                  )}

                  {/* Pastki: doctor foto chapda + status & tugmalar o'ngda tag-matag */}
                  <div className="flex items-start gap-4">
                    {/* Chap: shifokor foto 96px */}
                    <div className="shrink-0">
                      {a.doctor?.photoUrl ? (
                        <img
                          src={a.doctor.photoUrl}
                          alt=""
                          className="w-24 h-24 rounded-xl object-cover border border-gray-200"
                        />
                      ) : a.doctor ? (
                        <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                          <span className="text-white text-2xl font-semibold">
                            {a.doctor.firstName[0]}{a.doctor.lastName[0]}
                          </span>
                        </div>
                      ) : (
                        <div className="w-24 h-24 rounded-xl bg-gray-100 flex items-center justify-center">
                          <span className="text-3xl">{typeEmojis[a.service.type] ?? "🏥"}</span>
                        </div>
                      )}
                      {a.doctor && (
                        <div className="mt-1.5 w-24 text-center">
                          <p className="text-xs text-gray-700 font-medium leading-tight truncate">{a.doctor.specialty}</p>
                          <p className="text-xs text-gray-500 leading-tight truncate">{a.doctor.lastName} {a.doctor.firstName}</p>
                        </div>
                      )}
                    </div>

                    {/* O'ng: status + tugmalar (tag-matag) */}
                    <div className="flex-1 flex flex-col gap-2">
                      <span className={`px-3 py-2 rounded-lg text-xs font-medium text-center ${statusStyle[a.status]}`}>
                        {statusLabels[a.status]}
                      </span>
                      <button
                        onClick={() => startRebook(a.serviceId)}
                        className="w-full py-2.5 rounded-xl text-sm font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 active:scale-95 transition-all"
                      >
                        🔁 Qayta bron
                      </button>
                      {a.status === "booked" && (
                        <button
                          onClick={() => cancelAppointment(a.id)}
                          disabled={cancellingId === a.id}
                          className="w-full py-2.5 rounded-xl text-sm font-medium border border-red-200 text-red-600 hover:bg-red-50 active:scale-95 transition-all disabled:opacity-50"
                        >
                          {cancellingId === a.id ? "..." : "❌ Bekor qilish"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-3 bg-white rounded-2xl shadow-sm border border-gray-100 p-5 text-center">
              <div className="text-3xl mb-2">📅</div>
              <p className="text-gray-500 text-sm font-medium">Bugun qabul yo'q</p>
              <p className="text-gray-400 text-xs mt-1">Bot orqali yangi bron qiling</p>
            </div>
          )}

          {/* Upcoming appointments */}
          {upcomingAppts.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">⏰ Yaqinlashayotgan bronlar</p>
              <div className="space-y-2">
                {upcomingAppts.map((a) => (
                  <AppointmentCard
                    key={a.id}
                    appt={a}
                    onCancel={cancelAppointment}
                    onRebook={startRebook}
                    cancellingId={cancellingId}
                  />
                ))}
              </div>
            </div>
          )}

          {/* History */}
          {historyAppts.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">📋 Tarix</p>
              <div className="space-y-2">
                {historyAppts.slice(0, 5).map((a) => (
                  <AppointmentCard
                    key={a.id}
                    appt={a}
                    onCancel={cancelAppointment}
                    onRebook={startRebook}
                    cancellingId={cancellingId}
                    compact
                  />
                ))}
              </div>
            </div>
          )}

          {!dashLoading && appointments.length === 0 && todayAppts.length === 0 && (
            <div className="py-4 text-center">
              <div className="text-4xl mb-2">🏥</div>
              <p className="text-gray-500 text-sm">Hali bronlar yo'q</p>
              <p className="text-gray-400 text-xs mt-1">Bot orqali yangi bron qiling</p>
            </div>
          )}
          </Stack>
        </div>

        {/* Sticky bottom bar */}
        <div className="fixed bottom-0 left-0 right-0 w-full px-4 pb-[calc(20px+env(safe-area-inset-bottom))] pt-3 bg-gray-50 border-t border-gray-100">
          <div className="flex gap-2">
            <button
              onClick={() => {
                const cId = clinicIdRef.current;
                if (cId) {
                  // PatientSelector bor branches booking sahifasiga o'tish
                  window.location.href = `/webapp/clinics/${cId}`;
                } else {
                  const qs = new URLSearchParams({ mode: "booking" });
                  window.location.href = `/webapp?${qs}`;
                }
              }}
              className="flex-1 py-3.5 rounded-2xl bg-blue-600 text-white font-semibold text-base shadow-lg shadow-blue-200 active:scale-95 transition-all"
            >
              ➕ Yangi bron
            </button>
            <button
              onClick={() => {
                const qs = new URLSearchParams({ clinic: clinicIdRef.current });
                if (telegramId) qs.set("tgid", telegramId);
                window.location.href = `/webapp/history?${qs}`;
              }}
              className="w-14 py-3.5 rounded-2xl bg-white border border-gray-200 text-gray-700 text-xl flex items-center justify-center active:scale-95 transition-all"
              title="Tarix"
            >
              📋
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render: Booking flow ──────────────────────────────────────────────────

  const bookingProgress =
    step === "done" ? 100 :
    step === "confirm" ? 85 :
    step === "form" ? 70 :
    step === "slots" ? 55 : 35;

  return (
    <div className="w-full min-h-[100dvh] bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-blue-600 text-white pt-4 pb-6 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Back to dashboard for any Telegram user */}
            {telegramId && step !== "done" && (
              <button
                onClick={goToDashboard}
                className="text-blue-200 hover:text-white text-sm mr-1"
              >
                ←
              </button>
            )}
            <h1 className="font-bold text-lg">🏥 Qabulga yozilish</h1>
          </div>
          {displayTibId && (
            <span className="text-xs bg-blue-500 px-2.5 py-1 rounded-full font-mono font-semibold">
              🆔 {displayTibId}
            </span>
          )}
        </div>
        {headerDate && <p className="text-blue-200 text-xs mt-0.5">{headerDate}</p>}
        {step !== "services" && (
          <div className="mt-3 h-1.5 bg-blue-500 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${bookingProgress}%` }}
            />
          </div>
        )}
      </div>

      <div className="flex-1 pt-4 pb-4 px-4">

        {/* Error */}
        {errorMsg && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2">
            <span className="text-red-500 shrink-0 mt-0.5">⚠️</span>
            <p className="text-red-700 text-sm flex-1">{errorMsg}</p>
            <button onClick={() => setErrorMsg(null)} className="text-red-400 text-lg leading-none shrink-0">×</button>
          </div>
        )}

        {/* ── Services ── */}
        {step === "services" && (
          <div>
            {userLoading && (
              <div className="text-xs text-center text-gray-400 mb-3 animate-pulse">⏳ Tekshirilmoqda...</div>
            )}
            <h2 className="font-semibold text-gray-900 mb-4">Xizmatni tanlang</h2>
            {bookingLoading ? (
              <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Yuklanmoqda...</div>
            ) : (
              <div className="space-y-3">
                {services.map((s) => (
                  <button
                    key={s.id}
                    disabled={!s.isAvailable || userLoading}
                    onClick={() => selectService(s)}
                    className={`w-full text-left rounded-2xl border-2 p-4 transition-all ${
                      s.isAvailable && !userLoading
                        ? "bg-white border-transparent shadow-sm active:scale-95 hover:border-blue-100"
                        : "bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{typeEmojis[s.type] ?? "🏥"}</span>
                        <div>
                          <div className="font-semibold text-gray-900 text-sm">{s.name}</div>
                          <div className="text-xs text-gray-400 mt-0.5">{typeLabels[s.type]}</div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <div className="text-sm font-bold text-blue-600">{s.price.toLocaleString()} so&apos;m</div>
                        {s.requiresPrePayment && (
                          <div className="text-xs mt-0.5 text-orange-600">Oldindan to&apos;lov</div>
                        )}
                        {s.dailyLimit && (
                          <div className={`text-xs mt-0.5 ${s.isAvailable ? "text-green-600" : "text-red-500"}`}>
                            {s.isAvailable ? `${s.dailyLimit - s.todayCount} joy` : "To&apos;ldi"}
                          </div>
                        )}
                      </div>
                    </div>
                    {s.doctors && s.doctors.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-3">
                        {s.doctors.map((doc) => (
                          <div key={doc.id} className="flex items-center gap-2">
                            {doc.photoUrl ? (
                              <img src={doc.photoUrl} alt="" className="w-24 h-24 rounded-full object-cover flex-shrink-0" />
                            ) : (
                              <div className="w-24 h-24 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                <span className="text-blue-600 text-2xl font-bold leading-none">{doc.firstName[0]}</span>
                              </div>
                            )}
                            <span className="text-xs text-gray-500">{doc.specialty} — {doc.lastName} {doc.firstName}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Date ── */}
        {step === "date" && (
          <div>
            <button onClick={() => setStep("services")} className="text-blue-600 text-sm mb-4 flex items-center gap-1">
              ← Orqaga
            </button>
            {selectedService && (
              <div className="bg-blue-50 rounded-xl p-3 mb-3 flex items-center gap-3">
                <span className="text-xl">{typeEmojis[selectedService.type]}</span>
                <div>
                  <div className="text-sm font-semibold text-blue-900">{selectedService.name}</div>
                  <div className="text-xs text-blue-600">{selectedService.price.toLocaleString()} so&apos;m</div>
                </div>
              </div>
            )}
            {selectedService?.defaultQueueMode === "live" && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                <p className="text-xs font-semibold text-amber-800">💵 Kunlik ro&apos;yxatga kirish rejimi</p>
                <p className="text-xs text-amber-700 mt-0.5">Sana tanlaysiz, klinikaga kelganda kassadan jonli navbat olasiz.</p>
              </div>
            )}
            {(selectedService?.defaultQueueMode === "online" || !selectedService?.defaultQueueMode) && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4">
                <p className="text-xs font-semibold text-blue-800">🎫 Onlayn jonli navbat rejimi</p>
                <p className="text-xs text-blue-700 mt-0.5">Navbat raqamingiz beriladi, kabinetga to&apos;g&apos;ridan kelasiz.</p>
              </div>
            )}
            <h2 className="font-semibold text-gray-900 mb-3">Sanani tanlang</h2>
            <Calendar value={selectedDate || null} onChange={(date) => selectDate(date)} />
            {bookingLoading && <div className="text-center text-gray-400 text-sm mt-3">Tekshirilmoqda...</div>}
          </div>
        )}

        {/* ── Slots ── */}
        {step === "slots" && (
          <div>
            <button onClick={() => setStep("date")} className="text-blue-600 text-sm mb-4">← Orqaga</button>
            <h2 className="font-semibold text-gray-900 mb-4">Vaqtni tanlang</h2>
            {slots.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">😔</div>
                <p className="text-gray-500 text-sm">Bu kunda bo'sh uyacha yo'q</p>
                <button onClick={() => setStep("date")} className="btn-primary mt-4 text-sm">Boshqa kun tanlash</button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {slots.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => selectSlot(s.id)}
                    className="p-4 rounded-2xl bg-white border-2 border-transparent shadow-sm text-center hover:border-blue-200 active:scale-95 transition-all"
                  >
                    <div className="text-sm font-bold text-gray-900">{s.startTime}</div>
                    <div className="text-xs text-gray-400">— {s.endTime}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Form ── */}
        {step === "form" && (
          <form onSubmit={handleFormNext}>
            <button
              type="button"
              onClick={() => setStep(selectedService?.requiresSlot ? "slots" : "date")}
              className="text-blue-600 text-sm mb-4"
            >
              ← Orqaga
            </button>

            {nameIsKnown && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 mb-4 text-sm text-blue-700">
                👤 {form.name}
              </div>
            )}

            <h2 className="font-semibold text-gray-900 mb-4">
              {nameIsKnown ? "Telefon raqamingizni kiriting" : "Ma'lumotlaringizni kiriting"}
            </h2>

            <div className="space-y-4">
              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Ism Familya *</label>
                  <input
                    className="input"
                    required
                    minLength={2}
                    maxLength={40}
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Alisher Karimov"
                  />
                </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Telefon *</label>
                <input
                  className="input"
                  required
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+998 90 000 00 00"
                  autoFocus
                />
              </div>
              {selectedService?.requiresAddress && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Manzil * <span className="text-orange-500 text-xs">(uy xizmati uchun)</span>
                  </label>
                  <textarea
                    className="input resize-none"
                    required
                    rows={3}
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="Toshkent sh., Yunusobod t., 5-uy"
                  />
                </div>
              )}
            </div>

            <button type="submit" className="btn-primary w-full mt-6 py-3.5 text-base">
              Davom etish →
            </button>
          </form>
        )}

        {/* ── Confirm ── */}
        {step === "confirm" && (
          <div>
            <button
              onClick={() => setStep(tgUserRef.current?.hasPhone ? (selectedService?.requiresSlot ? "slots" : "date") : "form")}
              className="text-blue-600 text-sm mb-4"
            >
              ← Orqaga
            </button>
            <h2 className="font-semibold text-gray-900 mb-4">Tasdiqlash</h2>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3 mb-5">
              {selectedService && (
                <SummaryRow label="Xizmat" value={`${typeEmojis[selectedService.type]} ${selectedService.name}`} />
              )}
              <SummaryRow label="Narx" value={`${selectedService?.price.toLocaleString()} so'm`} />
              <SummaryRow label="Sana" value={selectedDate ? formatDateLabel(selectedDate) : ""} />
              {selectedSlot && slots.find((s) => s.id === selectedSlot) && (
                <SummaryRow
                  label="Vaqt"
                  value={`${slots.find((s) => s.id === selectedSlot)!.startTime} — ${slots.find((s) => s.id === selectedSlot)!.endTime}`}
                />
              )}
              <div className="border-t border-gray-100 pt-3 space-y-2">
                <SummaryRow label="Ism" value={form.name} />
                <SummaryRow label="Telefon" value={form.phone} />
                {displayTibId && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">ID raqam</span>
                    <span className="font-mono text-sm font-bold text-blue-600">🆔 {displayTibId}</span>
                  </div>
                )}
              </div>
              {selectedService?.requiresAddress && form.address && (
                <SummaryRow label="Manzil" value={form.address} />
              )}
            </div>

            {tgUser?.hasPhone && (
              <div className="bg-green-50 border border-green-100 rounded-xl px-4 py-2.5 mb-4 text-xs text-green-700">
                ✅ Ma'lumotlar botdagi hisobingizdan olindi
              </div>
            )}

            <button
              onClick={handleBook}
              disabled={submitting}
              className="btn-primary w-full py-3.5 text-base"
            >
              {submitting ? "Yuborilmoqda..." : "✅ Qabulga yozilish"}
            </button>
          </div>
        )}

        {/* ── Done ── */}
        {step === "done" && bookingResult && (
          <div className="text-center py-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-4">✅</div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Muvaffaqiyatli!</h2>
            <p className="text-gray-500 text-sm mb-6">Qabulingiz tasdiqlandi</p>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 text-left space-y-3 mb-5">
              {bookingTibId && (
                <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                  <span className="text-sm text-gray-500">ID raqam</span>
                  <span className="text-blue-600 font-bold font-mono text-base">🆔 {bookingTibId}</span>
                </div>
              )}
              <SummaryRow label="Xizmat" value={bookingResult.service?.name} />
              {bookingResult.queueNumber && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Navbat raqami</span>
                  <span className="text-blue-600 font-bold text-lg">#{bookingResult.queueNumber}</span>
                </div>
              )}
              {bookingResult.slot && <SummaryRow label="Vaqt" value={`${bookingResult.slot.startTime} — ${bookingResult.slot.endTime}`} />}
              <SummaryRow label="Sana" value={selectedDate ? formatDateLabel(selectedDate) : selectedDate} />
              <SummaryRow label="Ism" value={bookingResult.patientName} />
              <SummaryRow label="Telefon" value={bookingResult.patientPhone} />
            </div>

            {bookingTibId && (
              <p className="text-xs text-gray-400 mb-2">
                Klinikaga kelganda <span className="font-semibold text-blue-500">{bookingTibId}</span> ni ko'rsating
              </p>
            )}
            <p className="text-xs text-gray-400 mb-4">Klinikaga o'z vaqtida keling 🏥</p>

            {doneCountdown > 0 && (
              <p className="text-xs text-gray-400 mb-3">
                {doneCountdown} soniyadan keyin botga qaytasiz...
              </p>
            )}
            <button
              onClick={() => {
                try { window.Telegram?.WebApp?.close(); } catch {}
                goToDashboard();
              }}
              className="w-full py-3 rounded-2xl bg-blue-600 text-white text-sm font-semibold active:scale-95 transition-all mb-3"
            >
              Hozir botga qaytish
            </button>
            {telegramId && (
              <button
                onClick={goToDashboard}
                className="w-full py-3 rounded-2xl border-2 border-blue-100 text-blue-600 text-sm font-medium hover:bg-blue-50 active:scale-95 transition-all"
              >
                ← Mening bronlarim
              </button>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AppointmentCard({
  appt, onCancel, onRebook, cancellingId, compact = false,
}: {
  appt: AppointmentItem;
  onCancel: (id: string) => void;
  onRebook: (serviceId: string) => void;
  cancellingId: string | null;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-lg shrink-0">{typeEmojis[appt.service.type] ?? "🏥"}</span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{appt.service.name}</p>
            <p className="text-xs text-gray-400">{formatDate(appt.date)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full ${statusStyle[appt.status]}`}>
            {statusLabels[appt.status]}
          </span>
          <button
            onClick={() => onRebook(appt.serviceId)}
            className="text-xs text-blue-600 hover:underline"
          >
            🔁
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
      {/* Yuqori: emoji + nom + sana */}
      <div className="flex items-center gap-2.5 mb-3">
        <span className="text-xl shrink-0">{typeEmojis[appt.service.type] ?? "🏥"}</span>
        <div>
          <p className="font-semibold text-gray-900 text-sm">{appt.service.name}</p>
          <p className="text-xs text-gray-400">{formatDate(appt.date)}</p>
        </div>
      </div>

      {/* Navbat raqami — markazda (online rejim) */}
      {appt.queueNumber && appt.queueMode !== "live" && (
        <div className="bg-blue-50 rounded-xl px-4 py-2.5 text-center mb-3">
          <p className="text-xs text-blue-500 mb-0.5">Navbat raqami</p>
          <p className="text-3xl font-bold text-blue-600">#{appt.queueNumber}</p>
        </div>
      )}

      {/* Live rejim badge */}
      {appt.queueMode === "live" && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-center mb-3">
          <p className="text-xs font-semibold text-amber-800">💵 Kunlik ro&apos;yxatga kirish</p>
          <p className="text-xs text-amber-600 mt-0.5">Klinikada kassadan jonli navbat oling</p>
        </div>
      )}

      {appt.slot && (
        <p className="text-xs text-gray-500 text-center mb-4">🕐 {appt.slot.startTime} — {appt.slot.endTime}</p>
      )}

      {/* Pastki: doctor foto chapda + status & tugmalar o'ngda tag-matag */}
      <div className="flex items-start gap-4">
        {/* Chap: shifokor foto 96px */}
        <div className="shrink-0">
          {appt.doctor?.photoUrl ? (
            <img
              src={appt.doctor.photoUrl}
              alt=""
              className="w-24 h-24 rounded-xl object-cover border border-gray-200"
            />
          ) : appt.doctor ? (
            <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
              <span className="text-white text-2xl font-semibold">
                {appt.doctor.firstName[0]}{appt.doctor.lastName[0]}
              </span>
            </div>
          ) : (
            <div className="w-24 h-24 rounded-xl bg-gray-100 flex items-center justify-center">
              <span className="text-3xl">{typeEmojis[appt.service.type] ?? "🏥"}</span>
            </div>
          )}
          {appt.doctor && (
            <div className="mt-1.5 w-24 text-center">
              <p className="text-xs text-gray-700 font-medium leading-tight truncate">{appt.doctor.specialty}</p>
              <p className="text-xs text-gray-500 leading-tight truncate">{appt.doctor.lastName} {appt.doctor.firstName}</p>
            </div>
          )}
        </div>

        {/* O'ng: status + tugmalar (tag-matag) */}
        <div className="flex-1 flex flex-col gap-2">
          <span className={`px-3 py-2 rounded-lg text-xs font-medium text-center ${statusStyle[appt.status]}`}>
            {statusLabels[appt.status]}
          </span>
          <button
            onClick={() => onRebook(appt.serviceId)}
            className="w-full py-2.5 rounded-xl text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 active:scale-95 transition-all"
          >
            🔁 Qayta bron
          </button>
          {appt.status === "booked" && (
            <button
              onClick={() => onCancel(appt.id)}
              disabled={cancellingId === appt.id}
              className="w-full py-2.5 rounded-xl text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 active:scale-95 transition-all disabled:opacity-50"
            >
              {cancellingId === appt.id ? "..." : "❌ Bekor qilish"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span className="text-sm font-semibold text-gray-900 text-right">{value}</span>
    </div>
  );
}
