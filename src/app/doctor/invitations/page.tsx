"use client";
import { useEffect, useState, useCallback } from "react";

interface Invitation {
  id: string;
  status: string;
  role: string;
  createdAt: string;
  clinic: {
    id: string;
    name: string;
    logoUrl: string | null;
    address: string | null;
    city: string | null;
    workingHours: string | null;
    phone: string | null;
  };
}

export default function InvitationsPage() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  function showToast(msg: string, type: "ok" | "err" = "ok") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/doctor/clinic-invitations");
      const j = await res.json();
      if (j.success) setInvitations(j.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAccept(inv: Invitation) {
    setActing(inv.id);
    const res = await fetch(`/api/doctor/clinic-invitations/${inv.id}/accept`, { method: "POST" });
    const j = await res.json();
    setActing(null);
    if (j.success) {
      showToast(`✅ ${inv.clinic.name}ga muvaffaqiyatli ulandingiz`);
      window.dispatchEvent(new Event("invitation-updated"));
      load();
    } else {
      showToast(j.error?.message ?? "Xatolik yuz berdi", "err");
    }
  }

  async function handleDecline(inv: Invitation) {
    setActing(inv.id);
    const res = await fetch(`/api/doctor/clinic-invitations/${inv.id}/decline`, { method: "POST" });
    const j = await res.json();
    setActing(null);
    if (j.success) {
      showToast("Taklif rad etildi");
      window.dispatchEvent(new Event("invitation-updated"));
      load();
    } else {
      showToast(j.error?.message ?? "Xatolik yuz berdi", "err");
    }
  }

  const pending = invitations.filter((i) => i.status === "pending");
  const history = invitations.filter((i) => i.status !== "pending");

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium ${
            toast.type === "ok" ? "bg-green-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div>
        <h1 className="text-xl font-bold text-gray-900">📬 Klinika takliflari</h1>
        <p className="text-sm text-gray-500 mt-1">
          Klinikalar tomonidan yuborilgan ishga taklif xabarlari
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-gray-400 py-12 justify-center">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Yuklanmoqda...</span>
        </div>
      ) : (
        <>
          {/* Kutilayotgan takliflar */}
          {pending.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
              <div className="text-4xl mb-3">📭</div>
              <div className="text-gray-500 text-sm">Yangi takliflar yo&apos;q</div>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-gray-700">
                Yangi takliflar ({pending.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pending.map((inv) => (
                  <div
                    key={inv.id}
                    className="bg-white rounded-xl border-2 border-indigo-200 shadow-sm overflow-hidden"
                  >
                    <div className="p-4 flex items-start gap-3">
                      {inv.clinic.logoUrl ? (
                        <img
                          src={inv.clinic.logoUrl}
                          alt=""
                          className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center text-2xl flex-shrink-0">
                          🏥
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-gray-900">{inv.clinic.name}</div>
                        {inv.clinic.address && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            📍 {inv.clinic.address}{inv.clinic.city ? `, ${inv.clinic.city}` : ""}
                          </div>
                        )}
                        {inv.clinic.phone && (
                          <div className="text-xs text-gray-500 mt-0.5">📞 {inv.clinic.phone}</div>
                        )}
                        {inv.clinic.workingHours && (
                          <div className="text-xs text-gray-500 mt-0.5">🕐 {inv.clinic.workingHours}</div>
                        )}
                        <div className="mt-1.5 text-xs text-indigo-600 font-medium">
                          Rol: {inv.role === "doctor" ? "Shifokor" : "Qabulxona"}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {new Date(inv.createdAt).toLocaleDateString("uz-UZ", { day: "numeric", month: "long" })}
                        </div>
                      </div>
                    </div>
                    <div className="px-4 pb-4 flex gap-2">
                      <button
                        onClick={() => handleAccept(inv)}
                        disabled={acting === inv.id}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
                      >
                        {acting === inv.id ? "..." : "✓ Qabul qilish"}
                      </button>
                      <button
                        onClick={() => handleDecline(inv)}
                        disabled={acting === inv.id}
                        className="flex-1 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-700 text-sm font-medium py-2 rounded-lg transition-colors"
                      >
                        {acting === inv.id ? "..." : "✗ Rad etish"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tarix */}
          {history.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-700">Tarix</h2>
              <div className="space-y-2">
                {history.map((inv) => (
                  <div
                    key={inv.id}
                    className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3"
                  >
                    {inv.clinic.logoUrl ? (
                      <img
                        src={inv.clinic.logoUrl}
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-xl flex-shrink-0">
                        🏥
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 text-sm">{inv.clinic.name}</div>
                      <div className="text-xs text-gray-400">
                        {new Date(inv.createdAt).toLocaleDateString("uz-UZ", { day: "numeric", month: "long" })}
                      </div>
                    </div>
                    <span
                      className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${
                        inv.status === "approved"
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {inv.status === "approved" ? "✓ Qabul qilindi" : "✗ Rad etildi"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
