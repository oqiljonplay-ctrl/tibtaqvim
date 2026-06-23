"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { DoctorProfileFields, DoctorProfileData, emptyProfileData, profileFromServer } from "@/components/DoctorProfileFields";
import { DoctorBlockedDatesManager } from "@/components/DoctorBlockedDatesManager";
import { PhoneInput, isValidPhone } from "@/components/forms/PhoneInput";

interface ServiceItem { id: string; name: string; price: number; type: string }
interface Branch      { id: string; name: string }

const emptyForm = { firstName: "", lastName: "", specialty: "", phone: "", photoUrl: "", branchId: "" };

export default function EditDoctorPage() {
  const router = useRouter();
  const params = useParams();
  const doctorId = params.id as string;

  const [form, setForm]                       = useState(emptyForm);
  const [services, setServices]               = useState<ServiceItem[]>([]);
  const [branches, setBranches]               = useState<Branch[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [profileData, setProfileData]         = useState<DoctorProfileData>(emptyProfileData());

  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const clinicId = localStorage.getItem("clinicId") || "";
    Promise.all([
      fetch(`/api/admin/doctors/${doctorId}/profile`, { credentials: "include" }).then((r) => r.json()),
      fetch(`/api/admin/services${clinicId ? `?clinicId=${clinicId}` : ""}`, { credentials: "include" }).then((r) => r.json()),
      fetch("/api/admin/branches", { credentials: "include" }).then((r) => r.json()),
    ]).then(([docJson, svcJson, brJson]) => {
      if (docJson.success && docJson.data) {
        const d = docJson.data;
        setForm({
          firstName: d.firstName ?? "",
          lastName:  d.lastName  ?? "",
          specialty: d.specialty ?? "",
          phone:     d.phone     ?? "",
          photoUrl:  d.photoUrl  ?? "",
          branchId:  d.branchId  ?? "",
        });
        setSelectedServiceIds((d.services ?? []).map((s: ServiceItem) => s.id));
        setProfileData(profileFromServer(d));
      } else {
        setErrorMsg(docJson.error?.message ?? "Shifokor topilmadi");
      }
      if (svcJson.success) setServices(svcJson.data ?? []);
      if (brJson.success)  setBranches(brJson.data ?? []);
    }).catch(() => setErrorMsg("Ma'lumotlarni yuklashda xatolik"))
      .finally(() => setLoading(false));
  }, [doctorId]);

  function toggleService(id: string, checked: boolean) {
    setSelectedServiceIds((prev) => checked ? [...prev, id] : prev.filter((x) => x !== id));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setErrorMsg(null);
    setSaved(false);
    try {
      // 1. Asosiy ma'lumotlar
      const finalServiceIds = [...selectedServiceIds];
      const matched = services.find((s) => s.name === form.specialty);
      if (matched && !finalServiceIds.includes(matched.id)) finalServiceIds.push(matched.id);

      const baseRes = await fetch(`/api/admin/doctors/${doctorId}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          branchId:  form.branchId  || null,
          photoUrl:  form.photoUrl  || null,
          phone:     form.phone     || null,
          serviceIds: finalServiceIds,
        }),
      });
      const baseJson = await baseRes.json();
      if (!baseJson.success) {
        setErrorMsg(baseJson.error?.message ?? "Asosiy ma'lumotlarni saqlashda xatolik");
        return;
      }

      // 2. Profil ma'lumotlari
      const profRes = await fetch(`/api/admin/doctors/${doctorId}/profile`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          education:       profileData.education       || null,
          position:        profileData.position        || null,
          department:      profileData.department      || null,
          workSchedule:    profileData.workSchedule    || null,
          operationsCount: profileData.operationsCount,
          bio:             profileData.bio             || null,
          specialties:     profileData.specialties.filter(Boolean),
          directions:      profileData.directions.filter(Boolean),
          experiences:     profileData.experiences.filter((ex) => ex.place && ex.startYear),
          workplaces:      profileData.workplaces.filter(Boolean),
        }),
      });
      const profJson = await profRes.json();
      if (!profJson.success) {
        setErrorMsg(profJson.error?.message ?? "Profil ma'lumotlarini saqlashda xatolik");
        return;
      }

      setSaved(true);
      setTimeout(() => { setSaved(false); router.push("/admin/doctors"); }, 1500);
    } catch {
      setErrorMsg("Server bilan bog'lanishda xatolik");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-gray-400 text-sm text-center py-12">Yuklanmoqda...</div>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push("/admin/doctors")} className="text-gray-500 hover:text-gray-700 text-sm">
          ← Orqaga
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Shifokorni tahrirlash</h1>
      </div>

      {saved && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-700 text-sm">
          ✅ Ma'lumotlar saqlandi
        </div>
      )}
      {errorMsg && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
          ⚠️ {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Asosiy ma'lumotlar */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Asosiy ma'lumotlar</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ism *</label>
              <input className="input" required value={form.firstName}
                onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Familya *</label>
              <input className="input" required value={form.lastName}
                onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Filial</label>
              <select className="input" value={form.branchId}
                onChange={(e) => setForm((p) => ({ ...p, branchId: e.target.value }))}>
                <option value="">-- Filial yo'q --</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mutaxassislik *</label>
              <select className="input" required value={form.specialty}
                onChange={(e) => {
                  const val = e.target.value;
                  setForm((p) => ({ ...p, specialty: val }));
                  if (val) {
                    const m = services.find((s) => s.name === val);
                    if (m && !selectedServiceIds.includes(m.id))
                      setSelectedServiceIds((prev) => [...prev, m.id]);
                  }
                }}>
                <option value="">-- Mutaxassislikni tanlang --</option>
                {form.specialty && !services.some((s) => s.name === form.specialty) && (
                  <option value={form.specialty}>{form.specialty}</option>
                )}
                {services.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <PhoneInput
                label="Telefon"
                value={form.phone}
                onChange={(v) => setForm((p) => ({ ...p, phone: v }))}
                error={form.phone && !isValidPhone(form.phone) ? "Raqamni to'liq kiriting" : undefined}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Foto URL (ixtiyoriy)</label>
              <input className="input" type="url" value={form.photoUrl}
                placeholder="https://example.com/photo.jpg"
                onChange={(e) => setForm((p) => ({ ...p, photoUrl: e.target.value }))} />
              {form.photoUrl && (
                <img src={form.photoUrl} alt="preview"
                  className="w-16 h-16 rounded-full object-cover mt-2 border"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              )}
            </div>
            {services.length > 0 && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Qatnashadigan xizmatlar</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-lg p-3 bg-gray-50">
                  {services.map((svc) => (
                    <label key={svc.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox"
                        checked={selectedServiceIds.includes(svc.id)}
                        onChange={(e) => toggleService(svc.id, e.target.checked)} />
                      <span className="truncate">{svc.name} — {Number(svc.price).toLocaleString()} so&apos;m</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Profil ma'lumotlari */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Profil ma'lumotlari</h2>
          <p className="text-xs text-gray-400 mb-4">Bron kartochkasining orqa tomonida ko'rinadi (flip card)</p>
          <DoctorProfileFields value={profileData} onChange={setProfileData} />
        </div>

        <div className="flex gap-3 pb-4">
          <button type="submit" disabled={saving || saved} className="btn-primary disabled:opacity-50">
            {saving ? "Saqlanmoqda..." : saved ? "✓ Saqlandi" : "Saqlash"}
          </button>
          <button type="button" className="btn-secondary" onClick={() => router.push("/admin/doctors")}>
            Bekor
          </button>
        </div>
      </form>

      {/* Bloklangan kunlar */}
      <div className="card mt-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Bloklangan kunlar</h2>
        <p className="text-xs text-gray-400 mb-4">Shifokor kelmagan kun(lar)ni belgilang — kalendarda qizil ko'rinadi</p>
        <DoctorBlockedDatesManager doctorId={doctorId} credentials="include" />
      </div>
    </div>
  );
}
