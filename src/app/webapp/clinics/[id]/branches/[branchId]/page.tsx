"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Calendar } from "@/components/Calendar";
import { formatDateLabel } from "@/lib/calendar";
import Link from "next/link";

declare global { interface Window { Telegram?: { WebApp?: any } } }

type BookingStep = "services" | "date" | "slots" | "form" | "confirm" | "done";

interface ServiceDoctor { id: string; firstName: string; lastName: string; specialty: string; photoUrl: string | null; queueMode?: string }
interface Service { id: string; name: string; type: string; price: number; requiresSlot: boolean; requiresAddress: boolean; requiresPrePayment: boolean; dailyLimit: number | null; todayCount: number; isAvailable: boolean; defaultQueueMode?: string; doctors: ServiceDoctor[] }
interface Slot { id: string; startTime: string; endTime: string; available: boolean }
interface TgUser { firstName: string; phone: string | null; tibId: string | null; hasPhone: boolean }

const typeEmojis: Record<string, string> = { doctor_queue: "👨‍⚕️", diagnostic: "🔬", home_service: "🏠" };
const typeLabels: Record<string, string> = { doctor_queue: "Shifokor navbati", diagnostic: "Diagnostika", home_service: "Uyga chiqish" };

function todayStr() { return new Date().toLocaleDateString("sv-SE"); }
function getTelegramId(tg: any): string | null {
  if (!tg) return null;
  if (tg.initDataUnsafe?.user?.id) return String(tg.initDataUnsafe.user.id);
  try { const u = JSON.parse(decodeURIComponent(new URLSearchParams(tg.initData || "").get("user") || "")); if (u?.id) return String(u.id); } catch {}
  return null;
}
function waitForTG(ms = 3000): Promise<any> {
  return new Promise((res) => {
    if (window.Telegram?.WebApp) return res(window.Telegram.WebApp);
    const s = Date.now(), t = setInterval(() => { if (window.Telegram?.WebApp) { clearInterval(t); res(window.Telegram.WebApp); } else if (Date.now() - s > ms) { clearInterval(t); res(null); } }, 50);
  });
}

