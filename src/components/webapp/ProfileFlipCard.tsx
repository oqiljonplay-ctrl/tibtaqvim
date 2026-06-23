"use client";
import { useState, useRef, useLayoutEffect, useEffect } from "react";
import { UZ_REGIONS, getDistricts } from "@/lib/uz-regions";
import { normalizePhone } from "@/lib/utils/phone";

const BOT_USERNAME = process.env.NEXT_PUBLIC_BOT_USERNAME || "tibtaqvim_bot";

/** Matnni konteynerga bir qatorga sig'dirish: maxPx dan minPx gacha kichraytiradi.
 *  minPx da ham sig'masa — CSS ellipsis ("…") ishlaydi. */
function useAutoFitText(text: string, maxPx = 18, minPx = 14, stepPx = 0.5) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      let s = maxPx;
      el.style.fontSize = `${s}px`;
      let guard = 0;
      while (s > minPx && el.scrollWidth > el.clientWidth && guard < 40) {
        s -= stepPx;
        el.style.fontSize = `${s}px`;
        guard++;
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, maxPx, minPx, stepPx]);
  return ref;
}

interface ProfileData {
  firstName: string;
  lastName: string | null;
  fatherName: string | null;
  region: string | null;
  district: string | null;
  phone: string | null;
  tibId: string | null;
}

interface Props {
  profile: ProfileData;
  telegramId: string;
  headerDate: string;
  onUpdated: (updated: Partial<ProfileData>) => void;
  onPhoneAdded?: (phone: string) => void;
}

