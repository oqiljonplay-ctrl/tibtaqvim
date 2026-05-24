"use client";
import { useState, useEffect, useCallback } from "react";

interface Branch {
  id: string;
  clinicId: string;
  name: string;
  address: string | null;
  phone: string | null;
  workingHours: string | null;
  nearbyMetro: string | null;
  sortOrder: number;
  isActive: boolean;
  doctorCount: number;
}

const EMPTY_FORM = {
  name: "", address: "", phone: "", workingHours: "", nearbyMetro: "", sortOrder: 0,
};

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState<"create" | "edit" | null>(null);
  const [editing, setEditing]   = useState<Branch | null>(null);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState("");
  const [canCreate, setCanCreate] = useState(false);

  useEffect(() => {
    const role = localStorage.getItem("user_role");
    setCanCreate(role === "super_admin" || role === "clinic_admin");
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/branches", { credentials: "include" });
    const j = await res.json();
    if (j.success) setBranches(j.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setErr("");
    setModal("create");
  }

  function openEdit(b: Branch) {
    setEditing(b);
    setForm({
      name:         b.name,
      address:      b.address      || "",
      phone:        b.phone        || "",
      workingHours: b.workingHours || "",
      nearbyMetro:  b.nearbyMetro  || "",
      sortOrder:    b.sortOrder,
    });
    setErr("");
    setModal("edit");
  }

  async function handleSave() {
    if (!form.name.trim()) { setErr("Filial nomi majburiy"); return; }
    setSaving(true);
    setErr("");
    try {
      const isEdit = modal === "edit" && editing;
      const res = await fetch(
        isEdit ? `/api/admin/branches/${editing!.id}` : "/api/admin/branches",
        {
          method:  isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            name:         form.name.trim(),
            address:      form.address.trim()      || null,
            phone:        form.phone.trim()        || null,
            workingHours: form.workingHours.trim() || null,
            nearbyMetro:  form.nearbyMetro.trim()  || null,
            sortOrder:    Number(form.sortOrder),
          }),
        }
      );
      const j = await res.json();
      if (!j.success) { setErr(j.error?.message ?? "Xatolik"); return; }
      setModal(null);
      load();
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(id: string) {
    if (!confirm("Filialni nofaol qilmoqchimisiz?")) return;
    await fetch(`/api/admin/branches/${id}`, {
      method:  "DELETE",
      credentials: "include",
    });
    load();
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Filiallar</h1>
          <p className="text-sm text-gray-500 mt-1">{branches.length} ta filial</p>
        </div>
        {canCreate && (
          <button
            onClick={openCreate}
            className="px-4 py-2 min-h-[44px] bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            + Yangi filial
          </button>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 mx-4">
            <h2 className="text-lg font-bold text-gray-900 mb-5">
              {modal === "create" ? "Yangi filial" : "Filialni tahrirlash"}
            </h2>
            <div className="space-y-3">
              {[
                { label: "Nomi *", key: "name", placeholder: "Asosiy filial" },
                { label: "Manzil", key: "address", placeholder: "Ko'cha, uy" },
                { label: "Telefon", key: "phone", placeholder: "+998 90 000 00 00" },
                { label: "Ish vaqti", key: "workingHours", placeholder: "08:00-20:00" },
                { label: "Yaqin metro", key: "nearbyMetro", placeholder: "Yunusobod" },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                  <input
                    className="input"
                    placeholder={placeholder}
                    value={(form as any)[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Saralash tartibi</label>
                <input
                  type="number"
                  className="input"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                />
              </div>
              {err && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{err}</div>}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg text-sm"
                >
                  {saving ? "Saqlanmoqda..." : "Saqlash"}
                </button>
                <button
                  onClick={() => setModal(null)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 rounded-lg text-sm"
                >
                  Bekor
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
            <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Yuklanmoqda...</span>
          </div>
        ) : branches.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            Hali filiallar yo&apos;q
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-gray-100">
              {branches.map((b) => (
                <div key={b.id} className="p-4">
                  <div className="font-medium text-gray-900 mb-0.5">{b.name}</div>
                  {b.phone && <div className="text-xs text-gray-400">{b.phone}</div>}
                  {b.nearbyMetro && <div className="text-xs text-blue-500">🚇 {b.nearbyMetro}</div>}
                  {b.address && <div className="text-xs text-gray-600 mt-1">📍 {b.address}</div>}
                  <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-1">
                    {b.workingHours && <span>⏰ {b.workingHours}</span>}
                    <span>👨‍⚕️ {b.doctorCount} shifokor</span>
                  </div>
                  {canCreate && (
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => openEdit(b)}
                        className="flex-1 min-h-[44px] text-sm font-medium bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        Tahrirlash
                      </button>
                      <button
                        onClick={() => handleDeactivate(b.id)}
                        className="flex-1 min-h-[44px] text-sm font-medium bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        O&apos;chir
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <table className="w-full text-sm hidden md:table">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-5 py-3 font-medium text-gray-500">Filial</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Manzil</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Ish vaqti</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-500">Shifokorlar</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-500">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {branches.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-medium text-gray-900">{b.name}</div>
                      {b.phone && <div className="text-xs text-gray-400 mt-0.5">{b.phone}</div>}
                      {b.nearbyMetro && (
                        <div className="text-xs text-blue-500 mt-0.5">🚇 {b.nearbyMetro}</div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-gray-600 text-sm">
                      {b.address || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-4 text-gray-600 text-sm">
                      {b.workingHours || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-4 text-center text-gray-700">{b.doctorCount}</td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(b)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2.5 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                        >
                          Tahrirlash
                        </button>
                        <button
                          onClick={() => handleDeactivate(b.id)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          O&apos;chir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