export default function BranchServicesPage() {
  const { id: clinicId, branchId } = useParams<{ id: string; branchId: string }>();
  const router = useRouter();

  const [step, setStep]           = useState<BookingStep>("services");
  const [services, setServices]   = useState<Service[]>([]);
  const [slots, setSlots]         = useState<Slot[]>([]);
  const [selSvc, setSelSvc]       = useState<Service | null>(null);
  const [selDate, setSelDate]     = useState("");
  const [selSlot, setSelSlot]     = useState("");
  const [form, setForm]           = useState({ name: "", phone: "", address: "" });
  const [loading, setLoading]     = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult]       = useState<any>(null);
  const [err, setErr]             = useState<string | null>(null);
  const [tgUser, setTgUser]       = useState<TgUser | null>(null);
  const [telegramId, setTelegramId] = useState<string | null>(null);
  const [tibId, setTibId]         = useState<string | null>(null);

  const tgUserRef = useRef<TgUser | null>(null);

  useEffect(() => {
    waitForTG().then(async (tg) => {
      if (tg) { tg.ready(); tg.expand(); }
      let tgId = getTelegramId(tg);
      const urlParams = new URLSearchParams(window.location.search);
      if (!tgId) tgId = urlParams.get("tgid");
      setTelegramId(tgId);
      if (tg?.initDataUnsafe?.user?.first_name) setForm((f) => ({ ...f, name: f.name || tg.initDataUnsafe.user.first_name }));

      if (tgId) {
        try {
          const r = await fetch(`/api/user/by-telegram?telegramId=${tgId}`);
          const j = await r.json();
          if (j.success && j.data) {
            tgUserRef.current = j.data;
            setTgUser(j.data);
            setForm((f) => ({ ...f, name: f.name || j.data.firstName, phone: f.phone || j.data.phone || "" }));
          }
        } catch {}
      }

      setLoading(true);
      try {
        const r = await fetch(`/api/services?clinicId=${clinicId}&branchId=${branchId}&date=${todayStr()}`);
        const j = await r.json();
        if (j.success) setServices(j.data);
        else setErr(j.error?.message ?? "Xizmatlarni yuklashda xatolik");
      } catch { setErr("Tarmoq xatosi"); }
      finally { setLoading(false); }
    });
  }, [clinicId, branchId]);

  async function selectDate(date: string) {
    setSelDate(date); setErr(null);
    if (selSvc?.requiresSlot) {
      setLoading(true);
      try {
        const r = await fetch(`/api/slots?serviceId=${selSvc.id}&date=${date}`);
        const j = await r.json();
        if (j.success) {
          const avail = j.data.filter((s: Slot) => s.available);
          setSlots(avail);
          if (avail.length > 0) { setStep("slots"); return; }
        }
      } finally { setLoading(false); }
    }
    setStep(tgUserRef.current?.hasPhone ? "confirm" : "form");
  }

  async function handleBook() {
    if (!selSvc || !selDate || submitting) return;
    setSubmitting(true); setErr(null);
    try {
      let resolvedTibId = tgUser?.tibId ?? null;
      const regRes = await fetch("/api/user/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: form.phone, firstName: form.name, ...(telegramId ? { telegramId } : {}), clinicId }),
      });
      const regJ = await regRes.json();
      if (regJ.success) resolvedTibId = regJ.data?.tibId ?? resolvedTibId;

      const payload: Record<string, unknown> = {
        clinicId, branchId, serviceId: selSvc.id, date: selDate,
        patientName: form.name, patientPhone: form.phone, source: "webapp",
      };
      if (selSlot) payload.slotId = selSlot;
      if (selSvc.requiresAddress && form.address) payload.address = form.address;

      const r = await fetch("/api/book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await r.json();
      if (j.success) { setResult(j.data); setTibId(resolvedTibId); setStep("done"); }
      else setErr(j.error?.message ?? "Xatolik yuz berdi");
    } catch { setErr("Tarmoq xatosi"); }
    finally { setSubmitting(false); }
  }

  const displayTibId = tgUser?.tibId ?? tibId;

  return (
    <div className="min-h-screen bg-gray-50 max-w-md mx-auto flex flex-col">
      {/* Header */}
      <div className="bg-blue-600 text-white px-4 pt-4 pb-6">
        <div className="flex items-center gap-2 mb-1">
          {step !== "done" && (
            <button onClick={() => step === "services" ? router.push(`/webapp/clinics/${clinicId}`) : setStep("services")}
              className="text-blue-200 hover:text-white text-sm">←</button>
          )}
          <h1 className="font-bold text-lg">🏥 Qabulga yozilish</h1>
          {displayTibId && (
            <span className="ml-auto text-xs bg-blue-500 px-2.5 py-1 rounded-full font-mono">{displayTibId}</span>
          )}
        </div>
        {step !== "services" && step !== "done" && (
          <div className="mt-2 h-1.5 bg-blue-500 rounded-full overflow-hidden">
            <div className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${step === "confirm" ? 85 : step === "form" ? 70 : step === "slots" ? 55 : 35}%` }} />
          </div>
        )}
      </div>

      <div className="flex-1 p-4">
        {err && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2">
            <span className="text-red-500 shrink-0">⚠️</span>
            <p className="text-red-700 text-sm flex-1">{err}</p>
            <button onClick={() => setErr(null)} className="text-red-400 text-lg leading-none">×</button>
          </div>
        )}

        {/* Services */}
        {step === "services" && (
          <div>
            <h2 className="font-semibold text-gray-900 mb-4">Xizmatni tanlang</h2>
            {loading ? (
              <div className="flex items-center justify-center h-32 text-gray-400 text-sm animate-pulse">Yuklanmoqda...</div>
            ) : (
              <div className="space-y-3">
                {services.map((s) => (
                  <button key={s.id} disabled={!s.isAvailable}
                    onClick={() => { setSelSvc(s); setSelDate(""); setSelSlot(""); setStep("date"); }}
                    className={`w-full text-left rounded-2xl border-2 p-4 transition-all ${s.isAvailable ? "bg-white border-transparent shadow-sm active:scale-95 hover:border-blue-100" : "bg-gray-50 border-gray-100 opacity-60 cursor-not-allowed"}`}>
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
                        {s.dailyLimit && (
                          <div className={`text-xs mt-0.5 ${s.isAvailable ? "text-green-600" : "text-red-500"}`}>
                            {s.isAvailable ? `${s.dailyLimit - s.todayCount} joy` : "To&apos;ldi"}
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

        {/* Date */}
        {step === "date" && selSvc && (
          <div>
            <button onClick={() => setStep("services")} className="text-blue-600 text-sm mb-4">← Orqaga</button>
            <div className="bg-blue-50 rounded-xl p-3 mb-4 flex items-center gap-3">
              <span className="text-xl">{typeEmojis[selSvc.type]}</span>
              <div>
                <div className="text-sm font-semibold text-blue-900">{selSvc.name}</div>
                <div className="text-xs text-blue-600">{selSvc.price.toLocaleString()} so&apos;m</div>
              </div>
            </div>
            <h2 className="font-semibold text-gray-900 mb-3">Sanani tanlang</h2>
            <Calendar value={selDate || null} onChange={(d) => selectDate(d)} />
          </div>
        )}

        {/* Slots */}
        {step === "slots" && (
          <div>
            <button onClick={() => setStep("date")} className="text-blue-600 text-sm mb-4">← Orqaga</button>
            <h2 className="font-semibold text-gray-900 mb-4">Vaqtni tanlang</h2>
            {slots.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">Bu kunda bo&apos;sh vaqt yo&apos;q</div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {slots.map((s) => (
                  <button key={s.id} onClick={() => { setSelSlot(s.id); setStep(tgUserRef.current?.hasPhone ? "confirm" : "form"); }}
                    className="p-4 rounded-2xl bg-white border-2 border-transparent shadow-sm text-center hover:border-blue-200 active:scale-95">
                    <div className="text-sm font-bold text-gray-900">{s.startTime}</div>
                    <div className="text-xs text-gray-400">— {s.endTime}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Form */}
        {step === "form" && (
          <form onSubmit={(e) => { e.preventDefault(); setStep("confirm"); }}>
            <button type="button" onClick={() => setStep(selSvc?.requiresSlot ? "slots" : "date")} className="text-blue-600 text-sm mb-4">← Orqaga</button>
            <h2 className="font-semibold text-gray-900 mb-4">Ma&apos;lumotlaringizni kiriting</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Ism Familya *</label>
                <input className="input" required minLength={2} maxLength={40} value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Alisher Karimov" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Telefon *</label>
                <input className="input" required type="tel" value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="+998 90 000 00 00" />
              </div>
              {selSvc?.requiresAddress && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Manzil *</label>
                  <textarea className="input resize-none" required rows={3} value={form.address}
                    onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} placeholder="Toshkent, Yunusobod, 5-uy" />
                </div>
              )}
            </div>
            <button type="submit" className="btn-primary w-full mt-6 py-3.5 text-base">Davom etish →</button>
          </form>
        )}

        {/* Confirm */}
        {step === "confirm" && selSvc && (
          <div>
            <button onClick={() => setStep(tgUserRef.current?.hasPhone ? (selSvc.requiresSlot ? "slots" : "date") : "form")}
              className="text-blue-600 text-sm mb-4">← Orqaga</button>
            <h2 className="font-semibold text-gray-900 mb-4">Tasdiqlash</h2>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3 mb-5">
              <SummaryRow label="Xizmat" value={`${typeEmojis[selSvc.type]} ${selSvc.name}`} />
              <SummaryRow label="Narx" value={`${selSvc.price.toLocaleString()} so'm`} />
              <SummaryRow label="Sana" value={selDate ? formatDateLabel(selDate) : ""} />
              {selSlot && slots.find((s) => s.id === selSlot) && (
                <SummaryRow label="Vaqt" value={`${slots.find((s) => s.id === selSlot)!.startTime} — ${slots.find((s) => s.id === selSlot)!.endTime}`} />
              )}
              <div className="border-t border-gray-100 pt-3 space-y-2">
                <SummaryRow label="Ism" value={form.name} />
                <SummaryRow label="Telefon" value={form.phone} />
                {displayTibId && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">ID</span>
                    <span className="font-mono text-sm font-bold text-blue-600">🆔 {displayTibId}</span>
                  </div>
                )}
              </div>
            </div>
            <button onClick={handleBook} disabled={submitting} className="btn-primary w-full py-3.5 text-base">
              {submitting ? "Yuborilmoqda..." : "✅ Qabulga yozilish"}
            </button>
          </div>
        )}

        {/* Done */}
        {step === "done" && result && (
          <div className="text-center py-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-4">✅</div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Muvaffaqiyatli!</h2>
            <p className="text-gray-500 text-sm mb-6">Qabulingiz tasdiqlandi</p>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 text-left space-y-3 mb-5">
              {displayTibId && (
                <div className="flex justify-between items-center pb-3 border-b border-gray-100">
                  <span className="text-sm text-gray-500">ID raqam</span>
                  <span className="text-blue-600 font-bold font-mono text-base">🆔 {displayTibId}</span>
                </div>
              )}
              <SummaryRow label="Xizmat" value={result.service?.name ?? ""} />
              {result.queueNumber && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Navbat</span>
                  <span className="text-blue-600 font-bold text-lg">#{result.queueNumber}</span>
                </div>
              )}
              <SummaryRow label="Sana" value={selDate ? formatDateLabel(selDate) : ""} />
              <SummaryRow label="Ism" value={result.patientName} />
            </div>
            <p className="text-xs text-gray-400 mb-6">Klinikaga o&apos;z vaqtida keling 🏥</p>
            {telegramId && (
              <button onClick={() => router.push(`/webapp?mode=dashboard&clinicId=${clinicId}`)}
                className="w-full py-3 rounded-2xl border-2 border-blue-100 text-blue-600 text-sm font-medium hover:bg-blue-50 active:scale-95">
                ← Mening bronlarim
              </button>
            )}
          </div>
        )}
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
