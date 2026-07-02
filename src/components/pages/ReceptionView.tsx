"use client";

import { useState, useEffect, useCallback } from "react";
import TelegramChatButton from "@/components/shared/TelegramChatButton";
import LocationButtons from "@/components/LocationButtons";
import LiveLocationPanel from "@/components/LiveLocationPanel";
import { Stack } from "@/components/layout";
import { DoctorBlockedDatesManager } from "@/components/DoctorBlockedDatesManager";

interface ReceptionAppointment {
  id: string;
  patientName: string;
  patientPhone: string;
  queueNumber: number | null;
  status: string;
  paymentStatus: string;
  queueMode: string;
  date: string;
  address: string | null;
  notes: string | null;
  tibId: string | null;
  paidAmount: number | null;
  appliedDiscountPercent: number;
  service: { id: string; name: string; type: string; price: number } | null;
  doctor: { id: string; name: string; specialty: string | null } | null;
  patientTelegramId: string | null;
  locationLat?: number | null;
  locationLng?: number | null;
  liveLat?: number | null;
  liveLng?: number | null;
  liveStartedAt?: string | null;
  liveExpiresAt?: string | null;
  liveLastUpdatedAt?: string | null;
  liveStatus?: string | null;
}

interface ReceptionData {
  date: string;
  pending: ReceptionAppointment[];
  paid: ReceptionAppointment[];
  counts: { pending: number; paid: number; total: number };
}

const AUTO_REFRESH_MS = 30_000;

interface DoctorItem { id: string; firstName: string; lastName: string; specialty: string }

export interface ReceptionViewProps {
  context?: "standalone" | "admin";
}

