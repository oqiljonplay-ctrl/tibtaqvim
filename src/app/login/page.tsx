"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

const roleRedirects: Record<string, string> = {
  super_admin: "/admin/super",
  clinic_admin: "/admin",
  branch_admin: "/admin",
  doctor: "/doctor",
  receptionist: "/reception",
};

function LoginForm() {
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl");
  const [form, setForm] = useState({ identifier: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: form.identifier, password: form.password }),
      });

      const json = await res.json();

      if (!json.success) {
        const msg = typeof json.error === "object"
          ? (json.error?.message || "Login yoki parol noto'g'ri")
          : (json.error || "Login yoki parol noto'g'ri");
        setError(msg);
        return;
      }

      const { user } = json.data;
      localStorage.setItem("user_role", user.role);
      localStorage.setItem("user_name", user.firstName);
      if (user.clinicId) localStorage.setItem("clinicId", user.clinicId);
      if (user.branchId) localStorage.setItem("branchId", user.branchId);
      else localStorage.removeItem("branchId");

      const redirect = returnUrl || roleRedirects[user.role] || "/";
      window.location.href = redirect;
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
              Login yoki telefon
            </label>
            <input
              type="text"
              className="input"
              placeholder="tib_admin_xxxx yoki +998901234567"
              value={form.identifier}
              onChange={(e) => setForm({ ...form, identifier: e.target.value })}
              autoComplete="username"
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
            Admin: <code className="bg-gray-50 px-1 rounded">+998900000000</code> / <code className="bg-gray-50 px-1 rounded">admin123</code>
          </p>
          <p className="text-xs text-gray-400 text-center mt-1">
            Shifokor: <code className="bg-gray-50 px-1 rounded">+998901111111</code> / <code className="bg-gray-50 px-1 rounded">doctor123</code>
          </p>
          <p className="text-xs text-gray-400 text-center mt-1">
            Qabulxona: <code className="bg-gray-50 px-1 rounded">+998902222222</code> / <code className="bg-gray-50 px-1 rounded">reception123</code>
          </p>
          <p className="text-xs text-gray-400 text-center mt-1">
            SuperAdmin: <code className="bg-gray-50 px-1 rounded">+998999999999</code> / <code className="bg-gray-50 px-1 rounded">super123</code>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
