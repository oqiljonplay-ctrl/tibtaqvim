"use client";
import { useState, useEffect } from "react";
import { StarRating } from "./StarRating";

// Modes with payment button placeholder (extend when real API is ready)
const PAYMENT_ENABLED_MODES = ["online"];

// ─── Types ────────────────────────────────────────────────────────────────────

interface DocData {
  id: string;
  firstName: string;
  lastName: string;
  specialty: string;
  photoUrl?: string | null;
  workSchedule?: string | null;
  education?: string | null;
  position?: string | null;
  department?: string | null;
  operationsCount?: number | null;
  bio?: string | null;
  specialties?: { name: string }[];
  directions?: { name: string }[];
  experiences?: { place: string; startYear: number; endYear: number | null }[];
  workplaces?: { place: string }[];
}

export interface BookingAppt {
  id: string;
  clinicId: string;
  serviceId: string;
  service: { name: string; type: string };
  date: string;
  status: string;
  dependentId?: string | null;
  queueNumber?: number | null;
  queueMode?: string | null;
  slot?: { startTime: string; endTime: string } | null;
  doctor?: DocData | null;
  doctorRating?: number | null;
  doctorRatingCount?: number | null;
  myStars?: number | null;
  myRatingId?: string | null;
  canRate?: boolean;
  canEditRating?: boolean;
}

