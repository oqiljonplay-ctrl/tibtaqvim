"use client";
import { useState, useEffect } from "react";

interface JobRequestEmployee {
  id: string;
  emId: string;
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;
  specialty: string | null;
  phone: string | null;
}

interface JobRequest {
  id: string;
  employeeId: string;
  clinicId: string;
  role: string;
  status: string;
  message: string | null;
  createdAt: string;
  employee: JobRequestEmployee;
}

export default function AdminJobRequestsPage() {
  const [requests, setRequests] = useState<JobRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [actionId, setActionId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => { fetchRequests(); }, [tab]);

  async function fetchRequests() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/job-requests?status=${tab}`, { credentials: "include" });
      const json = await res.json();
      if (json.success) setRequests(json.data);
    } finally {
      setLoading(false);
    }
  }

  function showToast(text: string, type: "success" | "error") {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleApprove(id: string) {
    if (actionId) return;
    setActionId(id);
    try {
      const res = await fetch(`/api/admin/job-requests/${id}/approve`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (json.success) {
        showToast("So'rov tasdiqlandi. Xodim biriktirildi.", "success");
        fetchRequests();
      } else {
        showToast(json.error?.message || "Xatolik", "error");
      }
    } catch {
      showToast("Server xatosi", "error");
    } finally {
      setActionId(null);
    }
  }

  async function handleReject(id: string) {
    if (actionId) return;
    setActionId(id);
    try {
      const res = await fetch(`/api/admin/job-requests/${id}/reject`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (json.success) {
        showToast("So'rov rad etildi", "success");
        fetchRequests();
      } else {
        showToast(json.error?.message || "Xatolik", "error");
      }
    } catch {
      showToast("Server xatosi", "error");
    } finally {
      setActionId(null);
    }
  }

  return (
    <div>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white ${toast.type === "success" ? "bg-green-600" : "bg-red-600"}`}>
          {toast.text}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">📨 Xodim so'rovlari</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(["pending", "approved", "rejected"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "pending" ? "⏳ Kutilayotgan" : t === "approved" ? "✓ Tasdiqlangan" : "✗ Rad etilgan"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-12">Yuklanmoqda...</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-gray-500">
            {tab === "pending" ? "Kutilayotgan so'rovlar yo'q" : "So'rovlar topilmadi"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const emp = req.employee;
            const name = `${emp.firstName} ${emp.lastName ?? ""}`.trim();
            return (
              <div key={req.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  {emp.photoUrl ? (
                    <img
                      src={emp.photoUrl}
                      alt={name}
                      className="w-14 h-14 rounded-full object-cover flex-shrink-0 border"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center text-2xl flex-shrink-0">
                      👤
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{name}</span>
                      <span className="text-xs font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{emp.emId}</span>
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                        req.role === "doctor" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
                      }`}>
                        {req.role === "doctor" ? "👨‍⚕️ Shifokor" : "🏥 Qabulxona"}
                      </span>
                    </div>
                    {emp.specialty && <p className="text-sm text-gray-600 mt-0.5">{emp.specialty}</p>}
                    {emp.phone && <p className="text-xs text-gray-500 mt-0.5">📞 {emp.phone}</p>}
                    {req.message && (
                      <p className="text-sm text-gray-600 mt-1 bg-gray-50 rounded-lg px-3 py-1.5 border border-gray-100">
                        💬 {req.message}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(req.createdAt).toLocaleDateString("uz-UZ", {
                        year: "numeric", month: "long", day: "numeric",
                      })}
                    </p>
                  </div>
                </div>

                {tab === "pending" && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => handleApprove(req.id)}
                      disabled={actionId === req.id}
                      className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                    >
                      {actionId === req.id ? "Bajarilmoqda..." : "✓ Tasdiqlash"}
                    </button>
                    <button
                      onClick={() => handleReject(req.id)}
                      disabled={actionId === req.id}
                      className="flex-1 border border-red-200 text-red-600 rounded-lg py-2 text-sm font-medium hover:bg-red-50 disabled:opacity-50"
                    >
                      ✗ Rad etish
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