export function ProfileFlipCard({ profile, telegramId, headerDate, onUpdated, onPhoneAdded }: Props) {
  const [flipped, setFlipped] = useState(false);

  // Phone ulash state
  const [showPhoneInput, setShowPhoneInput] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [pollingForPhone, setPollingForPhone] = useState(false);
  const pollingRef = useRef(false);

  // Form state
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName ?? "");
  const [fatherName, setFatherName] = useState(profile.fatherName ?? "");
  const [region, setRegion] = useState(profile.region ?? "");
  const [district, setDistrict] = useState(profile.district ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  // Ref bilan container balandligini dinamik hisoblash
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(0);

  useLayoutEffect(() => {
    // useLayoutEffect — browser paint OLDIN ishlaydi → miltillash yo'q
    // Aktiv yuz (flipped → back, aks holda front) scrollHeight ni oladi
    const el = flipped ? backRef.current : frontRef.current;
    if (el) setContainerHeight(el.scrollHeight);
  }, [flipped, region]); // region o'zgarganda tuman dropdown balandlikni o'zgartiradi

  const districts = getDistricts(region);

  const displayName = [profile.firstName, profile.lastName, profile.fatherName]
    .filter(Boolean)
    .join(" ");

  const addressText = [profile.district, profile.region].filter(Boolean).join(", ");
  const nameRef = useAutoFitText(displayName, 18, 14, 0.5);

  async function savePhone(phone: string, tgFirstName?: string) {
    setPhoneSaving(true);
    setPhoneError(null);
    try {
      const body: Record<string, string> = { telegramId, phone };
      if (tgFirstName && tgFirstName.length >= 2) body.firstName = tgFirstName;
      const res = await fetch("/api/webapp/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setPhoneError(data.error ?? "Saqlashda xato");
        return;
      }
      setShowPhoneInput(false);
      setPhoneInput("");
      onUpdated({ phone: data.data.phone, firstName: data.data.firstName });
      onPhoneAdded?.(data.data.phone);
      // first_name pre-fill: ORQA tomondagi forma
      if (tgFirstName && tgFirstName.length >= 2) setFirstName(tgFirstName);
    } catch {
      setPhoneError("Tarmoq xatosi");
    } finally {
      setPhoneSaving(false);
    }
  }

  async function pollForPhone() {
    pollingRef.current = true;
    setPollingForPhone(true);
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      if (!pollingRef.current) return;
      try {
        const res = await fetch(`/api/user/by-telegram?telegramId=${telegramId}`);
        const data = await res.json();
        if (data?.data?.phone) {
          pollingRef.current = false;
          setPollingForPhone(false);
          onUpdated({ phone: data.data.phone, firstName: data.data.firstName });
          onPhoneAdded?.(data.data.phone);
          return;
        }
      } catch {}
    }
    // 30 soniya otti, hali ham yo'q → qo'lda kiritish
    if (pollingRef.current) {
      pollingRef.current = false;
      setPollingForPhone(false);
      setShowPhoneInput(true);
    }
  }

  function cancelPolling() {
    pollingRef.current = false;
    setPollingForPhone(false);
    setShowPhoneInput(true);
  }

  function handleRequestContact() {
    const tg = (window as any).Telegram?.WebApp;

    // 1-yo'l: requestContact (Telegram v6.9+, yanvar 2024)
    if (typeof tg?.requestContact === "function") {
      try {
        tg.requestContact((result: any) => {
          const isSent = result === true || result?.status === "sent";
          const phone =
            result?.contact?.phone_number ??
            tg.responseUnsafe?.contact?.phone_number ??
            "";
          const firstName =
            result?.contact?.first_name ??
            tg.responseUnsafe?.contact?.first_name ??
            "";

          if (isSent && phone) {
            const norm = normalizePhone(phone);
            if (norm) { savePhone(norm, firstName); } else { setShowPhoneInput(true); }
          } else if (isSent) {
            // Bot webhook orqali oladi → polling
            pollForPhone();
          }
          // user bekor qildi → hech narsa qilmaymiz
        });
        return;
      } catch {}
    }

    // 2-yo'l: openTelegramLink (Bot API 6.1+, iyun 2022) — eski Telegram uchun
    if (typeof tg?.openTelegramLink === "function") {
      tg.openTelegramLink(`https://t.me/${BOT_USERNAME}?start=share_phone`);
      pollForPhone();
      return;
    }

    // 3-yo'l: so'nggi chora — qo'lda kiritish
    setShowPhoneInput(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!firstName.trim()) { setSaveError("Ism bo'sh bo'lmasin"); return; }
    setSaving(true);
    setSaveError(null);
    setSaveOk(false);
    try {
      const res = await fetch("/api/webapp/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telegramId,
          firstName: firstName.trim(),
          lastName: lastName.trim() || null,
          fatherName: fatherName.trim() || null,
          region: region || null,
          district: district || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setSaveError(data.error ?? "Saqlashda xato"); return; }
      setSaveOk(true);
      onUpdated({
        firstName: data.data.firstName,
        lastName: data.data.lastName,
        fatherName: data.data.fatherName,
        region: data.data.region,
        district: data.data.district,
      });
      setTimeout(() => { setSaveOk(false); setFlipped(false); }, 700);
    } catch {
      setSaveError("Tarmoq xatosi");
    } finally {
      setSaving(false);
    }
  }

  // backfaceVisibility: "hidden" — 3D flip uchun
  const faceBase: React.CSSProperties = {
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
    width: "100%",
  };

  return (
    // perspective konteyner — balandlikni aktiv yuzga mos qil
    <div className="rounded-2xl overflow-hidden" style={{ perspective: "1200px" }}>
      <div
        style={{
          position: "relative",
          transformStyle: "preserve-3d",
          transition: "transform 0.6s ease, height 0.45s ease",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          height: containerHeight || undefined,
        }}
      >
        {/* ── FRONT YUZ — compact profil (3 qator) ── */}
        <div
          ref={frontRef}
          style={{ ...faceBase, position: "absolute", top: 0, left: 0 }}
          className="bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-2xl px-4 py-3"
        >
          {/* TEPA QATOR: chap bo'sh (avatar joyi), o'ng — sana + (ID + qalam) */}
          <div className="flex items-start justify-between gap-2">
            {/* avatar joyi — keyinchalik qo'shiladi */}
            <div aria-hidden className="min-w-0 flex-1" />

            {/* o'ng: sana ID ustida, ostida ID badge + qalam */}
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className="text-[11px] leading-none text-white/80">{headerDate}</span>
              <div className="flex items-center gap-2">
                {profile.tibId && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-white/20 rounded-full px-2 py-0.5 whitespace-nowrap">
                    🆔 {profile.tibId}
                  </span>
                )}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setFlipped(true); }}
                  aria-label="Profilni tahrirlash"
                  className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-sm leading-none"
                >
                  ✏️
                </button>
              </div>
            </div>
          </div>

          {/* 1-QATOR: to'liq ism — bitta qator, auto-fit, ortib ketsa "…" */}
          <div className="mt-1.5">
            <span
              ref={nameRef}
              className="block w-full font-bold leading-tight whitespace-nowrap overflow-hidden text-ellipsis"
              style={{ fontSize: 18 }}
            >
              {displayName || "Foydalanuvchi"}
            </span>
          </div>

          {/* 2-QATOR: telefon va manzil (yoki telefon ulash UI) */}
          <div className="mt-0.5">
            {profile.phone ? (
              <div className="flex items-center gap-2 text-xs text-white/90 min-w-0">
                <span className="shrink-0">📞 {profile.phone}</span>
                {addressText && (
                  <>
                    <span className="text-white/50">·</span>
                    <span className="truncate">📍 {addressText}</span>
                  </>
                )}
              </div>
            ) : pollingForPhone ? (
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <span className="text-xs text-white/80 animate-pulse">⏳ Botda tasdiqlang...</span>
                <button onClick={cancelPolling} className="text-xs text-white/60 underline">
                  Qo&apos;lda kiritish
                </button>
              </div>
            ) : showPhoneInput ? (
              <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                <input
                  type="tel"
                  className="w-full bg-white/20 text-white placeholder-blue-300 rounded-xl px-3 py-2 text-sm
                             border border-white/30 focus:outline-none focus:border-white/60"
                  placeholder="+998 90 123 45 67"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  autoFocus
                />
                {phoneError && (
                  <p className="text-red-300 text-xs">{phoneError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const normalized = normalizePhone(phoneInput);
                      if (normalized) {
                        savePhone(normalized);
                      } else {
                        setPhoneError("Telefon formati noto'g'ri (+998XXXXXXXXX)");
                      }
                    }}
                    disabled={phoneSaving || phoneInput.trim().length < 9}
                    className="flex-1 bg-white text-blue-700 font-semibold text-xs py-2 rounded-xl
                               disabled:opacity-50 active:scale-95 transition-all"
                  >
                    {phoneSaving ? "Saqlanmoqda..." : "Saqlash"}
                  </button>
                  <button
                    onClick={() => { setShowPhoneInput(false); setPhoneError(null); setPhoneInput(""); }}
                    className="px-3 py-2 text-white/70 text-xs rounded-xl bg-white/10"
                  >
                    Bekor
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); handleRequestContact(); }}
                className="flex items-center gap-1.5 text-xs bg-white/20 hover:bg-white/30
                           text-white px-3 py-1.5 rounded-full active:scale-95 transition-all"
              >
                📞 Telefon ulash
              </button>
            )}
          </div>
        </div>

        {/* ── ORQA: Tahrirlash formasi ── */}
        <div
          ref={backRef}
          style={{
            ...faceBase,
            position: "absolute",
            top: 0,
            left: 0,
            transform: "rotateY(180deg)",
          }}
          className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl pt-5 pb-7 px-4"
        >
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={(e) => { e.stopPropagation(); setFlipped(false); }}
              className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center text-sm hover:bg-white/30 transition-all shrink-0"
              aria-label="Orqaga"
            >
              ←
            </button>
            <p className="text-white font-semibold text-sm">Profilni tahrirlash</p>
          </div>

          <form onSubmit={handleSave} className="space-y-2.5">
            <div>
              <label className="text-blue-200 text-xs mb-1 block">Ism *</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.stopPropagation()}
                className="w-full bg-white/15 border border-white/30 rounded-xl px-3 py-2.5 text-white placeholder-blue-300 text-sm focus:outline-none focus:border-white/60"
                placeholder="Ismingiz"
                required
              />
            </div>

            <div>
              <label className="text-blue-200 text-xs mb-1 block">Familiya</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.stopPropagation()}
                className="w-full bg-white/15 border border-white/30 rounded-xl px-3 py-2.5 text-white placeholder-blue-300 text-sm focus:outline-none focus:border-white/60"
                placeholder="Familiyangiz"
              />
            </div>

            <div>
              <label className="text-blue-200 text-xs mb-1 block">Otasining ismi</label>
              <input
                type="text"
                value={fatherName}
                onChange={(e) => setFatherName(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.stopPropagation()}
                className="w-full bg-white/15 border border-white/30 rounded-xl px-3 py-2.5 text-white placeholder-blue-300 text-sm focus:outline-none focus:border-white/60"
                placeholder="Otangizning ismi"
              />
            </div>

            <div>
              <label className="text-blue-200 text-xs mb-1 block">Viloyat</label>
              <select
                value={region}
                onChange={(e) => { setRegion(e.target.value); setDistrict(""); }}
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.stopPropagation()}
                className="w-full border border-white/30 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-white/60 appearance-none"
                style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
              >
                <option value="" style={{ color: "#1e3a5f" }}>— Tanlang —</option>
                {UZ_REGIONS.map((r) => (
                  <option key={r.name} value={r.name} style={{ color: "#1e3a5f" }}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            {region && districts.length > 0 && (
              <div>
                <label className="text-blue-200 text-xs mb-1 block">Tuman / Shahar</label>
                <select
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => e.stopPropagation()}
                  className="w-full border border-white/30 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-white/60 appearance-none"
                  style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
                >
                  <option value="" style={{ color: "#1e3a5f" }}>— Tanlang —</option>
                  {districts.map((d) => (
                    <option key={d} value={d} style={{ color: "#1e3a5f" }}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {saveError && (
              <p className="text-red-200 text-xs bg-red-500/20 rounded-lg px-3 py-2">{saveError}</p>
            )}

            <button
              type="submit"
              disabled={saving}
              onClick={(e) => e.stopPropagation()}
              className="w-full py-2.5 rounded-xl text-sm font-semibold bg-white text-blue-700 hover:bg-blue-50 active:scale-95 transition-all disabled:opacity-60 mt-1"
            >
              {saving ? "Saqlanmoqda..." : saveOk ? "✅ Saqlandi!" : "💾 Saqlash"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
