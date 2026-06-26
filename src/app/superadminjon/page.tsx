"use client";
import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

type AnimLevel = "full" | "low" | "off";
const ANIM_ORDER: AnimLevel[] = ["full", "low", "off"];
const ANIM_LABEL: Record<AnimLevel, string> = {
  full: "Animatsiya: to'liq",
  low: "Animatsiya: past",
  off: "Animatsiya: o'chiq",
};

function ShieldIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
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

function AuroraBackground() {
  return (
    <div className="aurora-layer" aria-hidden="true">
      <div className="aurora-blob" style={{ width: "55vmax", height: "55vmax", top: "-10%", left: "-10%", background: "radial-gradient(circle, #4f46e5 10%, #3730a3 40%, transparent 70%)" }} />
      <div className="aurora-blob" style={{ width: "50vmax", height: "50vmax", top: "15%", right: "-12%", background: "radial-gradient(circle, #059669 10%, #047857 40%, transparent 70%)", animationDelay: "-6s" }} />
      <div className="aurora-blob" style={{ width: "45vmax", height: "45vmax", bottom: "-12%", left: "20%", background: "radial-gradient(circle, #0ea5e9 10%, #0284c7 40%, transparent 70%)", animationDelay: "-12s" }} />
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

function SuperAdminLoginInner() {
  useSearchParams(); // returnUrl future use
  const [step, setStep] = useState<"login" | "key">("login");
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [keyInput, setKeyInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [anim, setAnim] = useState<AnimLevel>("full");

  useEffect(() => {
    const saved = localStorage.getItem("login_anim") as AnimLevel | null;
    if (saved && ANIM_ORDER.includes(saved)) setAnim(saved);
    else if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setAnim("low");
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
        body: JSON.stringify({ identifier: form.identifier, password: form.password, mode: "super" }),
      });
      const json = await res.json();
      if (!json.success) {
        const msg = typeof json.error === "object"
          ? (json.error?.message || "Login yoki parol noto'g'ri")
          : (json.error || "Login yoki parol noto'g'ri");
        setError(msg);
        return;
      }
      localStorage.setItem("user_role", "super_admin");
      localStorage.setItem("user_name", json.data.user?.firstName || "SuperAdmin");
      setStep("key");
    } catch {
      setError("Server bilan bog'lanishda xatolik");
    } finally {
      setLoading(false);
    }
  }

  async function handleKeySubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/super/auth", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: keyInput }),
      });
      const json = await res.json();
      if (!json.success) {
        setError("Kalit noto'g'ri");
        return;
      }
      window.location.href = "/admin/super";
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
    "w-full min-h-[48px] rounded-xl bg-gradient-to-r from-indigo-500 to-emerald-500 px-4 py-3 " +
    "text-base font-semibold text-white shadow-lg transition hover:opacity-90 " +
    "active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className={`anim-${anim} relative min-h-screen overflow-hidden flex items-center justify-center p-4`}
      style={{ background: "linear-gradient(160deg, #030712 0%, #0f172a 45%, #042f2e 100%)" }}>
      <AuroraBackground />
      <Starfield />

      <div className={glass}>
        <button type="button" onClick={cycleAnim} title={ANIM_LABEL[anim]} aria-label={ANIM_LABEL[anim]}
          className="absolute right-4 top-4 z-20 rounded-full border border-white/15 bg-white/10 p-2 text-white/70 transition hover:text-white hover:bg-white/20">
          <SparklesIcon className="h-4 w-4" />
        </button>

        {/* Logo */}
        <div className="mb-7 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/30 to-emerald-500/30 border border-white/15">
            <ShieldIcon className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">TibTaqvim</h1>
          <p className="mt-1 text-sm text-white/60">
            {step === "login" ? "Superadmin kirishi" : "Boshqaruv kaliti"}
          </p>
          {/* Step indicator */}
          <div className="mt-3 flex items-center justify-center gap-2">
            <div className={`h-1.5 w-8 rounded-full transition-colors ${step === "login" ? "bg-indigo-400" : "bg-indigo-400/40"}`} />
            <div className={`h-1.5 w-8 rounded-full transition-colors ${step === "key" ? "bg-emerald-400" : "bg-white/20"}`} />
          </div>
        </div>

        {step === "login" ? (
          <form onSubmit={handleLoginSubmit} className="space-y-5">
            <div>
              <label className={label}>Login</label>
              <input type="text" className={field} placeholder="tib_admin_xxxxx"
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
              {loading ? "Tekshirilmoqda…" : "Davom etish →"}
            </button>

            <p className="pt-1 text-center text-xs text-white/30">
              Oddiy xodimlar{" "}
              <a href="/" className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">
                asosiy sahifadan
              </a>{" "}
              kiradi
            </p>
          </form>
        ) : (
          <form onSubmit={handleKeySubmit} className="space-y-5">
            <div>
              <label className={label}>Boshqaruv kaliti</label>
              <input type="password" className={`${field} font-mono tracking-[0.2em]`}
                placeholder="••••••••••••"
                value={keyInput} onChange={(e) => setKeyInput(e.target.value)}
                required autoFocus autoComplete="off" />
              <p className="mt-1.5 text-xs text-white/40">
                Dasturchi bergan maxfiy boshqaruv kalitini kiriting.
              </p>
            </div>

            {error && (
              <div role="alert" className="rounded-xl border border-red-400/30 bg-red-500/15 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading || !keyInput} className={primaryBtn}>
              {loading ? "Tekshirilmoqda…" : "Boshqaruv xonasiga kirish"}
            </button>
            <button type="button"
              onClick={() => { setStep("login"); setError(""); setKeyInput(""); }}
              className="w-full py-2 text-sm text-white/50 transition hover:text-white/80">
              ← Orqaga
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function SuperAdminLoginPage() {
  return (
    <Suspense>
      <SuperAdminLoginInner />
    </Suspense>
  );
}
