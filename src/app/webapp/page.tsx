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
interface TgUser { firstName: string; phone: string | null; tibId: string | null; hasPhone: boolean }

// Known user (hasPhone): services → date → (slots) → confirm → done
// Known user (no phone): services → date → (slots) → phone-form → confirm → done
// New user:             services → date → (slots) → full-form → confirm → done
type Step = "services" | "date" | "slots" | "form" | "confirm" | "done";

const typeEmojis: Record<string, string> = {
  doctor_queue: "👨‍⚕️", diagnostic: "🔬", home_service: "🏠",
};
const typeLabels: Record<string, string> = {
  doctor_queue: "Shifokor navbati", diagnostic: "Diagnostika", home_service: "Uyga chiqish",
};

// Telegram WebApp dan telegramId ni ishonchli olish (initDataUnsafe + fallback parsing)
function getTelegramId(tg: any): number | null {
  if (!tg) return null;
  // Usul 1: to'g'ridan-to'g'ri
  if (tg.initDataUnsafe?.user?.id) return tg.initDataUnsafe.user.id;
  // Usul 2: initData stringidan parse qilish
  if (tg.initData) {
    try {
      const params = new URLSearchParams(tg.initData);
      const userStr = params.get("user");
      if (userStr) {
        const user = JSON.parse(decodeURIComponent(userStr));
        if (user?.id) return user.id;
      }
    } catch {}
  }
  return null;
}

function getTelegramFirstName(tg: any): string {
  if (tg?.initDataUnsafe?.user?.first_name) return tg.initDataUnsafe.user.first_name;
  if (tg?.initData) {
    try {
      const params = new URLSearchParams(tg.initData);
      const userStr = params.get("user");
      if (userStr) return JSON.parse(decodeURIComponent(userStr))?.first_name || "";
    } catch {}
  }
  return "";
}

export default function WebApp() {
  const [step, setStep] = useState<Step>("services");
  const [services, setServices] = useState<Service[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  const [loading, setLoading] = useState(false);
  const [userLoading, setUserLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [tgUser, setTgUser] = useState<TgUser | null>(null);
  const [bookingTibId, setBookingTibId] = useState<string | null>(null);
  const [telegramId, setTelegramId] = useState<number | null>(null);

  const clinicId =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("clinicId") ||
        process.env.NEXT_PUBLIC_CLINIC_ID || ""
      : "";

  // ─── Init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    tg?.ready();
    tg?.expand();

    const tgId = getTelegramId(tg);
    const tgFirstName = getTelegramFirstName(tg);

    setTelegramId(tgId);

    // Telegram ismi bilan formani oldindan to'ldirish (hatto user topilmasa ham)
    if (tgFirstName) {
      setForm((f) => ({ ...f, name: f.name || tgFirstName }));
    }

    const resolveUser = tgId
      ? fetch(`/api/user/by-telegram?telegramId=${tgId}`)
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
          .catch(() => {})
      : Promise.resolve();

    resolveUser.finally(() => setUserLoading(false));
    loadServices(new Date().toISOString().split("T")[0]);
  }, []);

  async function loadServices(date: string) {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/services?clinicId=${clinicId}&date=${date}`);
      const json = await res.json();
      if (json.success) setServices(json.data);
      else setErrorMsg(json.error?.message ?? "Xizmatlarni yuklashda xatolik");
    } catch {
      setErrorMsg("Tarmoq xatosi.");
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
          if (available.length > 0) { setStep("slots"); return; }
        } else {
          setErrorMsg(json.error?.message ?? "Uyachalarni yuklashda xatolik");
        }
      } catch {
        setErrorMsg("Tarmoq xatosi.");
      } finally {
        setLoading(false);
      }
    }
    goAfterDateSlot();
  }

  function selectSlot(slotId: string) {
    setSelectedSlot(slotId);
    goAfterDateSlot();
  }

  // Routing: telefon bo'lsa confirm, yo'q bo'lsa form
  function goAfterDateSlot() {
    if (tgUser?.hasPhone) {
      setStep("confirm");         // Telefon bor → form o'tkazib yuboriladi
    } else {
      setStep("form");            // Telefon yo'q yoki yangi user → form ko'rsatiladi
    }
  }

  function handleFormNext(e: React.FormEvent) {
    e.preventDefault();
    setStep("confirm");
  }

  // ─── Booking ────────────────────────────────────────────────────────────────
  async function handleBook() {
    if (!selectedService || !selectedDate || submitting) return;
    setSubmitting(true);
    setErrorMsg(null);

    try {
      let resolvedTibId: string | null = tgUser?.tibId ?? null;

      // User resolve → bir xil tibId olish (ketma-ket: telegramId → phone)
      const regRes = await fetch("/api/user/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: form.phone,
          firstName: form.name,
          ...(telegramId ? { telegramId } : {}),
          ...(clinicId ? { clinicId } : {}),
        }),
      });
      const regJson = await regRes.json();
      if (regJson.success) resolvedTibId = regJson.data?.tibId ?? resolvedTibId;

      // Booking
      const payload: Record<string, unknown> = {
        clinicId,
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
        setResult(json.data);
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

  // Form faqat telefon so'rashimi yoki to'liq ko'rsatilishimi
  const nameIsKnown = !!(tgUser?.firstName || form.name);

  // ─── Render ─────────────────────────────────────────────────────────────────
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
              style={{ width: `${ step === "done" ? 100 : step === "confirm" ? 85 : step === "form" ? 70 : step === "slots" ? 55 : 35 }%` }}
            />
          </div>
        )}
      </div>

      <div className="flex-1 p-4">

        {/* Error banner */}
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
            {userLoading && (
              <div className="text-xs text-center text-gray-400 mb-3 animate-pulse">
                Foydalanuvchi tekshirilmoqda...
              </div>
            )}
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
            <Calendar value={selectedDate || null} onChange={(date) => selectDate(date)} />
            {loading && <div className="text-center text-gray-400 text-sm mt-3">Tekshirilmoqda...</div>}
          </div>
        )}

        {/* ── Step: Slots ── */}
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

        {/* ── Step: Form ── */}
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
              {!nameIsKnown && (
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
              )}
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

        {/* ── Step: Confirm ── */}
        {step === "confirm" && (
          <div>
            <button
              onClick={() => setStep(
                tgUser?.hasPhone
                  ? (selectedService?.requiresSlot ? "slots" : "date")
                  : "form"
              )}
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
              <SummaryRow label="Xizmat" value={result.service?.name} />
              {result.queueNumber && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Navbat raqami</span>
                  <span className="text-blue-600 font-bold text-lg">#{result.queueNumber}</span>
                </div>
              )}
              {result.slot && <SummaryRow label="Vaqt" value={`${result.slot.startTime} — ${result.slot.endTime}`} />}
              <SummaryRow label="Sana" value={selectedDate ? formatDateLabel(selectedDate) : selectedDate} />
              <SummaryRow label="Ism" value={result.patientName} />
              <SummaryRow label="Telefon" value={result.patientPhone} />
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

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-sm text-gray-500 flex-shrink-0">{label}</span>
      <span className="text-sm font-semibold text-gray-900 text-right">{value}</span>
    </div>
  );
}
