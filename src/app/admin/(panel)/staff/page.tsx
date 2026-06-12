"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StaffCard } from "@/components/StaffCard";

interface Branch {
  id: string;
  name: string;
}

interface StaffMember {
  id: string;
  userId: string | null;
  firstName: string;
  lastName: string;
  phone: string | null;
  photoUrl: string | null;
  role: string;
  branchId: string | null;
  branch: { id: string; name: string } | null;
  emId?: string | null;
  profession?: string | null;
}

interface Credentials {
  phone: string | null;
  password: string;
  name: string;
  emId?: string | null;
}

const emptyForm = {
  firstName: "",
  lastName: "",
  phone: "",
  photoUrl: "",
  branchId: "",
  profession: "",
};

export default function AdminStaffPage() {
  const router = useRouter();
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [isBranchAdmin, setIsBranchAdmin] = useState(false);

  useEffect(() => {
    fetchStaff();
    fetchBranches();
  }, []);

  async function fetchStaff() {
    setLoading(true);
    const clinicId = localStorage.getItem("clinicId") || "";
    const res = await fetch(`/api/admin/staff${clinicId ? `?clinicId=${clinicId}` : ""}`, {
      credentials: "include",
    });
    const json = await res.json();
    if (json.success) setStaffList(json.data);
    setLoading(false);
  }

  async function fetchBranches() {
    const role = localStorage.getItem("user_role");
    const myBranchId = localStorage.getItem("branchId");
    if (role === "branch_admin" && myBranchId) {
      setIsBranchAdmin(true);
      setForm((prev) => ({ ...prev, branchId: myBranchId }));
      return;
    }
    const res = await fetch("/api/admin/branches", { credentials: "include" });
    const json = await res.json();
    if (json.success) {
      setBranches(json.data);
      if (json.data.length === 1) {
        setForm((prev) => ({ ...prev, branchId: json.data[0].id }));
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      if (!form.branchId) {
        alert("Filialni tanlang");
        return;
      }
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone,
          role: "receptionist",
          branchId: form.branchId,
          ...(form.profession ? { profession: form.profession } : {}),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowForm(false);
        const defaultBranchId = isBranchAdmin
          ? (localStorage.getItem("branchId") || "")
          : branches.length === 1 ? branches[0].id : "";
        setForm({ ...emptyForm, branchId: defaultBranchId });
        setCredentials({
          phone: json.data.phone,
          password: json.data.generatedPassword,
          name: `${form.firstName} ${form.lastName}`.trim(),
          emId: json.data.emId ?? null,
        });
        fetchStaff();
      } else {
        alert(json.error?.message || "Saqlashda xatolik");
      }
    } catch {
      alert("Server bilan bog'lanishda xatolik");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword(staffMember: StaffMember) {
    if (!staffMember.userId) {
      alert("Bu xodimning foydalanuvchi akkauntи topilmadi");
      return;
    }
    setResettingId(staffMember.id);
    try {
      const res = await fetch(`/api/admin/staff/${staffMember.userId}/reset-password`, {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json();
      if (json.success) {
        setCredentials({
          phone: json.data.phone,
          password: json.data.newPassword,
          name: json.data.name || `${staffMember.lastName} ${staffMember.firstName}`,
        });
      } else {
        alert(json.error?.message || "Parolni tiklashda xatolik");
      }
    } catch {
      alert("Server bilan bog'lanishda xatolik");
    } finally {
      setResettingId(null);
    }
  }

  async function handleDelete(staffId: string) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/staff/${staffId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json();
      if (json.success) {
        setStaffList((prev) => prev.filter((s) => s.id !== staffId));
      } else {
        alert(json.error?.message || "O'chirishda xatolik");
      }
    } catch {
      alert("Server bilan bog'lanishda xatolik");
    } finally {
      setDeleting(false);
      setConfirmDeleteId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Xodimlar</h1>
        <button
          onClick={() => {
            const defaultBranchId = isBranchAdmin
              ? (localStorage.getItem("branchId") || "")
              : branches.length === 1 ? branches[0].id : "";
            setForm({ ...emptyForm, branchId: defaultBranchId });
            setShowForm(true);
          }}
          className="btn-primary"
        >
          + Yangi xodim
        </button>
      </div>

      {showForm && (
        <div className="card mb-6">
          <h2 className="text-lg font-semibold mb-4">Yangi qabulxona xodimi qo&apos;shish</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {!isBranchAdmin && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Filial *</label>
                <select
                  className="input"
                  value={form.branchId}
                  onChange={(e) => setForm({ ...form, branchId: e.target.value })}
                  required
                >
                  {branches.length !== 1 && <option value="">-- Filialni tanlang --</option>}
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                {branches.length === 0 && (
                  <p className="mt-1 text-xs text-red-600">⚠️ Hali filial qo&apos;shilmagan.</p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ism *</label>
              <input
                className="input"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Familya</label>
              <input
                className="input"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefon (login) *</label>
              <input
                className="input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+998 90 000 00 00"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Kasbi (ixtiyoriy)</label>
              <input
                className="input"
                value={form.profession}
                onChange={(e) => setForm({ ...form, profession: e.target.value })}
                placeholder="masalan: laborant, anesteziolog, MRT operatori"
              />
            </div>

            <div className="md:col-span-2 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs text-blue-700">
                🔑 Login uchun parol avtomatik generatsiya qilinadi va qo&apos;shishdan so&apos;ng bir marta ko&apos;rsatiladi.
              </p>
            </div>

            <div className="md:col-span-2 flex gap-3">
              <button
                type="submit"
                disabled={submitting || (!isBranchAdmin && !form.branchId)}
                className="btn-primary disabled:opacity-50"
              >
                {submitting ? "Saqlanmoqda..." : "Qo'shish"}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                Bekor
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="text-gray-400 text-sm text-center py-12">Yuklanmoqda...</div>
      ) : staffList.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">Xodimlar topilmadi</p>
          <p className="text-sm">+ Yangi xodim tugmasini bosing</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {staffList.map((s) => (
            <div key={s.id} className="card relative">
              <div className="absolute top-3 right-3 flex gap-1">
                <button
                  onClick={() => handleResetPassword(s)}
                  disabled={resettingId === s.id}
                  className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition disabled:opacity-40"
                  title="Parolni tiklash"
                >
                  🔑
                </button>
                <button
                  onClick={() => router.push(`/admin/staff/${s.id}/edit`)}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                  title="Tahrirlash"
                >
                  ✏️
                </button>
                <button
                  onClick={() => setConfirmDeleteId(s.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                  title="O'chirish"
                >
                  🗑️
                </button>
              </div>

              <StaffCard staff={s} size="md" />
              {s.emId && (
                <span className="inline-block mt-2 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-mono">
                  {s.emId}
                </span>
              )}
              {s.profession && (
                <p className="text-xs text-gray-500 mt-1">{s.profession}</p>
              )}
              {s.phone && <p className="text-xs text-gray-400 mt-1">{s.phone}</p>}
              {s.branch ? (
                <p className="text-xs text-gray-500 mt-1">🏥 {s.branch.name}</p>
              ) : (
                <p className="text-xs text-amber-600 mt-1">⚠️ Filial belgilanmagan</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* O'chirish modali */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-xl">
            <h3 className="font-semibold text-lg mb-2">Xodimni o&apos;chirish</h3>
            <p className="text-gray-600 text-sm mb-4">
              {(() => {
                const member = staffList.find((x) => x.id === confirmDeleteId);
                return member ? `${member.lastName} ${member.firstName}` : "";
              })()}
              &nbsp;ni o&apos;chirmoqchimisiz? Bu amal akkauntni bloklaydi — login mumkin bo&apos;lmaydi.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDeleteId(null)}
                disabled={deleting}
                className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Bekor qilish
              </button>
              <button
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "O'chirilmoqda..." : "Ha, o'chirish"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credentials modali */}
      {credentials && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-xl">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">🔑</span>
              <h3 className="font-semibold text-lg">
                {credentials.phone ? "Xodim qo'shildi" : "Parol tiklandi"}
              </h3>
            </div>
            <p className="text-sm text-gray-500 mb-4">{credentials.name}</p>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 font-mono text-sm mb-3 select-all">
              {credentials.phone && (
                <div className="mb-1">
                  Login: <span className="font-bold text-gray-900">{credentials.phone}</span>
                </div>
              )}
              <div className="mb-1">Parol: <span className="font-bold text-gray-900">{credentials.password}</span></div>
              {credentials.emId && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  Xodim ID: <span className="font-bold text-blue-700">{credentials.emId}</span>
                </div>
              )}
            </div>
            <div className="flex items-start gap-2 mb-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <span className="flex-shrink-0">⚠️</span>
              <p className="text-amber-800 text-xs">Bu parol qayta ko&apos;rsatilmaydi. Hoziroq saqlab qo&apos;ying.</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const text = credentials.phone
                    ? `Login: ${credentials.phone}\nParol: ${credentials.password}`
                    : `Parol: ${credentials.password}`;
                  navigator.clipboard.writeText(text);
                }}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              >
                Nusxalash
              </button>
              <button
                onClick={() => setCredentials(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
              >
                Yopish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
