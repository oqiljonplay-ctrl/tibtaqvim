"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { PhoneInput, isValidPhone } from "@/components/forms/PhoneInput";

interface Branch {
  id: string;
  name: string;
}

const emptyForm = {
  firstName: "",
  lastName: "",
  phone: "",
  photoUrl: "",
  branchId: "",
};

export default function EditStaffPage() {
  const router = useRouter();
  const params = useParams();
  const staffId = params.id as string;

  const [form, setForm] = useState(emptyForm);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isBranchAdmin, setIsBranchAdmin] = useState(false);

  useEffect(() => {
    const role = localStorage.getItem("user_role");
    if (role === "branch_admin") setIsBranchAdmin(true);

    Promise.all([
      fetch(`/api/admin/staff/${staffId}`, { credentials: "include" }).then((r) => r.json()),
      role === "branch_admin"
        ? Promise.resolve({ success: true, data: [] })
        : fetch("/api/admin/branches", { credentials: "include" }).then((r) => r.json()),
    ])
      .then(([staffJson, brJson]) => {
        if (staffJson.success && staffJson.data) {
          const s = staffJson.data;
          setForm({
            firstName: s.firstName ?? "",
            lastName: s.lastName ?? "",
            phone: s.phone ?? "",
            photoUrl: s.photoUrl ?? "",
            branchId: s.branchId ?? "",
          });
        } else {
          setErrorMsg(staffJson.error?.message ?? "Xodim topilmadi");
        }
        if (brJson.success) setBranches(brJson.data ?? []);
      })
      .catch(() => setErrorMsg("Ma'lumotlarni yuklashda xatolik"))
      .finally(() => setLoading(false));
  }, [staffId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/staff/${staffId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone || null,
          photoUrl: form.photoUrl || null,
          branchId: form.branchId || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        alert(json.error?.message || "Saqlashda xatolik");
      }
    } catch {
      alert("Server bilan bog'lanishda xatolik");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center text-gray-400">Yuklanmoqda...</div>
    );
  }

  if (errorMsg) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center">
        <p className="text-red-600 mb-4">{errorMsg}</p>
        <button onClick={() => router.back()} className="btn-secondary">Orqaga</button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push("/admin/staff")}
          className="p-2 rounded-lg hover:bg-gray-100 transition text-gray-500"
          title="Orqaga"
        >
          ←
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Xodimni tahrirlash</h1>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <PhoneInput
              label="Telefon"
              value={form.phone}
              onChange={(v) => setForm({ ...form, phone: v })}
              error={form.phone && !isValidPhone(form.phone) ? "Raqamni to'liq kiriting" : undefined}
            />
          </div>

          {!isBranchAdmin && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Filial</label>
              <select
                className="input"
                value={form.branchId}
                onChange={(e) => setForm({ ...form, branchId: e.target.value })}
              >
                <option value="">-- Filialni tanlang --</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Foto URL (ixtiyoriy)</label>
            <input
              className="input"
              type="url"
              value={form.photoUrl}
              onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
              placeholder="https://example.com/photo.jpg"
            />
            {form.photoUrl && (
              <img
                src={form.photoUrl}
                alt="preview"
                className="w-16 h-16 rounded-full object-cover mt-2 border"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            )}
          </div>

          <div className="md:col-span-2 flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className={`btn-primary disabled:opacity-50 ${saved ? "bg-green-600 hover:bg-green-700" : ""}`}
            >
              {saving ? "Saqlanmoqda..." : saved ? "✓ Saqlandi" : "Saqlash"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => router.push("/admin/staff")}
            >
              Bekor
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
