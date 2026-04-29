"use client";
import { useEffect, useState } from "react";
import { Calendar } from "@/components/Calendar";
import { formatDateLabel } from "@/lib/calendar";

declare global {
  interface Window { Telegram?: { WebApp?: any } }
}

interface Service {
  id: string; name: string; type: string; price: number;
  requiresSlot: boolean; requiresAddress: boolean;
  dailyLimit: number | null; todayCount: number; isAvailable: boolean;
}
interface Slot { id: string; startTime: string; endTime: string; available: boolean }
interface TgUser { firstName: string; phone: string; tibId: string | null }

type Step = "services" | "date" | "slots" | "form" | "done";

const typeEmojis: Record<string, string> = { doctor_queue: "👨‍⚕️", diagnostic: "🔬", home_service: "🏠" };
const typeLabels: Record<string, string> = { doctor_queue: "Shifokor navbati", diagnostic: "Diagnostika", home_service: "Uyga chiqish" };

export default function WebApp() {
  const [step, setStep] = useState<Step>("services");
  const [services, setServices] = useState<Service[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [tgUser, setTgUser] = useState<TgUser | null>(null);
  const [bookingTibId, setBookingTibId] = useState<string | null>(null);

  const clinicId =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("clinicId") ||
        process.env.NEXT_PUBLIC_CLINIC_ID || ""
      : "";

  const today = new Date();

  // WebApp init: Telegram user resolve → pre-fill form
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
    }

    const telegramId = tg?.initDataUnsafe?.user?.id;
    if (telegramId) {
      fetch(`/api/user/by-telegram?telegramId=${telegramId}`)
        .then((r) => r.json())
        .then((json) => {
          if (json.success && json.data) {
            const u: TgUser = json.data;
            setTgUser(u);
            setForm((f) => ({
              ...f,
              name: f.name || u.firstName,
              phone: f.phone || u.phone || "",
            }));
          }
        })
        .catch(() => {});
    }

    loadServices(today.toISOString().split("T")[0]);
  }, []);

  async function loadServices(date: string) {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/services?clinicId=${clinicId}&date=${date}`);
      const json = await res.json();
      if (json.success) setServices(json.data);
      else setErrorMsg(json.error?.message ?? json.error ?? "Xizmatlarni yuklashda xatolik");
    } catch {
      setErrorMsg("Tarmoq xatosi. Internet aloqasini tekshiring.");
    } finally {
      setLoading(false);
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
      setLoading(true);
      try {
        const res = await fetch(`/api/slots?serviceId=${selectedService.id}&date=${date}`);
        const json = await res.json();
        if (json.success) {
          const available = json.data.filter((s: Slot) => s.available);
          setSlots(available);
          setStep(available.length > 0 ? "slots" : "form");
        } else {
          setErrorMsg(json.error?.message ?? json.error ?? "Uyachalarni yuklashda xatolik");
          setStep("form");
        }
      } catch {
        setErrorMsg("Tarmoq xatosi. Internet aloqasini tekshiring.");
        setStep("form");
      } finally {
        setLoading(false);
      }
    } else {
      setStep("form");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedService || !selectedDate || submitting) return;
    setSubmitting(true);
    setErrorMsg(null);

    try {
      // 1. User resolve → tibId olish (getOrCreate)
      const telegramId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
      let resolvedTibId: string | null = tgUser?.tibId ?? null;

      const regRes = await fetch("/api/user/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: form.phone,
          firstName: form.name,
          ...(telegramId ? { telegramId } : {}),
          clinicId: clinicId || undefined,
        }),
      });
      const regJson = await regRes.json();
      if (regJson.success) resolvedTibId = regJson.data?.tibId ?? resolvedTibId;

      // 2. Booking
      const payload: any = {
        clinicId,
        serviceId: selectedService.id,
        date: selectedDate,
        patientName: form.name,
        patientPhone: form.phone,
        source: "webapp",
      };
      if (selectedSlot) payload.slotId = selectedSlot;
      if (selectedService.requiresAddress) payload.address = form.address;

      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (json.success) {
        setResult(json.data);
        setBookingTibId(resolvedTibId);
        setStep("done");
        if (window.Telegram?.WebApp) {
          window.Telegram.WebApp.sendData(JSON.stringify({ success: true, appointmentId: json.data.id }));
        }
      } else {
        setErrorMsg(json.error?.message ?? json.error ?? "Xatolik yuz berdi. Qayta urinib ko'ring.");
      }
    } catch {
      setErrorMsg("Tarmoq xatosi. Internet aloqasini tekshiring.");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Progress bar ──────────────────────────────────────────────────────────
  const steps: Step[] = selectedService?.requiresSlot
    ? ["services", "date", "slots", "form", "done"]
    : ["services", "date", "form", "done"];
  const stepIdx = steps.indexOf(step);
  const progress = step === "done" ? 100 : Math.round((stepIdx / (steps.length - 1)) * 100);

  const displayTibId = tgUser?.tibId ?? bookingTibId;

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto flex flex-col">
      {/* Header */}
      <div className="bg-blue-600 text-white px-4 pt-4 pb-6">
        <div className="flex items-center justify-between">
          <h1 className="font-bold text-lg">🏥 Qabulga yozilish</h1>
          {displayTibId && (
            <span className="text-xs bg-blue-500 px-2.5 py-1 rounded-full font-mono font-semibold">
              🆔 {displayTibId}
            </span>
          )}
        </div>
        <p className="text-blue-200 text-xs mt-0.5">
          {new Date().toLocaleDateString("uz-UZ", { day: "numeric", month: "long", year: "numeric" })}
        </p>
        {step !== "services" && (
          <div className="mt-3 h-1.5 bg-blue-500 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      <div className="flex-1 p-4">

        {/* ── Global error banner ── */}
        {errorMsg && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2">
            <span className="text-red-500 flex-shrink-0 mt-0.5">⚠️</span>
            <p className="text-red-700 text-sm flex-1">{errorMsg}</p>
            <button onClick={() => setErrorMsg(null)} className="text-red-400 text-lg leading-none flex-shrink-0">×</button>
          </div>
        )}

        {/* ── Step: Services ── */}
        {step === "services" && (
          <div>
            <h2 className="font-semibold text-gray-900 mb-4">Xizmatni tanlang</h2>
            {loading ? (
              <div className="flex items-center justify-center h-32 text-gray-400 text-sm">Yuklanmoqda...</div>
            ) : (
              <div className="space-y-3">
                {services.map((s) => (
                  <button
                    key={s.id}
                    disabled={!s.isAvailable}
                    onClick={() => selectService(s)}
                    className={`w-full text-left rounded-2xl border-2 p-4 transition-all ${
                      s.isAvailable
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
                      <div className="text-right flex-shrink-0 ml-2">
                        <div className="text-sm font-bold text-blue-600">
                          {s.price.toLocaleString()} so'm
                        </div>
                        {s.dailyLimit && (
                          <div className={`text-xs mt-0.5 ${s.isAvailable ? "text-green-600" : "text-red-500"}`}>
                            {s.isAvailable ? `${s.dailyLimit - s.todayCount} joy` : "To'ldi"}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Step: Date ── */}
        {step === "date" && (
          <div>
            <button onClick={() => setStep("services")} className="text-blue-600 text-sm mb-4 flex items-center gap-1">
              ← Orqaga
            </button>
            {selectedService && (
              <div className="bg-blue-50 rounded-xl p-3 mb-5 flex items-center gap-3">
                <span className="text-xl">{typeEmojis[selectedService.type]}</span>
                <div>
                  <div className="text-sm font-semibold text-blue-900">{selectedService.name}</div>
                  <div className="text-xs text-blue-600">{selectedService.price.toLocaleString()} so'm</div>
                </div>
              </div>
            )}
            <h2 className="font-semibold text-gray-900 mb-3">Sanani tanlang</h2>
            <Calendar
              value={selectedDate || null}
              onChange={(date) => selectDate(date)}
            />
            {selectedDate && (
              <p className="text-xs text-gray-400 mt-2 text-center">
                Tanlangan: {formatDateLabel(selectedDate)}
              </p>
            )}
          </div>
        )}

        {/* ── Step: Slots ── */}
        {step === "slots" && (
          <div>
            <button onClick={() => setStep("date")} className="text-blue-600 text-sm mb-4">← Orqaga</button>
            <h2 className="font-semibold text-gray-900 mb-4">Vaqtni tanlang</h2>
            {loading ? (
              <div className="text-center text-gray-400 text-sm py-8">Yuklanmoqda...</div>
            ) : slots.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-2">😔</div>
                <p className="text-gray-500 text-sm">Bu kunda bo'sh uyacha yo'q</p>
                <button onClick={() => setStep("date")} className="btn-primary mt-4 text-sm">
                  Boshqa kun tanlash
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {slots.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedSlot(s.id); setStep("form"); }}
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

        {/* ── Step: Form ── */}
        {step === "form" && (
          <form onSubmit={handleSubmit}>
            <button
              type="button"
              onClick={() => setStep(selectedService?.requiresSlot ? "slots" : "date")}
              className="text-blue-600 text-sm mb-4"
            >
              ← Orqaga
            </button>

            {/* Summary */}
            <div className="bg-blue-50 rounded-xl p-3 mb-5 space-y-1">
              {selectedService && (
                <div className="flex items-center gap-2 text-sm">
                  <span>{typeEmojis[selectedService.type]}</span>
                  <span className="font-semibold text-blue-900">{selectedService.name}</span>
                  <span className="text-blue-600 ml-auto">{selectedService.price.toLocaleString()} so'm</span>
                </div>
              )}
              <div className="text-xs text-blue-700">
                📅 {selectedDate ? formatDateLabel(selectedDate) : ""}
              </div>
              {selectedSlot && (
                <div className="text-xs text-blue-700">
                  🕐 {slots.find((s) => s.id === selectedSlot)?.startTime} —{" "}
                  {slots.find((s) => s.id === selectedSlot)?.endTime}
                </div>
              )}
            </div>

            <h2 className="font-semibold text-gray-900 mb-4">Ma'lumotlaringiz</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Ism Familya *</label>
                <input
                  className="input"
                  required
                  minLength={2}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
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
                    placeholder="Toshkent sh., Yunusobod t., Ko'k sariq ko'ch., 5-uy"
                  />
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full mt-6 py-3.5 text-base"
            >
              {submitting ? "Yuborilmoqda..." : "✅ Qabulga yozilish"}
            </button>
          </form>
        )}

        {/* ── Step: Done ── */}
        {step === "done" && result && (
          <div className="text-center py-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-4">✅</div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Muvaffaqiyatli!</h2>
            <p className="text-gray-500 text-sm mb-6">Qabulingiz tasdiqlandi</p>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 text-left space-y-3">
              {bookingTibId && (
                <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                  <span className="text-sm text-gray-500">ID raqam</span>
                  <span className="text-blue-600 font-bold font-mono text-base">🆔 {bookingTibId}</span>
                </div>
              )}
              <Row label="Xizmat" value={result.service?.name} />
              {result.queueNumber && <Row label="Navbat raqami" value={`#${result.queueNumber}`} highlight />}
              {result.slot && <Row label="Vaqt" value={`${result.slot.startTime} — ${result.slot.endTime}`} />}
              <Row label="Sana" value={selectedDate ? formatDateLabel(selectedDate) : selectedDate} />
              <Row label="Ism" value={result.patientName} />
              <Row label="Telefon" value={result.patientPhone} />
            </div>

            {bookingTibId && (
              <p className="text-xs text-gray-400 mt-4">
                Klinikaga kelganda <span className="font-semibold text-blue-500">{bookingTibId}</span> ni ko'rsating
              </p>
            )}
            <p className="text-xs text-gray-400 mt-2">Klinikaga o'z vaqtida keling 🏥</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-semibold ${highlight ? "text-blue-600 text-lg" : "text-gray-900"}`}>
        {value}
      </span>
    </div>
  );
}
