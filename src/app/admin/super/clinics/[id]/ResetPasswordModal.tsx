"use client";

import { useState } from "react";

type Props = {
  apiUrl: string;
  admin: { id: string; username: string | null; firstName: string };
  onClose: () => void;
};

export function ResetPasswordModal({ apiUrl, admin, onClose }: Props) {
  const [newPassword, setNewPassword] = useState("");
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const handleReset = async () => {
    setLoading(true);
    setErr(null);
    const res = await fetch(apiUrl, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resetPassword: true, newPassword: autoGenerate ? undefined : newPassword }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok || !data.success) {
      setErr(data.error?.message ?? "Xato");
      return;
    }
    setResult(data.data.newPassword);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-6 max-w-md w-full">
        <h2 className="text-xl font-bold mb-2 text-gray-900">Parolni o&apos;zgartirish</h2>
        <p className="text-sm text-gray-500 mb-4">
          Admin: <code className="bg-gray-100 px-1 rounded">{admin.username}</code> ({admin.firstName})
        </p>
        {result ? (
          <div>
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded mb-4">
              <p className="text-sm text-yellow-800 mb-2 font-semibold">Yangi parol:</p>
              <code className="block p-2 bg-white border rounded font-mono">{result}</code>
              <button onClick={() => navigator.clipboard.writeText(result)} className="mt-2 text-sm text-blue-600 hover:underline">
                Nusxa olish
              </button>
            </div>
            <button onClick={onClose} className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg">
              Yopish
            </button>
          </div>
        ) : (
          <>
            <label className="flex items-center gap-2 mb-3 cursor-pointer">
              <input type="checkbox" checked={autoGenerate} onChange={(e) => setAutoGenerate(e.target.checked)} />
              <span className="text-sm">Avtomatik yaratish</span>
            </label>
            {!autoGenerate && (
              <input
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Yangi parol (8+ belgi, 1 harf, 1 raqam)"
                className="input font-mono mb-3"
              />
            )}
            {err && <div className="p-3 bg-red-50 text-red-700 rounded text-sm mb-3">{err}</div>}
            <div className="flex gap-3">
              <button
                onClick={handleReset}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg disabled:opacity-50"
              >
                {loading ? "Bajarilmoqda..." : "Parolni almashtir"}
              </button>
              <button onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
                Bekor
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
