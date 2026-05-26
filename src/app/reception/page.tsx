"use client";

import { useState, useEffect, useCallback } from "react";
import TelegramChatButton from "@/components/shared/TelegramChatButton";
import LocationButtons from "@/components/LocationButtons";
import LiveLocationPanel from "@/components/LiveLocationPanel";
import { Stack } from "@/components/layout";

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

export default function ReceptionPage() {
  const [data, setData] = useState<ReceptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [date, setDate] = useState(() => new Date().toLocaleDateString("sv-SE"));
  const [lastRefresh, setLastRefresh] = useState("");

  const fetchData = useCallback(async (d?: string) => {
    try {
      const target = d ?? date;
      const res = await fetch(`/api/reception/appointments?date=${target}`, {
        credentials: "include",
        cache: "no-store",
      });
      const json = await res.json();
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

  function handleDateChange(d: string) {
    setDate(d);
    setLoading(true);
    fetchData(d);
  }

  async function handlePaymentAction(
    appointmentId: string,
    action: "paid" | "unpaid" | "cancel"
  ) {
    if (action === "cancel" && !confirm("Bronni butunlay bekor qilishni tasdiqlaysizmi?")) return;
    setActionLoading(appointmentId);
    try {
      const res = await fetch(`/api/reception/appointments/${appointmentId}/payment`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
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
                    onPaid={() => handlePaymentAction(appt.id, "paid")}
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
                    onUnpaid={() => handlePaymentAction(appt.id, "unpaid")}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

// ── Kartochka komponenti ────────────────────────────────────────────────────────

interface CardProps {
  appt: ReceptionAppointment;
  loading: boolean;
  section: "pending" | "paid";
  onPaid?: () => void;
  onUnpaid?: () => void;
  onCancel?: () => void;
}

function ReceptionCard({ appt, loading, section, onPaid, onUnpaid, onCancel }: CardProps) {
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
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium flex-shrink-0">
                ✅ To'langan
              </span>
            )}
          </div>

          <div className="mt-1.5 text-xs text-gray-600 space-y-0.5">
            <p>🏷 {appt.service?.name ?? "—"}{appt.service?.price ? ` · ${appt.service.price.toLocaleString()} so'm` : ""}</p>
            {appt.doctor && <p>👨‍⚕️ {appt.doctor.name}{appt.doctor.specialty ? ` (${appt.doctor.specialty})` : ""}</p>}
            {appt.address && <p className="text-orange-500">📍 {appt.address}</p>}
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
      <div className="flex gap-2 mt-3">
        {section === "pending" && (
          <>
            <button
              onClick={onPaid}
              disabled={loading}
              className="flex-1 px-3 py-2 min-h-[44px] bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              {loading ? "..." : "💰 To'ladi"}
            </button>
            <button
              onClick={onCancel}
              disabled={loading}
              className="px-3 py-2 min-h-[44px] bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-600 rounded-lg text-sm transition-colors"
            >
              Bekor
            </button>
          </>
        )}
        {section === "paid" && (
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