export default function ReceptionView({ context = "standalone" }: ReceptionViewProps) {
  const [data, setData] = useState<ReceptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [date, setDate] = useState(() => new Date().toLocaleDateString("sv-SE"));
  const [lastRefresh, setLastRefresh] = useState("");
  const [doctors, setDoctors] = useState<DoctorItem[]>([]);
  const [selBlockDoctorId, setSelBlockDoctorId] = useState<string>("");
  const [showBlockSection, setShowBlockSection] = useState(false);
  const [discountPercent, setDiscountPercent] = useState(0);

  const fetchData = useCallback(async (d?: string) => {
    try {
      const target = d ?? date;
      const res = await fetch(`/api/reception/appointments?date=${target}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = await res.json();
      if (res.status === 403 && json.error?.code === "EM_REQUIRED") {
        const ru = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/login?returnUrl=${ru}`;
        return;
      }
      if (json.success) {
        setData(json.data);
        setLastRefresh(new Date().toLocaleTimeString("uz-UZ"));
        setErrorMsg(null);
      } else {
        setErrorMsg(json.error?.message ?? "Ma'lumot yuklanmadi");
      }
    } catch {
      setErrorMsg("Tarmoq xatosi.");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchData();
    const timer = setInterval(() => fetchData(), AUTO_REFRESH_MS);
    return () => clearInterval(timer);
  }, [fetchData]);

  useEffect(() => {
    fetch("/api/admin/doctors", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => { if (j.success) setDoctors(j.data ?? []); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/admin/clinic-settings", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => { if (j.success && j.data) setDiscountPercent(j.data.discountPercent ?? 0); })
      .catch(() => {});
  }, []);

  function handleDateChange(d: string) {
    setDate(d);
    setLoading(true);
    fetchData(d);
  }

  async function handlePaymentAction(
    appointmentId: string,
    action: "paid" | "unpaid" | "cancel",
    mode?: "full" | "discount"
  ) {
    if (action === "cancel" && !confirm("Bronni butunlay bekor qilishni tasdiqlaysizmi?")) return;
    setActionLoading(appointmentId);
    try {
      const body: Record<string, unknown> = { action };
      if (action === "paid" && mode) body.mode = mode;

      const res = await fetch(`/api/reception/appointments/${appointmentId}/payment`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) {
        await fetchData();
      } else {
        setErrorMsg("Xato: " + (json.error?.message ?? json.message ?? "Amal bajarilmadi"));
      }
    } catch {
      setErrorMsg("Tarmoq xatosi");
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return <div className="p-6 text-gray-400 text-sm">⏳ Yuklanmoqda...</div>;
  }

  return (
    <div>
      {/* Header */}
      <Stack direction="row" stackOnMobile justify="between" align="start" gap={4} className="mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📋 Qabulxona — To'lov nazorati</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {lastRefresh ? `Oxirgi yangilanish: ${lastRefresh}` : ""}
            <span className="ml-2 text-blue-400">(har 30s avtomatik)</span>
          </p>
        </div>
        <button onClick={() => fetchData()} className="btn-secondary text-sm flex items-center gap-1.5 min-h-[44px]">
          ↻ Yangilash
        </button>
      </Stack>

      {/* Date + stats */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <input
          type="date"
          value={date}
          onChange={(e) => handleDateChange(e.target.value)}
          className="input w-auto text-sm"
        />
        {data && (
          <div className="flex gap-3 text-sm">
            <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg font-medium">
              🟡 {data.counts.pending} ta kutmoqda
            </span>
            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-lg font-medium">
              🟢 {data.counts.paid} ta to'langan
            </span>
          </div>
        )}
        {discountPercent > 0 && (
          <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-lg font-medium text-sm">
            🏷 Chegirma: {discountPercent}%
          </span>
        )}
      </div>

      {errorMsg && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2">
          <span className="text-red-500 flex-shrink-0">⚠️</span>
          <p className="text-red-700 text-sm flex-1">{errorMsg}</p>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 text-lg leading-none">×</button>
        </div>
      )}

      {!data ? (
        <div className="card text-center py-12 text-gray-400">Ma'lumot topilmadi</div>
      ) : (
        <div className="space-y-6">
          {/* 🟡 TO'LOV KUTILMOQDA */}
          <section>
            <h2 className="text-sm font-semibold text-amber-700 mb-3 flex items-center gap-2">
              🟡 To'lov kutilmoqda
              <span className="px-2 py-0.5 bg-amber-100 rounded-full text-xs font-bold">
                {data.counts.pending}
              </span>
            </h2>
            {data.pending.length === 0 ? (
              <div className="card text-center py-8 text-gray-400 text-sm">
                To'lov kutilayotgan bemor yo'q
              </div>
            ) : (
              <div className="space-y-2">
                {data.pending.map((appt) => (
                  <ReceptionCard
                    key={appt.id}
                    appt={appt}
                    loading={actionLoading === appt.id}
                    section="pending"
                    discountPercent={discountPercent}
                    onPaid={() => handlePaymentAction(appt.id, "paid", "full")}
                    onDiscount={() => handlePaymentAction(appt.id, "paid", "discount")}
                    onCancel={() => handlePaymentAction(appt.id, "cancel")}
                  />
                ))}
              </div>
            )}
          </section>

          {/* 🟢 TO'LANGAN */}
          <section>
            <h2 className="text-sm font-semibold text-emerald-700 mb-3 flex items-center gap-2">
              🟢 To'langan — shifokorga uzatildi
              <span className="px-2 py-0.5 bg-emerald-100 rounded-full text-xs font-bold">
                {data.counts.paid}
              </span>
            </h2>
            {data.paid.length === 0 ? (
              <div className="card text-center py-8 text-gray-400 text-sm">
                To'langan bemor yo'q
              </div>
            ) : (
              <div className="space-y-2">
                {data.paid.map((appt) => (
                  <ReceptionCard
                    key={appt.id}
                    appt={appt}
                    loading={actionLoading === appt.id}
                    section="paid"
                    discountPercent={discountPercent}
                    onUnpaid={() => handlePaymentAction(appt.id, "unpaid")}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Shifokor kun bloklash */}
      <div className="mt-6">
        <button
          onClick={() => setShowBlockSection((v) => !v)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
        >
          <span className={`transition-transform ${showBlockSection ? "rotate-90" : ""}`}>▶</span>
          Shifokor kun bloklash
        </button>
        {showBlockSection && (
          <div className="mt-3 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Shifokorni tanlang</label>
              <select
                value={selBlockDoctorId}
                onChange={(e) => setSelBlockDoctorId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="">— Shifokorni tanlang —</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.lastName} {d.firstName} — {d.specialty}
                  </option>
                ))}
              </select>
            </div>
            {selBlockDoctorId && (
              <DoctorBlockedDatesManager doctorId={selBlockDoctorId} credentials="include" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Kartochka komponenti ────────────────────────────────────────────────────────

interface CardProps {
  appt: ReceptionAppointment;
  loading: boolean;
  section: "pending" | "paid";
  discountPercent: number;
  onPaid?: () => void;
  onDiscount?: () => void;
  onUnpaid?: () => void;
  onCancel?: () => void;
}

function ReceptionCard({ appt, loading, section, discountPercent, onPaid, onDiscount, onUnpaid, onCancel }: CardProps) {
  const price = appt.service?.price ?? 0;
  const discountedAmount = Math.round(price * (100 - discountPercent) / 100);
  const showDiscountBtn = section === "pending" && discountPercent > 0 && price > 0;

  // Qaytarish tugmasi: 100% chegirma (paidAmount=0) bo'lsa ko'rsatilmaydi
  const canRefund = appt.appliedDiscountPercent !== 100 && appt.paidAmount !== 0;

  return (
    <div className={`card p-3 ${section === "paid" ? "opacity-80" : ""}`}>
      <div className="flex items-start gap-3">
        {/* Navbat raqami */}
        {appt.queueNumber != null && (
          <div className="w-10 h-10 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-base flex-shrink-0">
            {appt.queueNumber}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <h3 className="font-semibold text-gray-900">{appt.patientName}</h3>
              <p className="text-xs text-gray-500">📞 {appt.patientPhone}</p>
              {appt.tibId && (
                <p className="text-xs font-mono text-blue-500 mt-0.5">🆔 {appt.tibId}</p>
              )}
            </div>
            {section === "paid" && (
              <div className="flex flex-col items-end gap-0.5">
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium flex-shrink-0">
                  ✅ To'langan
                </span>
                {appt.appliedDiscountPercent > 0 && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium flex-shrink-0">
                    🏷 {appt.appliedDiscountPercent}% chegirma
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="mt-1.5 text-xs text-gray-600 space-y-0.5">
            <p>🏷 {appt.service?.name ?? "—"}{appt.service?.price ? ` · ${appt.service.price.toLocaleString()} so'm` : ""}</p>
            {appt.doctor && <p>👨‍⚕️ {appt.doctor.name}{appt.doctor.specialty ? ` (${appt.doctor.specialty})` : ""}</p>}
            {appt.address && <p className="text-orange-500">📍 {appt.address}</p>}
            {section === "paid" && appt.paidAmount != null && appt.appliedDiscountPercent > 0 && (
              <p className="text-blue-600 font-medium">💰 To'langan: {appt.paidAmount.toLocaleString()} so'm</p>
            )}
          </div>

          {/* Telegram va joylashuv */}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <TelegramChatButton
              telegramId={appt.patientTelegramId}
              patientName={appt.patientName}
              phone={appt.patientPhone}
              appointmentId={appt.id}
              variant="compact"
            />
            {appt.service?.type === "home_service" && (
              <LocationButtons locationLat={appt.locationLat} locationLng={appt.locationLng} address={appt.address} />
            )}
          </div>
          {appt.service?.type === "home_service" &&
            appt.liveLat != null && appt.liveLng != null &&
            appt.liveStatus && appt.liveExpiresAt && appt.liveLastUpdatedAt && (
            <LiveLocationPanel
              appointmentId={appt.id}
              patientName={appt.patientName}
              liveLat={appt.liveLat}
              liveLng={appt.liveLng}
              liveStartedAt={appt.liveStartedAt ?? appt.liveLastUpdatedAt}
              liveExpiresAt={appt.liveExpiresAt}
              liveLastUpdatedAt={appt.liveLastUpdatedAt}
              liveStatus={appt.liveStatus}
            />
          )}
        </div>
      </div>

      {/* Tugmalar */}
      <div className="mt-3">
        {section === "pending" && (
          <div className="flex flex-col gap-2">
            {/* 1. To'ladi (yashil) — har doim */}
            <button
              onClick={onPaid}
              disabled={loading}
              className="w-full px-3 py-2 min-h-[44px] bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              {loading ? "..." : "💰 To'ladi"}
            </button>

            {/* 2. Chegirma tugmasi (ko'k) — faqat discountPercent > 0 va price > 0 */}
            {showDiscountBtn && (
              <button
                onClick={onDiscount}
                disabled={loading}
                className="w-full px-3 py-2 min-h-[44px] bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors"
              >
                {loading ? "..." : `${discountedAmount.toLocaleString("uz-UZ")} so'm to'ladi`}
              </button>
            )}

            {/* 3. Bekor (qizil) — har doim */}
            <button
              onClick={onCancel}
              disabled={loading}
              className="w-full px-3 py-2 min-h-[44px] bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-600 rounded-lg text-sm transition-colors"
            >
              Bekor
            </button>
          </div>
        )}

        {section === "paid" && canRefund && (
          <button
            onClick={onUnpaid}
            disabled={loading}
            className="px-3 py-2 min-h-[44px] bg-amber-50 hover:bg-amber-100 disabled:opacity-50 text-amber-700 rounded-lg text-sm transition-colors"
          >
            {loading ? "..." : "↩ To'lovni qaytarish"}
          </button>
        )}
      </div>
    </div>
  );
}
