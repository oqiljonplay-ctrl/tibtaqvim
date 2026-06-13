"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ClinicItem {
  id: string;
  name: string;
  address: string | null;
  logoUrl: string | null;
  city: string | null;
  workingHours: string | null;
  description: string | null;
  status: "none" | "active" | "pending";
  requestId: string | null;
}

interface Limits {
  maxClinics: number;
  activeClinics: number;
  maxJobRequests: number;
  pendingRequests: number;
}

export default function DoctorClinicsPage() {
  const router = useRouter();
  const [clinics, setClinics] = useState<ClinicItem[]>([]);
  const [limits, setLimits] = useState<Limits | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [showMessageFor, setShowMessageFor] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch("/api/doctor/clinics", { credentials: "include" });
      const json = await res.json();
      if (json.success) {
        setClinics(json.data.clinics);
        setLimits(json.data.limits);
      }
    } finally {
      setLoading(false);
    }
  }

  function showToast(text: string, type: "success" | "error") {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleRequest(clinicId: string) {
    if (submittingId) return;
    setSubmittingId(clinicId);
    try {
      const res = await fetch("/api/doctor/job-requests", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId, message: message.trim() || undefined }),
      });
      const json = await res.json();
      if (json.success) {
        showToast("So'rov muvaffaqiyatli yuborildi!", "success");
        setShowMessageFor(null);
        setMessage("");
        fetchData();
      } else {
        showToast(json.error?.message || "Xatolik yuz berdi", "error");
      }
    } catch {
      showToast("Server bilan bog'lanishda xatolik", "error");
    } finally {
      setSubmittingId(null);
    }
  }

  async function handleCancel(requestId: string) {
    if (cancellingId) return;
    setCancellingId(requestId);
    try {
      const res = await fetch(`/api/doctor/job-requests/${requestId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json();
      if (json.success) {
        showToast("So'rov bekor qilindi", "success");
        fetchData();
      } else {
        showToast(json.error?.message || "Xatolik", "error");
      }
    } catch {
      showToast("Server xatosi", "error");
    } finally {
      setCancellingId(null);
    }
  }

  const filtered = clinics.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.address ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const canSendMore = limits
    ? limits.pendingRequests < limits.maxJobRequests && limits.activeClinics < limits.maxClinics
    : true;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white ${toast.type === "success" ? "bg-green-600" : "bg-red-600"}`}>
          {toast.text}
        </div>
      )}

      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600">←</button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Klinika qidirish</h1>
          {limits && (
            <p className="text-xs text-gray-500 mt-0.5">
              {limits.activeClinics}/{limits.maxClinics} faol klinika · {limits.pendingRequests}/{limits.maxJobRequests} kutilayotgan so'rov
            </p>
          )}
        </div>
      </div>

      <input
        className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-300"
        placeholder="Klinika nomi yoki manzili bo'yicha qidiring..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? (
        <div className="text-center text-gray-400 py-12">Yuklanmoqda...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-400 py-12">Klinika topilmadi</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((clinic) => (
            <div key={clinic.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                {clinic.logoUrl ? (
                  <img src={clinic.logoUrl} alt={clinic.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center text-xl flex-shrink-0">🏥</div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{clinic.name}</h3>
                  {clinic.address && <p className="text-xs text-gray-500 mt-0.5">📍 {clinic.address}</p>}
                  {clinic.workingHours && <p className="text-xs text-gray-500">🕐 {clinic.workingHours}</p>}
                  {clinic.description && <p className="text-xs text-gray-600 mt-1 line-clamp-2">{clinic.description}</p>}
                </div>
              </div>

              <div className="mt-3">
                {clinic.status === "active" ? (
                  <span className="inline-flex items-center gap-1 text-sm text-green-700 bg-green-50 px-3 py-1.5 rounded-lg font-medium">
                    ✓ Siz bu klinikada ishlaysiz
                  </span>
                ) : clinic.status === "pending" ? (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-sm text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg font-medium">
                      ⏳ So'rov yuborilgan
                    </span>
                    <button
                      onClick={() => clinic.requestId && handleCancel(clinic.requestId)}
                      disabled={cancellingId === clinic.requestId}
                      className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                    >
                      {cancellingId === clinic.requestId ? "Bekor qilinmoqda..." : "Bekor qilish"}
                    </button>
                  </div>
                ) : showMessageFor === clinic.id ? (
                  <div className="space-y-2">
                    <textarea
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
                      rows={2}
                      placeholder="Qo'shimcha xabar (ixtiyoriy)..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRequest(clinic.id)}
                        disabled={submittingId === clinic.id || !canSendMore}
                        className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                      >
                        {submittingId === clinic.id ? "Yuborilmoqda..." : "Yuborish"}
                      </button>
                      <button
                        onClick={() => { setShowMessageFor(null); setMessage(""); }}
                        className="flex-1 border border-gray-300 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50"
                      >
                        Bekor
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowMessageFor(clinic.id)}
                    disabled={!canSendMore}
                    className="w-full bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={!canSendMore ? "Limit to'lgan" : undefined}
                  >
                    So'rov yuborish
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
