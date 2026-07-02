"use client";
import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

const roleRedirects: Record<string, string> = {
  super_admin: "/superadminjon",
  clinic_admin: "/admin",
  branch_admin: "/admin",
  doctor: "/doctor",
  receptionist: "/reception",
};

interface PendingUser {
  id: string;
  role: string;
  clinicId: string | null;
  branchId: string | null;
  firstName: string;
}

type AnimLevel = "full" | "low" | "off";
const ANIM_ORDER: AnimLevel[] = ["full", "low", "off"];
const ANIM_LABEL: Record<AnimLevel, string> = {
  full: "Animatsiya: to'liq",
  low: "Animatsiya: past",
  off: "Animatsiya: o'chiq",
};

function HeartPulseIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      <path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27" />
    </svg>
  );
}
function SparklesIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
      <path d="M5 3v4M19 17v4M3 5h4M17 19h4" />
    </svg>
  );
}
function GoogleIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/>
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"/>
      <path fill="#EA4335" d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.46 14.97.5 12 .5A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 4.75 12 4.75Z"/>
    </svg>
  );
}

function AuroraBackground() {
  return (
    <div className="aurora-layer" aria-hidden="true">
      <div className="aurora-blob" style={{ width: "55vmax", height: "55vmax", top: "-10%", left: "-10%", background: "radial-gradient(circle, #a855f7 10%, #7c3aed 40%, transparent 70%)" }} />
      <div className="aurora-blob" style={{ width: "50vmax", height: "50vmax", top: "15%", right: "-12%", background: "radial-gradient(circle, #60a5fa 10%, #3b82f6 40%, transparent 70%)", animationDelay: "-6s" }} />
      <div className="aurora-blob" style={{ width: "45vmax", height: "45vmax", bottom: "-12%", left: "20%", background: "radial-gradient(circle, #f472b6 10%, #db2777 40%, transparent 70%)", animationDelay: "-12s" }} />
    </div>
  );
}

function Starfield() {
  const stars = Array.from({ length: 60 }, (_, i) => ({
    left: `${((i * 61.803) % 100).toFixed(2)}%`,
    top:  `${((i * 137.508) % 100).toFixed(2)}%`,
    size: i % 7 === 0 ? 2.5 : i % 3 === 0 ? 2 : 1.5,
    dur:  `${(2 + (i % 7) * 0.4).toFixed(1)}s`,
    delay:`${(i % 9 * 0.45).toFixed(2)}s`,
  }));
  const shots = [
    { top: "8%",  left: "5%",   w: 110, delay: "0s"    },
    { top: "14%", left: "55%",  w: 85,  delay: "-0.6s" },
    { top: "6%",  left: "40%",  w: 80,  delay: "-1.5s" },
    { top: "5%",  left: "28%",  w: 95,  delay: "-2s"   },
    { top: "22%", left: "8%",   w: 70,  delay: "-3.5s" },
    { top: "10%", left: "44%",  w: 90,  delay: "-3.8s" },
    { top: "32%", left: "68%",  w: 65,  delay: "-4.1s" },
    { top: "4%",  left: "78%",  w: 80,  delay: "-5.5s" },
    { top: "20%", left: "32%",  w: 100, delay: "-6s"   },
    { top: "38%", left: "15%",  w: 70,  delay: "-6.3s" },
    { top: "12%", left: "62%",  w: 85,  delay: "-1s"   },
    { top: "28%", left: "82%",  w: 65,  delay: "-7.2s" },
  ];
  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {stars.map((s, i) => (
        <span key={i} className="star absolute rounded-full bg-white"
          style={{ left: s.left, top: s.top, width: s.size, height: s.size, ["--tw" as string]: s.dur, animationDelay: s.delay }} />
      ))}
      {shots.map((sh, i) => (
        <span key={`sh${i}`} className="shooting absolute h-px bg-gradient-to-r from-white to-transparent"
          style={{ top: sh.top, left: sh.left, width: sh.w, animationDelay: sh.delay }} />
      ))}
    </div>
  );
}

interface LoginFormInnerProps {
  mode?: "staff" | "super";
  onSuperRedirect?: () => void;
  onLoginSuccess?: (user: PendingUser) => void;
  subtitle?: string;
  iconColor?: string;
  gradientFrom?: string;
  gradientTo?: string;
  // T4 fix: RootPage EM-tasdiqlanmagan xodimni to'g'ridan-to'g'ri EM bosqichida ochishi uchun
  initialStep?: "login" | "em";
  emPendingUser?: PendingUser | null;
}