interface Props {
  appointment: BookingAppt;
  onRebook: (serviceId: string) => void;
  onCancel: (appointmentId: string) => void;
  cancellingId?: string | null;
  telegramId?: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_EMOJI: Record<string, string> = {
  doctor_queue: "👨‍⚕️", diagnostic: "🔬", home_service: "🏠",
};

const STATUS_LABEL: Record<string, string> = {
  booked: "Kutilmoqda",
  arrived: "Keldi",
  missed: "Kelmadi",
  cancelled: "Bekor",
  expired: "Muddati o'tdi",
};

const STATUS_CLS: Record<string, string> = {
  booked:    "bg-green-50 text-green-800 border border-green-200",
  arrived:   "bg-blue-50 text-blue-700 border border-blue-200",
  missed:    "bg-red-50 text-red-700 border border-red-200 opacity-80",
  cancelled: "bg-gray-100 text-gray-500 border border-gray-200 line-through",
  expired:   "bg-yellow-50 text-yellow-700 border border-yellow-200",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("uz-UZ", {
    day: "numeric", month: "long", year: "numeric",
  });
}

function Avatar({ doc, size = 88 }: { doc: DocData; size?: number }) {
  if (doc.photoUrl) {
    return (
      <img
        src={doc.photoUrl}
        alt=""
        className="rounded-xl object-cover border border-gray-200 shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <span className="text-white font-bold" style={{ fontSize: Math.round(size * 0.27) }}>
        {doc.firstName[0]}{doc.lastName[0]}
      </span>
    </div>
  );
}

function BackField({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="bg-white/10 rounded-xl px-3 py-2.5">
      <p className="text-blue-200 text-xs mb-0.5">{icon} {label}</p>
      <p className="text-white text-sm font-medium leading-snug">{value}</p>
    </div>
  );
}

function ChipList({ icon, label, items }: { icon: string; label: string; items: string[] }) {
  return (
    <div className="bg-white/10 rounded-xl px-3 py-2.5">
      <p className="text-blue-200 text-xs mb-1.5">{icon} {label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item, i) => (
          <span key={i} className="bg-white/20 text-white text-xs px-2.5 py-1 rounded-full">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BookingFlipCard({ appointment: a, onRebook, onCancel, cancellingId, telegramId }: Props) {
  const [flipped, setFlipped] = useState(false);
  const [paymentNotice, setPaymentNotice] = useState(false);
  const [fullDoc, setFullDoc] = useState<DocData | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const doc = a.doctor;

  // Rating state
  const [ratingOpen, setRatingOpen] = useState(!!a.canRate);
  const [ratingStars, setRatingStars] = useState(0);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [ratingDone, setRatingDone] = useState(false);
  const [ratingThanks, setRatingThanks] = useState(false);
  const [currentRating, setCurrentRating] = useState<number | null>(a.doctorRating ?? null);
  const [currentRatingCount, setCurrentRatingCount] = useState<number | null>(a.doctorRatingCount ?? null);
  const [myStars, setMyStars] = useState<number | null>(a.myStars ?? null);
  const [myRatingId] = useState<string | null>(a.myRatingId ?? null);
  const canEdit = !!(a.canEditRating && myStars !== null);

  useEffect(() => {
    if (!ratingThanks) return;
    const t = setTimeout(() => setRatingThanks(false), 2000);
    return () => clearTimeout(t);
  }, [ratingThanks]);

  async function submitRating() {
    if (ratingStars === 0 || ratingSubmitting) return;
    setRatingSubmitting(true);
    setRatingError(null);
    try {
      const body = JSON.stringify({ telegramId, appointmentId: a.id, stars: ratingStars });
      const res = await fetch("/api/ratings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const json = await res.json();
      if (json.success || json.ok) {
        setRatingOpen(false);
        setRatingDone(true);
        setRatingThanks(true);
        setMyStars(ratingStars);
        if (json.data?.compositeRating != null || json.compositeRating != null) {
          setCurrentRating(json.data?.compositeRating ?? json.compositeRating);
        }
        if (json.data?.ratingCount != null || json.ratingCount != null) {
          setCurrentRatingCount(json.data?.ratingCount ?? json.ratingCount);
        }
      } else {
        setRatingError(json.error?.message || "Xatolik yuz berdi");
      }
    } catch {
      setRatingError("Server bilan bog'lanishda xatolik");
    } finally {
      setRatingSubmitting(false);
    }
  }

  async function updateRating() {
    if (ratingStars === 0 || ratingSubmitting || !myRatingId) return;
    setRatingSubmitting(true);
    setRatingError(null);
    try {
      const res = await fetch(`/api/ratings/${myRatingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegramId, stars: ratingStars }),
      });
      const json = await res.json();
      if (json.success || json.ok) {
        setRatingOpen(false);
        setMyStars(ratingStars);
        if (json.data?.compositeRating != null || json.compositeRating != null) {
          setCurrentRating(json.data?.compositeRating ?? json.compositeRating);
        }
      } else {
        setRatingError(json.error?.message || "Xatolik yuz berdi");
      }
    } catch {
      setRatingError("Server bilan bog'lanishda xatolik");
    } finally {
      setRatingSubmitting(false);
    }
  }

  useEffect(() => {
    if (!paymentNotice) return;
    const t = setTimeout(() => setPaymentNotice(false), 3000);
    return () => clearTimeout(t);
  }, [paymentNotice]);

  async function handleFlip() {
    setFlipped(true);
    if (!doc || fullDoc) return;
    setProfileLoading(true);
    try {
      const res = await fetch(`/api/webapp/doctor/${doc.id}?clinicId=${a.clinicId}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) setFullDoc(json.data);
      }
    } finally {
      setProfileLoading(false);
    }
  }

  const displayDoc = fullDoc ?? doc;
  const hasProfile = !!(displayDoc && (
    displayDoc.education || displayDoc.position || displayDoc.department || displayDoc.bio ||
    (displayDoc.specialties?.length ?? 0) > 0 ||
    (displayDoc.directions?.length ?? 0) > 0 ||
    (displayDoc.experiences?.length ?? 0) > 0 ||
    (displayDoc.workplaces?.length ?? 0) > 0 ||
    (displayDoc.operationsCount ?? 0) > 0
  ));

  const frontStyle: React.CSSProperties = {
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
  };

  const backStyle: React.CSSProperties = {
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
    transform: "rotateY(180deg)",
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    overflowY: "auto",
  };

  return (
    <div style={{ perspective: "1200px" }} className="w-full">
      {/* Flipper — transform-style: preserve-3d, front is relative (sets height) */}
      <div
        style={{
          position: "relative",
          transformStyle: "preserve-3d",
          transition: "transform 0.65s ease",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >

        {/* ── OLD TOMON: relative → container balandligini belgilaydi ── */}
        <div
          style={frontStyle}
          onClick={doc ? () => handleFlip() : undefined}
          className={`relative bg-white rounded-2xl shadow-sm border border-gray-100 p-4 transition-transform${doc ? " cursor-pointer active:scale-[0.99]" : ""}`}
        >
          {/* Flip tugmasi — shifokor bo'lsa har doim ko'rsatiladi */}
          {doc && (
            <button
              onClick={(e) => { e.stopPropagation(); handleFlip(); }}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center text-sm hover:bg-blue-100 active:scale-95 transition-all z-10"
              title="Shifokor haqida"
            >
              ℹ️
            </button>
          )}

          {/* Xizmat + sana */}
          <div className="flex items-center gap-2.5 mb-3 pr-10">
            <span className="text-xl shrink-0">{TYPE_EMOJI[a.service.type] ?? "🏥"}</span>
            <div>
              <p className="font-semibold text-gray-900 text-sm">{a.service.name}</p>
              <p className="text-xs text-gray-400">{fmtDate(a.date)}</p>
            </div>
          </div>

          {/* Ish vaqti */}
          {doc?.workSchedule && (
            <p className="text-xs text-gray-500 mb-2">🕐 {doc.workSchedule}</p>
          )}

          {/* Navbat raqami (online/slot rejim) */}
          {a.queueNumber && a.queueMode !== "live" && (
            <div className="bg-blue-50 rounded-xl px-4 py-2.5 text-center mb-3">
              <p className="text-xs text-blue-500 mb-0.5">Navbat raqami</p>
              <p className="text-3xl font-bold text-blue-600">#{a.queueNumber}</p>
            </div>
          )}

          {/* Kunlik ro'yxat (live rejim) */}
          {a.queueMode === "live" && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-center mb-3">
              <p className="text-xs font-semibold text-amber-800">💵 Kunlik ro'yxatga kirish</p>
              <p className="text-xs text-amber-600 mt-0.5">Klinikada kassadan jonli navbat oling</p>
            </div>
          )}

          {/* Slot vaqti */}
          {a.slot && (
            <p className="text-xs text-gray-500 text-center mb-3">
              🕐 {a.slot.startTime} — {a.slot.endTime}
            </p>
          )}

          {/* Shifokor foto + tugmalar */}
          <div className="flex items-start gap-4">
            <div className="shrink-0">
              {doc ? (
                <>
                  <Avatar doc={doc} size={88} />
                  <div className="mt-1.5 text-center" style={{ width: 88 }}>
                    <p className="text-xs text-gray-700 font-medium leading-tight truncate">{doc.specialty}</p>
                    <p className="text-xs text-gray-500 leading-tight truncate">
                      {doc.lastName} {doc.firstName}
                    </p>
                  </div>
                </>
              ) : (
                <div
                  className="rounded-xl bg-gray-100 flex items-center justify-center"
                  style={{ width: 88, height: 88 }}
                >
                  <span className="text-3xl">{TYPE_EMOJI[a.service.type] ?? "🏥"}</span>
                </div>
              )}
            </div>

            <div className="flex-1 flex flex-col gap-2 min-w-0">
              <span
                className={`px-3 py-2 rounded-lg text-xs font-medium text-center ${
                  STATUS_CLS[a.status] ?? "bg-gray-100 text-gray-500 border border-gray-200"
                }`}
              >
                {STATUS_LABEL[a.status] ?? a.status}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); onRebook(a.serviceId); }}
                className="w-full py-2.5 rounded-xl text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 active:scale-95 transition-all"
              >
                🔁 Qayta bron
              </button>
              {a.status === "booked" && (
                <button
                  onClick={(e) => { e.stopPropagation(); onCancel(a.id); }}
                  disabled={cancellingId === a.id}
                  className="w-full py-2.5 rounded-xl text-xs font-medium border border-red-200 text-red-600 hover:bg-red-50 active:scale-95 transition-all disabled:opacity-50"
                >
                  {cancellingId === a.id ? "..." : "❌ Bekor qilish"}
                </button>
              )}
              {/* Payment placeholder — shown for PAYMENT_ENABLED_MODES only */}
              {/* TODO: connect to real Payme/Click API when payments table is ready */}
              {a.status === "booked" && PAYMENT_ENABLED_MODES.includes(a.queueMode ?? "") && (
                <div className="flex gap-1.5 mt-0.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); setPaymentNotice(true); }}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 active:scale-95 transition-all"
                  >
                    💳 Payme
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setPaymentNotice(true); }}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 active:scale-95 transition-all"
                  >
                    💳 Click
                  </button>
                </div>
              )}
              {paymentNotice && (
                <div className="mt-1 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-center">
                  <p className="text-xs text-amber-700 font-medium">🚧 To&apos;lov tizimi tez orada ulanadi</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Doimiy yulduz qatori ── */}
          {currentRating !== null && (
            <div className="mt-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              <StarRating value={currentRating} readOnly size={16} />
              <span className="text-xs text-gray-600 font-medium">
                {currentRating.toFixed(1)}
              </span>
              {currentRatingCount !== null && (
                <span className="text-xs text-gray-400">({currentRatingCount} baho)</span>
              )}
              {canEdit && !ratingOpen && !ratingDone && (
                <button
                  className="text-xs text-blue-500 underline ml-1"
                  onClick={(e) => { e.stopPropagation(); setRatingStars(myStars ?? 0); setRatingOpen(true); }}
                >
                  O'zgartirish
                </button>
              )}
              {ratingThanks && (
                <span className="text-xs text-green-600 font-medium">✓ Rahmat!</span>
              )}
            </div>
          )}

          {/* ── Baholash paneli (grid-rows animatsiya) ── */}
          {a.canRate && !ratingDone && !myStars && (
            <div
              style={{
                display: "grid",
                gridTemplateRows: ratingOpen ? "1fr" : "0fr",
                transition: "grid-template-rows 0.35s ease",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ overflow: "hidden" }}>
                <div className="mt-3 border-t border-gray-100 pt-3 space-y-2">
                  <p className="text-xs font-semibold text-gray-700">Shifokorni baholang</p>
                  <StarRating value={ratingStars} onChange={setRatingStars} size={36} />
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Hurmatli bemor, ushbu baholash faqat ushbu shifokorga taalluqli. Boshqa xizmatlar va xodimlar sababli noxolis baho qo&apos;yishdan ehtiyot bo&apos;ling. Yulduzcha to&apos;liq yonishi uchun ikki marta bosing.
                  </p>
                  {ratingError && (
                    <p className="text-xs text-red-500">{ratingError}</p>
                  )}
                  {ratingStars > 0 && (
                    <button
                      disabled={ratingSubmitting}
                      onClick={() => {
                        if (myRatingId) updateRating();
                        else submitRating();
                      }}
                      className="w-full py-2.5 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {ratingSubmitting ? "Yuborilmoqda..." : myRatingId ? "Saqlash" : "Baholash"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── ORQA TOMON: absolute inset-0, overflow-y-auto ── */}
        <div
          style={backStyle}
          onClick={() => setFlipped(false)}
          className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl shadow-sm p-4 cursor-pointer"
        >
          {/* Header: orqaga tugma + shifokor mini info */}
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={(e) => { e.stopPropagation(); setFlipped(false); }}
              className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center text-sm hover:bg-white/30 transition-all shrink-0"
            >
              ←
            </button>
            {displayDoc && (
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <Avatar doc={displayDoc} size={40} />
                <div className="min-w-0">
                  <p className="text-white font-semibold text-sm truncate">
                    {displayDoc.lastName} {displayDoc.firstName}
                  </p>
                  <p className="text-blue-200 text-xs truncate">{displayDoc.specialty}</p>
                </div>
              </div>
            )}
          </div>

          {/* Profil mazmuni */}
          {profileLoading ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-6 h-6 border-2 border-white/40 border-t-white rounded-full animate-spin mb-3" />
              <p className="text-blue-200 text-xs">Yuklanmoqda...</p>
            </div>
          ) : displayDoc ? (
            hasProfile ? (
              <div className="space-y-3">
                {displayDoc.education && (
                  <BackField icon="🎓" label="Ta'lim" value={displayDoc.education} />
                )}
                {(displayDoc.specialties?.length ?? 0) > 0 && (
                  <ChipList
                    icon="⚕️"
                    label="Mutaxassisliklar"
                    items={displayDoc.specialties!.map((s) => s.name)}
                  />
                )}
                {displayDoc.position && (
                  <BackField icon="🏅" label="Lavozimi" value={displayDoc.position} />
                )}
                {(displayDoc.directions?.length ?? 0) > 0 && (
                  <ChipList
                    icon="🎯"
                    label="Qabul yo'nalishlari"
                    items={displayDoc.directions!.map((d) => d.name)}
                  />
                )}
                {(displayDoc.experiences?.length ?? 0) > 0 && (
                  <div className="bg-white/10 rounded-xl px-3 py-2.5">
                    <p className="text-blue-200 text-xs mb-1.5">⏱ Tajriba</p>
                    <div className="space-y-1.5">
                      {displayDoc.experiences!.map((exp, i) => (
                        <p key={i} className="text-white text-xs leading-snug">
                          🏢 {exp.place} — {exp.startYear}–{exp.endYear ?? "hozir"}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
                {(displayDoc.workplaces?.length ?? 0) > 0 && (
                  <div className="bg-white/10 rounded-xl px-3 py-2.5">
                    <p className="text-blue-200 text-xs mb-1.5">🏥 Ish joylari</p>
                    <div className="space-y-1">
                      {displayDoc.workplaces!.map((w, i) => (
                        <p key={i} className="text-white text-xs">• {w.place}</p>
                      ))}
                    </div>
                  </div>
                )}
                {displayDoc.department && (
                  <BackField icon="🏢" label="Bo'limi" value={displayDoc.department} />
                )}
                {(displayDoc.operationsCount ?? 0) > 0 && (
                  <BackField icon="✂️" label="Operatsiyalar" value={`${displayDoc.operationsCount} ta`} />
                )}
                {displayDoc.bio && (
                  <div className="bg-white/10 rounded-xl px-3 py-2.5">
                    <p className="text-blue-200 text-xs mb-1">ℹ Bio</p>
                    <p className="text-white text-xs leading-relaxed">{displayDoc.bio}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <span className="text-4xl mb-3">📋</span>
                <p className="text-white/90 text-sm font-medium">
                  Shifokor hali ma'lumot kiritmagan
                </p>
                <p className="text-blue-200 text-xs mt-1.5 max-w-[180px] mx-auto leading-relaxed">
                  Profil to'ldirilganda bu yerda ko'rsatiladi
                </p>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <span className="text-4xl mb-3">👨‍⚕️</span>
              <p className="text-white/80 text-sm">Shifokor ma'lumotlari topilmadi</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
