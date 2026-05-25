"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Container, Stack } from "@/components/layout";
import Navbar from "@/components/ui/Navbar";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export default function ProfilePage() {
  const { user, loading } = useCurrentUser();
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!loading && !user) {
    router.replace("/login");
    return null;
  }

  const confirmMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (confirmMismatch) return;
    setSubmitting(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (json.success) {
        setSuccessMsg("Parol muvaffaqiyatli o'zgartirildi");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setErrorMsg(json.error?.message ?? "Xatolik yuz berdi");
      }
    } catch {
      setErrorMsg("Tarmoq xatosi. Qayta urinib ko'ring.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      <Navbar title="Profil" items={[]} />
      <Container size="sm" className="py-6 md:py-10">
        {/* Foydalanuvchi ma'lumotlari */}
        <div className="card mb-6 p-5">
          {loading ? (
            <div className="space-y-2">
              <div className="h-5 w-40 bg-gray-100 rounded animate-pulse" />
              <div className="h-4 w-28 bg-gray-100 rounded animate-pulse" />
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-lg font-semibold text-gray-900">{user?.fullName}</p>
              {user?.phone && <p className="text-sm text-gray-500">{user.phone}</p>}
              {user?.clinic?.name && (
                <p className="text-sm text-gray-500">🏥 {user.clinic.name}</p>
              )}
            </div>
          )}
        </div>

        {/* Parolni o'zgartirish */}
        <div className="card p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Parolni o'zgartirish</h2>

          <form onSubmit={handleSubmit}>
            <Stack gap={4}>
              {/* Joriy parol */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Joriy parol
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Hozirgi parolingiz"
                />
              </div>

              {/* Yangi parol */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Yangi parol
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Kamida 8 belgi, 1 harf, 1 raqam"
                />
              </div>

              {/* Yangi parolni tasdiqlash */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Yangi parolni tasdiqlash
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className={`w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    confirmMismatch
                      ? "border-red-400 bg-red-50"
                      : "border-gray-300"
                  }`}
                  placeholder="Yangi parolni qayta kiriting"
                />
                {confirmMismatch && (
                  <p className="text-xs text-red-600 mt-1">Parollar mos kelmayapti</p>
                )}
              </div>

              {/* Xabarlar */}
              {errorMsg && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start gap-2">
                  <span className="text-red-500 flex-shrink-0 mt-0.5">⚠</span>
                  <p className="text-red-700 text-sm">{errorMsg}</p>
                </div>
              )}
              {successMsg && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 flex items-start gap-2">
                  <span className="text-emerald-500 flex-shrink-0 mt-0.5">✓</span>
                  <p className="text-emerald-700 text-sm">{successMsg}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting || confirmMismatch}
                className="w-full py-2.5 min-h-[44px] bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
              >
                {submitting ? "Saqlanmoqda..." : "Saqlash"}
              </button>
            </Stack>
          </form>
        </div>
      </Container>
    </div>
  );
}
