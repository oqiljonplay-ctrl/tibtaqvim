"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const roleRedirects: Record<string, string> = {
  super_admin: "/admin",
  clinic_admin: "/admin",
  doctor: "/doctor",
  receptionist: "/reception",
};

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ phone: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const json = await res.json();

      if (!json.success) {
        setError(json.error || "Login yoki parol noto'g'ri");
        return;
      }

      const { token, user } = json.data;
      localStorage.setItem("auth_token", token);
      localStorage.setItem("user_role", user.role);
      localStorage.setItem("user_name", user.firstName);
      if (user.clinicId) localStorage.setItem("clinicId", user.clinicId);

      // Set cookie for middleware
      document.cookie = `auth_token=${token}; path=/; max-age=${7 * 24 * 60 * 60}`;

      const redirect = roleRedirects[user.role] || "/";
      router.push(redirect);
    } catch {
      setError("Server bilan bog'lanishda xatolik");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🏥</div>
          <h1 className="text-2xl font-bold text-gray-900">ClinicBot</h1>
          <p className="text-gray-500 text-sm mt-1">Tizimga kirish</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Telefon raqam
            </label>
            <input
              type="tel"
              className="input"
              placeholder="+998 90 000 00 00"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Parol
            </label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 text-base"
          >
            {loading ? "Kirish..." : "Kirish"}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center">
            Demo: <code className="bg-gray-50 px-1 rounded">+998 90 000 00 00</code> / <code className="bg-gray-50 px-1 rounded">admin123</code>
          </p>
        </div>
      </div>
    </div>
  );
}
