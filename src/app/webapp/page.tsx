"use client";
import { useEffect, useRef, useState } from "react";
import { normalizePhone } from "@/lib/utils/phone";
import { UZ_REGIONS, getDistricts } from "@/lib/uz-regions";
import { Calendar } from "@/components/Calendar";
import { Stack } from "@/components/layout";
import { formatDateLabel } from "@/lib/calendar";
import { useClinic } from "@/lib/clinic-context";
import { ClinicSwitcher } from "@/components/webapp/ClinicSwitcher";
import { ClinicLogo } from "@/components/ClinicLogo";
import { BookingFlipCard } from "@/components/webapp/BookingFlipCard";
import { ProfileFlipCard } from "@/components/webapp/ProfileFlipCard";
import { ServicePicker } from "@/components/webapp/ServicePicker";
import { DoctorPicker } from "@/components/webapp/DoctorPicker";

declare global {
  interface Window { Telegram?: { WebApp?: any } }
}

// ─── Types ───────────────────────────────────────────────────────────────────

type AppMode = "loading" | "onboarding" | "dashboard" | "booking";
type BookingStep = "services" | "doctor" | "date" | "slots" | "form" | "confirm" | "done";

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
interface TgUser {
  firstName: string;
  lastName: string | null;
  fatherName: string | null;
  region: string | null;
  district: string | null;
  phone: string | null;
  tibId: string | null;
  hasPhone: boolean;
  onboardingStep: string | null;
}
interface AppointmentDoctor {
  id: string;
  firstName: string;
  lastName: string;
  specialty: string;
  photoUrl: string | null;
  // Flip card profil maydonlari
  education?: string | null;
  position?: string | null;
  department?: string | null;
  workSchedule?: string | null;
  operationsCount?: number;
  bio?: string | null;
  specialties?: { name: string }[];
  directions?: { name: string }[];
  experiences?: { place: string; startYear: number; endYear: number | null }[];
  workplaces?: { place: string }[];
}

interface AppointmentItem {
  id: string;
  clinicId: string;
  date: string;
  status: "booked" | "arrived" | "missed" | "cancelled" | "expired";
  dependentId?: string | null;
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
  const [selfLimit, setSelfLimit] = useState<number | null>(null);
  const [selfActiveCountDB, setSelfActiveCountDB] = useState<number>(0);

  // ── Shared state ──
  const [tgUser, setTgUser] = useState<TgUser | null>(null);
  const [telegramId, setTelegramId] = useState<string | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [headerDate, setHeaderDate] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [bookingTibId, setBookingTibId] = useState<string | null>(null);

  const [doneCountdown, setDoneCountdown] = useState(5);
  const [selectedDoctor, setSelectedDoctor] = useState<ServiceDoctor | null>(null);
  const [showOnboardingHint, setShowOnboardingHint] = useState(false);

  // ── Onboarding state ──
  const [obStep, setObStep] = useState<"welcome" | "contact" | "profile">("welcome");
  // welcome ekran animatsiya holati
  const [obWelcomePhase, setObWelcomePhase] = useState<"typing" | "exit" | "done">("typing");
  const [obWelcomeText, setObWelcomeText] = useState("");
  // contact ekran
  const [obPhoneInput, setObPhoneInput] = useState("");
  const [obPhoneError, setObPhoneError] = useState<string | null>(null);
  const [obShowManual, setObShowManual] = useState(false);
  // profile ekran
  const [obFirstName, setObFirstName] = useState("");
  const [obLastName, setObLastName] = useState("");
  const [obFatherName, setObFatherName] = useState("");
  const [obRegion, setObRegion] = useState("");
  const [obDistrict, setObDistrict] = useState("");
  const [obFieldError, setObFieldError] = useState<string | null>(null);
  // umumiy saving
  const [obSaving, setObSaving] = useState(false);

