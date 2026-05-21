"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Calendar } from "@/components/Calendar";
import { formatDateLabel } from "@/lib/calendar";
import Link from "next/link";

declare global { interface Window { Telegram?: { WebApp?: any } } }

type BookingStep = "services" | "date" | "slots" | "patient" | "form" | "confirm" | "done";

interface ServiceDoctor { id: string; firstName: string; lastName: string; specialty: string; photoUrl: string | null; queueMode?: string }
interface Service { id: string; name: string; type: string; price: number; requiresSlot: boolean; requiresAddress: boolean; requiresPrePayment: boolean; dailyLimit: number | null; todayCount: number; isAvailable: boolean; defaultQueueMode?: string; doctors: ServiceDoctor[] }
interface Slot { id: string; startTime: string; endTime: string; available: boolean }
interface Dependent { id: string; firstName: string; lastName: string | null; phone: string | null; relation: string | null }
interface TgUser { id: string; firstName: string; lastName: string | null; fullName: string; phone: string | null; tibId: string | null; hasPhone: boolean; dependents: Dependent[]; canAddDependent: boolean }
interface PatientSelection { type: "self" | "dependent" | "guest"; dependentId: string | null; patientName: string; patientPhone: string }

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

  const [step, setStep]             = useState<BookingStep>("services");
  const [services, setServices]     = useState<Service[]>([]);
  const [slots, setSlots]           = useState<Slot[]>([]);
  const [selSvc, setSelSvc]         = useState<Service | null>(null);
  const [selDate, setSelDate]       = useState("");
  const [selSlot, setSelSlot]       = useState("");
  const [patient, setPatient]       = useState<PatientSelection>({ type: "guest", dependentId: null, patientName: "", patientPhone: "" });
  const [form, setForm]             = useState({ name: "", phone: "", address: "" });
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult]         = useState<any>(null);
  const [err, setErr]               = useState<string | null>(null);
  const [tgUser, setTgUser]         = useState<TgUser | null>(null);
  const [telegramId, setTelegramId] = useState<string | null>(null);
  const [tibId, setTibId]           = useState<string | null>(null);

  // Adding a new dependent inline
  const [addingDep, setAddingDep]   = useState(false);
  const [newDepName, setNewDepName] = useState("");
  const [newDepLast, setNewDepLast] = useState("");
  const [newDepRel, setNewDepRel]   = useState("");
  const [depSaving, setDepSaving]   = useState(false);

  const [doneCountdown, setDoneCountdown] = useState(5);
  const tgUserRef = useRef<TgUser | null>(null);

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
            setForm((f) => ({ ...f, name: j.data.fullName || j.data.firstName || f.name, phone: f.phone || j.data.phone || "" }));
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
    goToPatientOrForm();
  }

  function goToPatientOrForm() {
    if (tgUserRef.current?.hasPhone) {
      const u = tgUserRef.current;
      setPatient({ type: "self", dependentId: null, patientName: u.fullName, patientPhone: u.phone || "" });
      // Dependents yo'q va address kerak emas → to'g'ri confirm stepga o't (UX skip)
      if (u.dependents.length === 0 && !selSvc?.requiresAddress) {
        setStep("confirm");
      } else {
        setStep("patient");
      }
    } else {
      setStep("form");
    }
  }

  async function handleAddDependent() {
    if (!newDepName.trim() || newDepName.length < 2) { alert("Ism kamida 2 harf bo'lishi kerak"); return; }
    if (!telegramId) { alert("Telegram ID topilmadi"); return; }
    setDepSaving(true);
    try {
      // Dependents API needs cookie auth — use telegramId-based register first
      // Actually we call /api/dependents but need userId. We'll use the user's cookie if available.
      // For webapp users (no cookie), we need a different approach.
      // Use the telegramId to find user and create dependent via the API.
      const res = await fetch("/api/dependents/by-telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegramId, firstName: newDepName.trim(), lastName: newDepLast.trim() || null, relation: newDepRel || null }),
      });
      const j = await res.json();
      if (!j.success) { alert(j.error?.message || "Qo'shib bo'lmadi"); return; }

      // Refresh user data
      const r2 = await fetch(`/api/user/by-telegram?telegramId=${telegramId}`);
      const j2 = await r2.json();
      if (j2.success && j2.data) {
        tgUserRef.current = j2.data;
        setTgUser(j2.data);
        setPatient({ type: "dependent", dependentId: j.data.id, patientName: [j.data.firstName, j.data.lastName].filter(Boolean).join(" "), patientPhone: j.data.phone || j2.data.phone || "" });
      }
      setAddingDep(false);
      setNewDepName(""); setNewDepLast(""); setNewDepRel("");
    } catch { alert("Xato"); }
    finally { setDepSaving(false); }
  }

  async function handleBook() {
    if (!selSvc || !selDate || submitting) return;
    setSubmitting(true); setErr(null);
    try {
      let resolvedTibId = tgUser?.tibId ?? null;
      let resolvedUserId: string | null = tgUser?.id ?? null;
      if (!resolvedUserId && telegramId) {
        const regRes = await fetch("/api/user/register", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: patient.patientPhone || form.phone, firstName: patient.patientName || form.name, ...(telegramId ? { telegramId } : {}), clinicId }),
        });
        const regJ = await regRes.json();
        if (regJ.success) { resolvedTibId = regJ.data?.tibId ?? resolvedTibId; resolvedUserId = regJ.data?.userId ?? null; }
      }

      const finalName = patient.type === "guest" ? form.name : patient.patientName;
      const finalPhone = patient.type === "guest" ? form.phone : patient.patientPhone;

      const payload: Record<string, unknown> = {
        clinicId, branchId, serviceId: selSvc.id, date: selDate,
        patientName: finalName, patientPhone: finalPhone, source: "webapp",
        ...(resolvedUserId ? { userId: resolvedUserId } : {}),
        ...(patient.dependentId ? { dependentId: patient.dependentId } : {}),
      };
      if (selSlot) payload.slotId = selSlot;
      if (selSvc.requiresAddress && form.address) payload.address = form.address;

      const r = await fetch("/api/book", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await r.json();
      if (j.success) { setResult(j.data); setTibId(resolvedTibId); setStep("done"); }
      else {
        if (r.status === 409) setErr(`⚠️ ${j.error?.message ?? "Bron mavjud"}`);
        else setErr(j.error?.message ?? "Xatolik yuz berdi");
      }
    } catch { setErr("Tarmoq xatosi"); }
    finally { setSubmitting(false); }
  }

  const displayTibId = tgUser?.tibId ?? tibId;
  const u = tgUser;

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
              style={{ width: `${step === "confirm" ? 85 : step === "form" || step === "patient" ? 70 : step === "slots" ? 55 : 35}%` }} />
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
                  <button key={s.id} onClick={() => { setSelSlot(s.id); goToPatientOrForm(); }}
                    className="p-4 rounded-2xl bg-white border-2 border-transparent shadow-sm text-center hover:border-blue-200 active:scale-95">
                    <div className="text-sm font-bold text-gray-900">{s.startTime}</div>
                    <div className="text-xs text-gray-400">— {s.endTime}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Patient selection */}
        {step === "patient" && u && (
          <div>
            <button onClick={() => setStep(selSvc?.requiresSlot ? "slots" : "date")} className="text-blue-600 text-sm mb-4">← Orqaga</button>
            <h2 className="font-semibold text-gray-900 mb-4">👤 Bron kim uchun?</h2>
            <div className="space-y-2 mb-4">
              {/* O'zim */}
              <button type="button"
                onClick={() => setPatient({ type: "self", dependentId: null, patientName: u.fullName, patientPhone: u.phone || "" })}
                className={`w-full text-left p-3 rounded-xl border-2 transition ${patient.type === "self" ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white"}`}>
                <div className="flex items-center gap-3">
                  <span className="text-xl">✅</span>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{u.fullName}</div>
                    <div className="text-xs text-gray-500">O&apos;zim · {u.phone}</div>
                  </div>
                  {patient.type === "self" && <span className="text-blue-500 text-xs">●</span>}
                </div>
              </button>

              {/* Mavjud dependents */}
              {u.dependents.map((dep) => {
                const depName = [dep.firstName, dep.lastName].filter(Boolean).join(" ");
                const isSelected = patient.dependentId === dep.id;
                return (
                  <button key={dep.id} type="button"
                    onClick={() => setPatient({ type: "dependent", dependentId: dep.id, patientName: depName, patientPhone: dep.phone || u.phone || "" })}
                    className={`w-full text-left p-3 rounded-xl border-2 transition ${isSelected ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white"}`}>
                    <div className="flex items-center gap-3">
                      <span className="text-xl">👤</span>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{depName}</div>
                        <div className="text-xs text-gray-500">{dep.relation || "Qaramog’imdagi"} · {dep.phone || u.phone}</div>
                      </div>
                      {isSelected && <span className="text-blue-500 text-xs">●</span>}
                    </div>
                  </button>
                );
              })}

              {/* Qo'shish */}
              {u.canAddDependent && !addingDep && (
                <button type="button" onClick={() => setAddingDep(true)}
                  className="w-full p-3 rounded-xl border-2 border-dashed border-gray-300 text-sm text-gray-600 hover:bg-gray-50">
                  ➕ Qaramog&apos;imdagi shaxs qo&apos;shish ({u.dependents.length}/2)
                </button>
              )}

              {addingDep && (
                <div className="p-3 bg-gray-50 rounded-xl space-y-2">
                  <input type="text" placeholder="Ism *" value={newDepName} onChange={(e) => setNewDepName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white" maxLength={50} />
                  <input type="text" placeholder="Familiya" value={newDepLast} onChange={(e) => setNewDepLast(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white" maxLength={50} />
                  <select value={newDepRel} onChange={(e) => setNewDepRel(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                    <option value="">— Kim bo&apos;ladi (ixtiyoriy) —</option>
                    {["Onam","Otam","O’g’lim","Qizim","Xotinim","Erim","Aka","Singil","Boshqa"].map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button type="button" onClick={handleAddDependent} disabled={depSaving}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
                      {depSaving ? "Saqlanmoqda..." : "Qo’shish"}
                    </button>
                    <button type="button" onClick={() => { setAddingDep(false); setNewDepName(""); setNewDepLast(""); setNewDepRel(""); }}
                      className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm">Bekor</button>
                  </div>
                </div>
              )}
            </div>

            {selSvc?.requiresAddress && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Manzil *</label>
                <textarea className="input resize-none" required rows={3} value={form.address}
                  onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} placeholder="Toshkent, Yunusobod, 5-uy" />
              </div>
            )}

            <button onClick={() => setStep("confirm")} disabled={!patient.patientName || !patient.patientPhone}
              className="btn-primary w-full py-3.5 text-base disabled:opacity-50">
              Davom etish →
            </button>
          </div>
        )}

        {/* Form (guest / no-phone user) */}
        {step === "form" && (
          <form onSubmit={(e) => { e.preventDefault(); setPatient({ type: "guest", dependentId: null, patientName: form.name, patientPhone: form.phone }); setStep("confirm"); }}>
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
            <button onClick={() => setStep(u?.hasPhone ? "patient" : "form")} className="text-blue-600 text-sm mb-4">← Orqaga</button>
            <h2 className="font-semibold text-gray-900 mb-4">Tasdiqlash</h2>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3 mb-5">
              <SummaryRow label="Xizmat" value={`${typeEmojis[selSvc.type]} ${selSvc.name}`} />
              <SummaryRow label="Narx" value={`${selSvc.price.toLocaleString()} so'm`} />
              <SummaryRow label="Sana" value={selDate ? formatDateLabel(selDate) : ""} />
              {selSlot && slots.find((s) => s.id === selSlot) && (
                <SummaryRow label="Vaqt" value={`${slots.find((s) => s.id === selSlot)!.startTime} — ${slots.find((s) => s.id === selSlot)!.endTime}`} />
              )}
              <div className="border-t border-gray-100 pt-3 space-y-2">
                <SummaryRow label="Bemor" value={patient.patientName || form.name} />
                <SummaryRow label="Telefon" value={patient.patientPhone || form.phone} />
                {patient.dependentId && <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">👨‍👩‍👧 Qaramog&apos;idagi uchun bron</div>}
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
              <SummaryRow label="Bemor" value={result.patientName} />
            </div>
            <p className="text-xs text-gray-400 mb-4">Klinikaga o&apos;z vaqtida keling 🏥</p>
            {doneCountdown > 0 && (
              <p className="text-xs text-gray-400 mb-3">
                {doneCountdown} soniyadan keyin botga qaytasiz...
              </p>
            )}
            <button
              onClick={() => {
                try { window.Telegram?.WebApp?.close(); } catch {}
                router.push(`/webapp?mode=dashboard&clinicId=${clinicId}`);
              }}
              className="w-full py-3 rounded-2xl bg-blue-600 text-white text-sm font-semibold active:scale-95 transition-all mb-3"
            >
              Hozir botga qaytish
            </button>
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