function LoginFormInner({
  mode = "staff",
  onSuperRedirect,
  onLoginSuccess,
  subtitle = "Tizimga kirish",
  iconColor = "from-violet-500/30 to-blue-500/30",
  gradientFrom = "from-violet-500",
  gradientTo = "to-blue-500",
  initialStep = "login",
  emPendingUser = null,
}: LoginFormInnerProps) {
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl");
  const [step, setStep] = useState<"login" | "em">(initialStep);
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [emInput, setEmInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingUser, setPendingUser] = useState<PendingUser | null>(emPendingUser);
  const [anim, setAnim] = useState<AnimLevel>("full");

  useEffect(() => {
    const saved = localStorage.getItem("login_anim") as AnimLevel | null;
    if (saved && ANIM_ORDER.includes(saved)) {
      setAnim(saved);
    } else if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setAnim("low");
    }
  }, []);

  function cycleAnim() {
    const next = ANIM_ORDER[(ANIM_ORDER.indexOf(anim) + 1) % ANIM_ORDER.length];
    setAnim(next);
    localStorage.setItem("login_anim", next);
  }

  async function handleLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: form.identifier, password: form.password, mode }),
      });
      const json = await res.json();
      if (!json.success) {
        const msg = typeof json.error === "object"
          ? (json.error?.message || "Login yoki parol noto'g'ri")
          : (json.error || "Login yoki parol noto'g'ri");
        setError(msg);
        return;
      }
      if (json.data?.redirectToSuper) {
        if (onSuperRedirect) {
          onSuperRedirect();
        } else {
          window.location.href = "/superadminjon";
        }
        return;
      }
      const { user, needsEmVerify } = json.data;
      localStorage.setItem("user_role", user.role);
      localStorage.setItem("user_name", user.firstName);
      if (user.clinicId) localStorage.setItem("clinicId", user.clinicId);
      if (user.branchId) localStorage.setItem("branchId", user.branchId);
      else localStorage.removeItem("branchId");

      if (needsEmVerify) {
        setPendingUser(user);
        setStep("em");
        if (onLoginSuccess) onLoginSuccess(user);
      } else {
        const home = roleRedirects[user.role] || "/";
        const dest = returnUrl && returnUrl.startsWith(home) ? returnUrl : home;
        window.location.href = dest;
      }
    } catch {
      setError("Server bilan bog'lanishda xatolik");
    } finally {
      setLoading(false);
    }
  }

  async function handleEmSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-em", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emId: emInput }),
      });
      const json = await res.json();
      if (!json.success) {
        setError("Xodim ID raqami noto'g'ri");
        return;
      }
      const role = pendingUser!.role;
      const home = roleRedirects[role] || "/";
      window.location.href = returnUrl && returnUrl.startsWith(home) ? returnUrl : home;
    } catch {
      setError("Server bilan bog'lanishda xatolik");
    } finally {
      setLoading(false);
    }
  }

  const glass =
    "relative z-10 w-full max-w-md rounded-3xl border border-white/25 bg-white/[0.04] " +
    "backdrop-blur-md " +
    "shadow-[0_8px_48px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.3)] " +
    "p-7 sm:p-9";
  const field =
    "w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-base text-white " +
    "placeholder-white/40 outline-none transition focus:border-white/50 focus:bg-white/15 " +
    "focus:ring-2 focus:ring-white/20 min-h-[48px]";
  const label = "block text-sm font-medium text-white/80 mb-1.5";
  const primaryBtn =
    `w-full min-h-[48px] rounded-xl bg-gradient-to-r ${gradientFrom} ${gradientTo} px-4 py-3 ` +
    "text-base font-semibold text-white shadow-lg transition hover:opacity-90 " +
    "active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className={`anim-${anim} relative min-h-screen overflow-hidden flex items-center justify-center p-4`}
      style={{ background: "linear-gradient(160deg, #0b1026 0%, #1a103a 45%, #0d1430 100%)" }}>
      <AuroraBackground />
      <Starfield />

      <div className={glass}>
        <button type="button" onClick={cycleAnim} title={ANIM_LABEL[anim]} aria-label={ANIM_LABEL[anim]}
          className="absolute right-4 top-4 z-20 rounded-full border border-white/15 bg-white/10 p-2 text-white/70 transition hover:text-white hover:bg-white/20">
          <SparklesIcon className="h-4 w-4" />
        </button>

        <div className="mb-7 text-center">
          <div className={`mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${iconColor} border border-white/15`}>
            <HeartPulseIcon className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">TibTaqvim</h1>
          <p className="mt-1 text-sm text-white/60">
            {step === "login" ? subtitle : `Salom, ${pendingUser?.firstName || ""}!`}
          </p>
        </div>

        {step === "login" ? (
          <form onSubmit={handleLoginSubmit} className="space-y-5">
            <div>
              <label className={label}>Login yoki telefon</label>
              <input type="text" className={field} placeholder="Login yoki +998 90 123 45 67"
                value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })}
                autoComplete="username" required autoFocus />
            </div>
            <div>
              <label className={label}>Parol</label>
              <input type="password" className={field} placeholder="Parolingiz"
                value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete="current-password" required />
            </div>

            {error && (
              <div role="alert" className="rounded-xl border border-red-400/30 bg-red-500/15 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className={primaryBtn}>
              {loading ? "Kirilmoqda…" : "Kirish"}
            </button>

            {mode === "staff" && (
              <>
                <button type="button" disabled title="Tez orada"
                  className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-medium text-white/50 cursor-not-allowed">
                  <GoogleIcon className="h-5 w-5" />
                  Google orqali kirish
                  <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/50">tez orada</span>
                </button>

                <p className="pt-1 text-center text-xs text-white/40">
                  Parolni unutdingizmi? Administratorga murojaat qiling.
                </p>
              </>
            )}
          </form>
        ) : (
          <form onSubmit={handleEmSubmit} className="space-y-5">
            <div>
              <label className={label}>Xodim ID raqami</label>
              <input type="text"
                className={`${field} text-center font-mono text-lg tracking-[0.3em] uppercase`}
                placeholder="EM000001" value={emInput}
                onChange={(e) => setEmInput(e.target.value.toUpperCase())}
                required autoFocus autoComplete="off" inputMode="text" />
              <p className="mt-1.5 text-xs text-white/40">
                Admin bergan EM raqamingizni kiriting (masalan: EM000015).
              </p>
            </div>

            {error && (
              <div role="alert" className="rounded-xl border border-red-400/30 bg-red-500/15 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading || !emInput} className={primaryBtn}>
              {loading ? "Tekshirilmoqda…" : "Tasdiqlash"}
            </button>
            <button type="button"
              onClick={() => { setStep("login"); setError(""); setEmInput(""); }}
              className="w-full py-2 text-sm text-white/50 transition hover:text-white/80">
              ← Orqaga
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function LoginForm(props: LoginFormInnerProps) {
  return (
    <Suspense>
      <LoginFormInner {...props} />
    </Suspense>
  );
}