  const [clinicSchedule, setClinicSchedule] = useState<{ is24Hours: boolean; holidays: string[] }>({ is24Hours: false, holidays: [] });
  const [doctorSchedule, setDoctorSchedule] = useState<{ blockedDates: string[]; blockedWeekdays: number[] }>({ blockedDates: [], blockedWeekdays: [] });

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

      // tgId: SDK → URL tgid param fallback (bot har doim yuboradi)
      let tgId = getTelegramId(tg);
      if (!tgId) {
        const paramTgId = urlParams.get("tgid");
        if (paramTgId) tgId = paramTgId;
      }
      const tgFirstName = getTelegramFirstName(tg);

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
              lastName: null,
              fatherName: null,
              region: null,
              district: null,
              phone: null,
              tibId: regJson.data.tibId ?? null,
              hasPhone: false,
              onboardingStep: null,
            };
            tgUserRef.current = user;
            setTgUser(user);
          }
        }

        // user mavjud bo'lsa → onboardingStep orqali davom
        if (user) {
          const step = user.onboardingStep;
          if (step === "done") {
            setAppMode("dashboard");
            fetchDashboardAppointments(tgId, clinicIdRef.current);
          } else {
            // Resume: qaysi qadamdan davom etish
            if (step === "profile") {
              setObStep("profile");
            } else if (step === "contact") {
              setObStep("contact");
            } else {
              setObStep("welcome"); // null → animatsiyadan boshlash
            }
            // Profil maydonlarini mavjud qiymatlar bilan to'ldirish
            setObFirstName(user.firstName === "Foydalanuvchi" ? (tgFirstName || "") : (user.firstName ?? ""));
            setObLastName(user.lastName ?? "");
            setObFatherName(user.fatherName ?? "");
            setObRegion(user.region ?? "");
            setObDistrict(user.district ?? "");
            setAppMode("onboarding");
          }
        } else {
          setAppMode("booking");
          loadServices(todayStr());
        }

        // Klinika ish rejimi — kalendar bloklash uchun
        if (clinicIdRef.current) {
          fetch(`/api/clinics/${clinicIdRef.current}/schedule`)
            .then((r) => r.json())
            .then((j) => { if (j.success && j.data) setClinicSchedule(j.data); })
            .catch(() => {});
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
    // Klinika almashganda schedule yangilansin
    fetch(`/api/clinics/${contextClinicId}/schedule`)
      .then((r) => r.json())
      .then((j) => { if (j.success && j.data) setClinicSchedule(j.data); })
      .catch(() => {});
  }, [contextClinicId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Welcome typewriter animatsiyasi
  useEffect(() => {
    if (appMode !== "onboarding" || obStep !== "welcome") return;
    const FULL_TEXT = "Xush kelibsiz!";
    let idx = 0;
    setObWelcomeText("");
    setObWelcomePhase("typing");

    const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      // Animatsiyasiz: to'g'ridan ko'rsatib 1s kutib o'tish
      setObWelcomeText(FULL_TEXT);
      const t = setTimeout(() => obAdvanceFromWelcome(), 1000);
      return () => clearTimeout(t);
    }

    const iv = setInterval(() => {
      idx++;
      setObWelcomeText(FULL_TEXT.slice(0, idx));
      if (idx >= FULL_TEXT.length) {
        clearInterval(iv);
        // Oxirgi harfdan keyin 400ms → exit animatsiya
        setTimeout(() => {
          setObWelcomePhase("exit");
          // Exit animatsiyasi 600ms → keyingi ekran
          setTimeout(() => obAdvanceFromWelcome(), 650);
        }, 400);
      }
    }, 90);

    return () => clearInterval(iv);
  }, [appMode, obStep]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const [apptRes, limitRes] = await Promise.all([
        fetch(`/api/webapp/appointments?telegramId=${tgId}&clinicId=${effectiveCId}`),
        fetch(`/api/webapp/booking-limits?clinicId=${effectiveCId}&telegramId=${tgId}`),
      ]);
      const apptJson = await apptRes.json();
      if (apptJson.success) setAppointments(apptJson.data);

      const limitJson = await limitRes.json().catch(() => null);
      if (limitJson?.success && limitJson.data) {
        if (limitJson.data.patientSelfLimit != null) setSelfLimit(limitJson.data.patientSelfLimit);
        if (limitJson.data.selfActiveCount != null) setSelfActiveCountDB(limitJson.data.selfActiveCount);
      }
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
        setAppointments((prev) => {
          const appt = prev.find((a) => a.id === appointmentId);
          // Agar bemor o'zi uchun faol bron bekor bo'lsa, DB count'ni kamayt
          if (appt?.status === "booked" && !appt.dependentId) {
            setSelfActiveCountDB((c) => Math.max(0, c - 1));
          }
          return prev.map((a) => a.id === appointmentId ? { ...a, status: "cancelled" as const } : a);
        });
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

  // ─── Onboarding functions ──────────────────────────────────────────────────

  function completeOnboarding() {
    setAppMode("dashboard");
    if (telegramId) fetchDashboardAppointments(telegramId, clinicIdRef.current);
  }

  async function obSkip() {
    if (telegramId) {
      try {
        await fetch("/api/webapp/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ telegramId, onboardingStep: "done" }),
        });
      } catch {}
    }
    completeOnboarding();
  }

  async function obAdvanceFromWelcome() {
    if (telegramId) {
      try {
        await fetch("/api/webapp/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ telegramId, onboardingStep: "contact" }),
        });
      } catch {}
    }
    setObStep("contact");
  }

  async function obSavePhone(rawPhone: string, tgName?: string) {
    if (!telegramId) return;
    setObSaving(true);
    setObPhoneError(null);
    try {
      let normalized: string;
      try { normalized = normalizePhone(rawPhone); }
      catch { setObPhoneError("Telefon formati noto'g'ri (+998XXXXXXXXX)"); return; }
      const body: Record<string, string> = { telegramId, phone: normalized, onboardingStep: "profile" };
      if (tgName && tgName.length >= 2) body.firstName = tgName;
      const res = await fetch("/api/webapp/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setObPhoneError(data.error ?? "Saqlashda xato"); return; }
      const savedPhone = data.data.phone as string;
      const savedName = data.data.firstName as string;
      setTgUser((prev) => prev
        ? { ...prev, phone: savedPhone, hasPhone: true, firstName: savedName, onboardingStep: "profile" }
        : prev
      );
      if (tgUserRef.current) {
        tgUserRef.current = { ...tgUserRef.current, phone: savedPhone, hasPhone: true, firstName: savedName, onboardingStep: "profile" };
      }
      setForm((f) => ({ ...f, phone: savedPhone, name: f.name || savedName }));
      if (savedName && savedName !== "Foydalanuvchi") {
        setObFirstName(savedName);
      }
      setObStep("profile");
    } catch { setObPhoneError("Tarmoq xatosi"); }
    finally { setObSaving(false); }
  }

  function obRequestContact() {
    const tg = window.Telegram?.WebApp;
    if (typeof tg?.requestContact === "function") {
      tg.requestContact((result: any) => {
        const rawPhone =
          result?.contact?.phone_number ??
          result?.responseUnsafe?.contact?.phone_number ??
          "";
        const tgName = result?.contact?.first_name ?? "";
        if (rawPhone) {
          obSavePhone(rawPhone, tgName || undefined);
        } else {
          setObShowManual(true);
        }
      });
    } else {
      setObShowManual(true);
    }
  }

  async function obSaveProfile() {
    const firstName = obFirstName.trim();
    if (firstName.length < 2) { setObFieldError("Ism kamida 2 harf bo'lishi kerak"); return; }
    if (!telegramId) { completeOnboarding(); return; }
    setObSaving(true);
    setObFieldError(null);
    try {
      const res = await fetch("/api/webapp/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramId,
          firstName,
          lastName: obLastName.trim() || null,
          fatherName: obFatherName.trim() || null,
          region: obRegion || null,
          district: obDistrict || null,
          onboardingStep: "done",
        }),
      });
      const data = await res.json();
      if (!res.ok) { setObFieldError(data.error ?? "Saqlashda xato"); return; }
      const d = data.data;
      setTgUser((prev) => prev ? {
        ...prev,
        firstName: d.firstName,
        lastName: d.lastName ?? null,
        fatherName: d.fatherName ?? null,
        region: d.region ?? null,
        district: d.district ?? null,
        onboardingStep: "done",
      } : prev);
      if (tgUserRef.current) {
        tgUserRef.current = { ...tgUserRef.current, firstName: d.firstName, lastName: d.lastName ?? null };
      }
      setForm((f) => ({ ...f, name: d.firstName }));
    } catch { setObFieldError("Tarmoq xatosi"); return; }
    finally { setObSaving(false); }
    completeOnboarding();
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

  async function fetchDoctorSchedule(doctorId: string) {
    try {
      const r = await fetch(`/api/doctors/${doctorId}/schedule`);
      const j = await r.json();
      if (j.success) setDoctorSchedule(j.data);
      else setDoctorSchedule({ blockedDates: [], blockedWeekdays: [] });
    } catch {
      setDoctorSchedule({ blockedDates: [], blockedWeekdays: [] });
    }
  }

  function selectService(s: Service) {
    setSelectedService(s);
    setSelectedDate("");
    setSelectedSlot("");
    setSelectedDoctor(null);
    setDoctorSchedule({ blockedDates: [], blockedWeekdays: [] });
    if (s.doctors.length === 0) {
      setStep("date");
    } else if (s.doctors.length === 1) {
      setSelectedDoctor(s.doctors[0]);
      fetchDoctorSchedule(s.doctors[0].id);
      setStep("date");
    } else {
      setStep("doctor");
    }
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
      if (selectedDoctor) payload.doctorId = selectedDoctor.id;

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
  const isProfileComplete = !!(
    tgUser?.phone && tgUser?.firstName && tgUser.firstName !== "Foydalanuvchi"
  );

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

  // ─── Render: Onboarding ───────────────────────────────────────────────────

  if (appMode === "onboarding") {
    const obDistricts = getDistricts(obRegion);

    // ── EKRAN 0: Xush kelibsiz (typewriter animatsiya) ────────────────────
    if (obStep === "welcome") {
      return (
        <div className="w-full min-h-[100dvh] bg-gradient-to-br from-blue-600 via-blue-600 to-blue-800 flex items-center justify-center">
          <div
            className="text-center px-6"
            style={{
              transition: obWelcomePhase === "exit" ? "transform 600ms ease-out, opacity 600ms ease-out" : "none",
              transform: obWelcomePhase === "exit" ? "scale(1.8) translateY(-20px)" : "scale(1)",
              opacity: obWelcomePhase === "exit" ? 0 : 1,
            }}
          >
            <div className="text-6xl mb-6">🏥</div>
            <h1
              className="font-bold text-white"
              style={{ fontSize: "clamp(2rem, 8vw, 3.5rem)", lineHeight: 1.2, minHeight: "1.2em" }}
            >
              {obWelcomeText}
              <span
                className="inline-block w-0.5 h-[0.9em] bg-white ml-1 align-middle"
                style={{
                  opacity: obWelcomePhase === "typing" ? 1 : 0,
                  animation: obWelcomePhase === "typing" ? "ob-blink 0.7s step-end infinite" : "none",
                }}
              />
            </h1>
            <p className="text-blue-200 text-sm mt-4">Klinikaga onlayn yozilish platformasi</p>
          </div>
          <style>{`@keyframes ob-blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
        </div>
      );
    }

    // ── EKRAN 1: Kontakt ulashish ─────────────────────────────────────────
    if (obStep === "contact") {
      return (
        <div className="w-full min-h-[100dvh] bg-gray-50 flex flex-col">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white pt-12 pb-10 px-5 text-center">
            <div className="text-5xl mb-3">📱</div>
            <h1 className="text-xl font-bold">Telefon raqamingiz</h1>
            <p className="text-blue-200 text-sm mt-1.5">Bron tasdiqlashlari va eslatmalar uchun</p>
          </div>

          <div className="flex-1 px-5 pt-7 pb-12">
            {!obShowManual ? (
              <div className="space-y-3">
                <button
                  onClick={obRequestContact}
                  disabled={obSaving}
                  className="w-full py-4 rounded-2xl bg-blue-600 text-white font-semibold text-base shadow-lg shadow-blue-200 active:scale-95 transition-all disabled:opacity-60"
                >
                  {obSaving ? "⏳ Tekshirilmoqda..." : "📱 Telegram orqali ulash"}
                </button>
                <button
                  onClick={() => setObShowManual(true)}
                  className="w-full py-3.5 rounded-2xl border-2 border-gray-200 text-gray-600 text-sm font-medium active:scale-95 transition-all"
                >
                  ✏️ Qo&apos;lda kiritish
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => { e.preventDefault(); obSavePhone(obPhoneInput); }}
                className="space-y-3"
              >
                <input
                  type="tel"
                  className="input w-full"
                  placeholder="+998 90 000 00 00"
                  value={obPhoneInput}
                  onChange={(e) => { setObPhoneInput(e.target.value); setObPhoneError(null); }}
                  autoFocus
                />
                {obPhoneError && <p className="text-red-600 text-sm">{obPhoneError}</p>}
                <button
                  type="submit"
                  disabled={obSaving || obPhoneInput.trim().length < 9}
                  className="w-full py-4 rounded-2xl bg-blue-600 text-white font-semibold text-base disabled:opacity-60 active:scale-95 transition-all"
                >
                  {obSaving ? "Saqlanmoqda..." : "Davom etish →"}
                </button>
                <button
                  type="button"
                  onClick={() => { setObShowManual(false); setObPhoneError(null); setObPhoneInput(""); }}
                  className="w-full py-2.5 text-blue-600 text-sm"
                >
                  ← Orqaga
                </button>
              </form>
            )}

            <button onClick={obSkip} className="w-full mt-6 py-3 text-gray-400 text-sm">
              Keyinroq to&apos;ldiraman
            </button>
          </div>
        </div>
      );
    }

    // ── EKRAN 2: Profil ma'lumotlari ─────────────────────────────────────
    return (
      <div className="w-full min-h-[100dvh] bg-gray-50 flex flex-col">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white pt-12 pb-10 px-5 text-center">
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-2xl mx-auto mb-3">✅</div>
          <h1 className="text-xl font-bold">Profil ma&apos;lumotlari</h1>
          <p className="text-blue-200 text-sm mt-1.5">Bron kartochkasida ko&apos;rinadi</p>
        </div>

        <div className="flex-1 px-5 pt-6 pb-12">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Ism <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="input w-full"
                placeholder="Alisher"
                value={obFirstName}
                onChange={(e) => { setObFirstName(e.target.value); setObFieldError(null); }}
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Familiya</label>
              <input
                type="text"
                className="input w-full"
                placeholder="Karimov"
                value={obLastName}
                onChange={(e) => setObLastName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Otasining ismi</label>
              <input
                type="text"
                className="input w-full"
                placeholder="Valijonovich"
                value={obFatherName}
                onChange={(e) => setObFatherName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Viloyat</label>
              <select
                className="input w-full"
                value={obRegion}
                onChange={(e) => { setObRegion(e.target.value); setObDistrict(""); }}
              >
                <option value="">Tanlang...</option>
                {UZ_REGIONS.map((r) => (
                  <option key={r.name} value={r.name}>{r.name}</option>
                ))}
              </select>
            </div>

            {obRegion && obDistricts.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tuman</label>
                <select
                  className="input w-full"
                  value={obDistrict}
                  onChange={(e) => setObDistrict(e.target.value)}
                >
                  <option value="">Tanlang...</option>
                  {obDistricts.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            )}

            {obFieldError && <p className="text-red-600 text-sm">{obFieldError}</p>}

            <button
              onClick={obSaveProfile}
              disabled={obSaving || obFirstName.trim().length < 2}
              className="w-full py-4 rounded-2xl bg-blue-600 text-white font-semibold text-base disabled:opacity-60 active:scale-95 transition-all shadow-lg shadow-blue-200"
            >
              {obSaving ? "Saqlanmoqda..." : "💾 Saqlash va boshlash"}
            </button>
          </div>

          <button onClick={obSkip} className="w-full mt-4 py-3 text-gray-400 text-sm">
            Keyinroq to&apos;ldiraman
          </button>
        </div>
      </div>
    );
  }

  // ─── Render: Dashboard ─────────────────────────────────────────────────────

  if (appMode === "dashboard") {
    const todayAppts = appointments.filter((a) => isToday(a.date));
    const upcomingAppts = appointments.filter((a) => isFuture(a.date) && !isToday(a.date) && a.status === "booked");
    const historyAppts = appointments.filter((a) => !isFuture(a.date) || a.status === "cancelled" || a.status === "arrived" || a.status === "missed" || a.status === "expired");
    // Faol bronlar soni: DBdan kelgan haqiqiy son (take:30 cheklovsiz)
    const selfActiveCount = selfActiveCountDB;
    const limitFull = selfLimit !== null && selfActiveCount >= selfLimit;

    return (
      <div className="w-full min-h-[100dvh] bg-gray-50 flex flex-col">
        {/* Header — ProfileFlipCard */}
        {tgUser && telegramId ? (
          <ProfileFlipCard
            profile={{
              firstName: tgUser.firstName,
              lastName: tgUser.lastName ?? null,
              fatherName: tgUser.fatherName ?? null,
              region: tgUser.region ?? null,
              district: tgUser.district ?? null,
              phone: tgUser.phone,
              tibId: tgUser.tibId,
            }}
            telegramId={telegramId}
            headerDate={headerDate}
            onUpdated={(updated) =>
              setTgUser((prev) => prev ? { ...prev, ...updated } : prev)
            }
          />
        ) : (
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white pt-5 pb-7 px-4">
            <p className="text-blue-200 text-xs mb-0.5">{headerDate}</p>
            <h1 className="font-bold text-xl">Salom! 👋</h1>
          </div>
        )}

        <div className="flex-1 -mt-3 pb-[calc(96px+env(safe-area-inset-bottom))] px-4">
          <Stack gap={4}>

          {/* Clinic switcher */}
          {activeClinic && (
            <div className="mt-3">
              <ClinicSwitcher />
            </div>
          )}

          {/* Faol bron sanagichi */}
          {selfLimit !== null && !dashLoading && (
            <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm ${
              limitFull
                ? "bg-orange-50 border-orange-200 text-orange-800"
                : "bg-white border-gray-200 text-gray-700"
            }`}>
              <span>
                {limitFull ? "⚠️" : "✅"} Faol bronlaringiz:{" "}
                <span className="font-semibold">{selfActiveCount}/{selfLimit}</span>
              </span>
              {limitFull && (
                <span className="text-xs text-orange-600">Limit to'ldi</span>
              )}
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
              <div className="space-y-3">
                {todayAppts.map((a) => (
                  <BookingFlipCard
                    key={a.id}
                    appointment={a}
                    onCancel={cancelAppointment}
                    onRebook={startRebook}
                    cancellingId={cancellingId}
                  />
                ))}
              </div>
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
                  <BookingFlipCard
                    key={a.id}
                    appointment={a}
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
                  <BookingFlipCard
                    key={a.id}
                    appointment={a}
                    onCancel={cancelAppointment}
                    onRebook={startRebook}
                    cancellingId={cancellingId}
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
            <div className="flex-1 relative">
              {!isProfileComplete && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3 z-10">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
                </span>
              )}
              <button
                onClick={() => {
                  if (!isProfileComplete) {
                    setShowOnboardingHint(true);
                    return;
                  }
                  const cId = clinicIdRef.current;
                  if (cId) {
                    window.location.href = `/webapp/clinics/${cId}`;
                  } else {
                    const qs = new URLSearchParams({ mode: "booking" });
                    window.location.href = `/webapp?${qs}`;
                  }
                }}
                className="w-full py-3.5 rounded-2xl bg-blue-600 text-white font-semibold text-sm shadow-lg shadow-blue-200 active:scale-95 transition-all"
              >
                ➕ Yangi bron
              </button>
            </div>
            <button
              onClick={() => {
                const qs = new URLSearchParams();
                if (telegramId) qs.set("tgid", telegramId);
                window.location.href = `/webapp/my-clinics?${qs}`;
              }}
              className="w-12 py-2 rounded-2xl bg-white border border-gray-200 text-gray-700 flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-all"
              title="Klinikalarim"
            >
              <span className="text-xl leading-none">🏥</span>
              <span className="text-[10px] text-gray-500 leading-none">Klinikalar</span>
            </button>
            <button
              onClick={() => {
                const qs = new URLSearchParams({ clinic: clinicIdRef.current });
                if (telegramId) qs.set("tgid", telegramId);
                window.location.href = `/webapp/history?${qs}`;
              }}
              className="w-12 py-2 rounded-2xl bg-white border border-gray-200 text-gray-700 flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-all"
              title="Tarix"
            >
              <span className="text-xl leading-none">📋</span>
              <span className="text-[10px] text-gray-500 leading-none">Tarix</span>
            </button>
          </div>
        </div>
        {/* Onboarding Hint Modal */}
        {showOnboardingHint && (
          <div
            className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center px-4
                       pb-[calc(100px+env(safe-area-inset-bottom))]"
            onClick={() => setShowOnboardingHint(false)}
          >
            <div
              className="bg-white w-full max-w-sm rounded-2xl p-5 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-4">
                <div className="text-3xl mb-2">📋</div>
                <h3 className="font-bold text-gray-900">Bron qilishdan oldin</h3>
                <p className="text-sm text-gray-500 mt-1">Quyidagi qadamlarni bajaring</p>
              </div>
              <div className="space-y-3 mb-5">
                <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100">
                  <span className="text-xl">{tgUser?.phone ? "✅" : "📞"}</span>
                  <div className="flex-1">
                    <div className={`text-sm font-semibold ${tgUser?.phone ? "text-green-700" : "text-gray-900"}`}>
                      Telefon ulash
                    </div>
                    <div className="text-xs text-gray-500">
                      {tgUser?.phone ? tgUser.phone : "Profilingizda telefon ulash tugmasini bosing"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100">
                  <span className="text-xl">
                    {tgUser?.firstName && tgUser.firstName !== "Foydalanuvchi" ? "✅" : "✏️"}
                  </span>
                  <div className="flex-1">
                    <div className={`text-sm font-semibold ${
                      tgUser?.firstName && tgUser.firstName !== "Foydalanuvchi"
                        ? "text-green-700" : "text-gray-900"
                    }`}>
                      Ismingizni kiriting
                    </div>
                    <div className="text-xs text-gray-500">
                      {tgUser?.firstName && tgUser.firstName !== "Foydalanuvchi"
                        ? tgUser.firstName
                        : "✏️ tugmasini bosib profilni to'ldiring"}
                    </div>
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowOnboardingHint(false);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="w-full py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold mb-2 active:scale-95 transition-all"
              >
                Profilga o'tish →
              </button>
              <button
                onClick={() => setShowOnboardingHint(false)}
                className="w-full py-2.5 rounded-xl text-gray-500 text-sm border border-gray-200"
              >
                Keyinroq
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Render: Booking flow ──────────────────────────────────────────────────

  const bookingProgress =
    step === "done" ? 100 :
    step === "confirm" ? 88 :
    step === "form" ? 72 :
    step === "slots" ? 58 :
    step === "date" ? 55 :
    step === "doctor" ? 42 : 28;

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
            <ServicePicker
              services={services}
              loading={bookingLoading}
              onSelect={selectService}
              userLoading={userLoading}
            />
          </div>
        )}

        {/* ── Doctor ── */}
        {step === "doctor" && selectedService && (
          <div>
            <button onClick={() => setStep("services")} className="text-blue-600 text-sm mb-4 flex items-center gap-1">
              ← Orqaga
            </button>
            <div className="bg-blue-50 rounded-xl p-3 mb-4 flex items-center gap-3">
              <span className="text-xl">{typeEmojis[selectedService.type]}</span>
              <div>
                <div className="text-sm font-semibold text-blue-900">{selectedService.name}</div>
                <div className="text-xs text-blue-600">{selectedService.price.toLocaleString()} so&apos;m</div>
              </div>
            </div>
            <DoctorPicker
              doctors={selectedService.doctors}
              onSelect={(doc) => { setSelectedDoctor(doc); fetchDoctorSchedule(doc.id); setStep("date"); }}
            />
          </div>
        )}

        {/* ── Date ── */}
        {step === "date" && (
          <div>
            <button
              onClick={() => setStep(
                selectedService && selectedService.doctors.length > 1 ? "doctor" : "services"
              )}
              className="text-blue-600 text-sm mb-4 flex items-center gap-1"
            >
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
            {/* 1 shifokor avtomatik tanlangan — banner */}
            {selectedDoctor && selectedService?.doctors.length === 1 && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-200 text-blue-700 font-bold flex items-center justify-center text-xs shrink-0">
                  {selectedDoctor.firstName[0]}{selectedDoctor.lastName?.[0] ?? ""}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-blue-500">Shifokor</div>
                  <div className="text-sm font-semibold text-blue-900">
                    {selectedDoctor.firstName} {selectedDoctor.lastName}
                  </div>
                </div>
                <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full shrink-0">
                  ✅ Tanlangan
                </span>
              </div>
            )}
            <h2 className="font-semibold text-gray-900 mb-3">Sanani tanlang</h2>
            <Calendar
              value={selectedDate || null}
              onChange={(date) => selectDate(date)}
              blockedDates={[...clinicSchedule.holidays, ...doctorSchedule.blockedDates]}
              blockedWeekdays={doctorSchedule.blockedWeekdays}
              is24Hours={clinicSchedule.is24Hours}
            />
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
              {selectedDoctor && (
                <SummaryRow label="Shifokor" value={`${selectedDoctor.firstName} ${selectedDoctor.lastName}`} />
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
              {activeClinic?.name && (
                <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                  <span className="text-sm text-gray-500">Klinika</span>
                  <span className="text-sm font-semibold text-gray-900">🏥 {activeClinic.name}</span>
                </div>
              )}
              {bookingTibId && (
                <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                  <span className="text-sm text-gray-500">ID raqam</span>
                  <span className="text-blue-600 font-bold font-mono text-base">🆔 {bookingTibId}</span>
                </div>
              )}
              <SummaryRow label="Xizmat" value={bookingResult.service?.name} />
              {selectedDoctor && (
                <SummaryRow label="Shifokor" value={`${selectedDoctor.firstName} ${selectedDoctor.lastName}`} />
              )}
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

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span className="text-sm font-semibold text-gray-900 text-right">{value}</span>
    </div>
  );
}
