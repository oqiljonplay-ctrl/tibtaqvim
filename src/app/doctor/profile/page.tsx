"use client";
import { useState, useEffect } from "react";
import { Stack } from "@/components/layout";

interface Experience {
  place: string;
  startYear: number;
  endYear: number | null;
}

interface DoctorProfile {
  firstName: string;
  lastName: string;
  specialty: string;
  education: string | null;
  position: string | null;
  department: string | null;
  workSchedule: string | null;
  operationsCount: number;
  bio: string | null;
  specialties: { name: string }[];
  directions:  { name: string }[];
  experiences: { place: string; startYear: number; endYear: number | null }[];
  workplaces:  { place: string }[];
}

function ListEditor({
  label,
  items,
  onChange,
  placeholder,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              value={item}
              placeholder={placeholder}
              onChange={(e) => {
                const next = [...items];
                next[i] = e.target.value;
                onChange(next);
              }}
            />
            <button
              type="button"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg text-sm font-medium"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...items, ""])}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          + Qo'shish
        </button>
      </div>
    </div>
  );
}

function ExperienceEditor({
  items,
  onChange,
}: {
  items: Experience[];
  onChange: (items: Experience[]) => void;
}) {
  const currentYear = new Date().getFullYear();

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">Tajriba</label>
      <div className="space-y-3">
        {items.map((exp, i) => (
          <div key={i} className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="Ish joyi (masalan: 1-son klinika)"
              value={exp.place}
              onChange={(e) => {
                const next = [...items];
                next[i] = { ...next[i], place: e.target.value };
                onChange(next);
              }}
            />
            <div className="flex gap-2 items-center">
              <input
                type="number"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                placeholder="Boshlangan yil"
                min={1950}
                max={currentYear}
                value={exp.startYear || ""}
                onChange={(e) => {
                  const next = [...items];
                  next[i] = { ...next[i], startYear: Number(e.target.value) };
                  onChange(next);
                }}
              />
              <span className="text-gray-400 text-sm shrink-0">—</span>
              <input
                type="number"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-100"
                placeholder="Tugagan yil"
                min={1950}
                max={currentYear + 5}
                value={exp.endYear ?? ""}
                disabled={exp.endYear === null && exp.startYear > 0}
                onChange={(e) => {
                  const next = [...items];
                  next[i] = { ...next[i], endYear: e.target.value ? Number(e.target.value) : null };
                  onChange(next);
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={exp.endYear === null}
                  onChange={(e) => {
                    const next = [...items];
                    next[i] = { ...next[i], endYear: e.target.checked ? null : currentYear };
                    onChange(next);
                  }}
                />
                Hozirgacha
              </label>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                className="text-sm text-red-500 hover:text-red-700"
              >
                O'chirish
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => onChange([...items, { place: "", startYear: new Date().getFullYear(), endYear: null }])}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          + Tajriba qo'shish
        </button>
      </div>
    </div>
  );
}

export default function DoctorProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [profile, setProfile] = useState<DoctorProfile | null>(null);

  // Form state
  const [education, setEducation]             = useState("");
  const [position, setPosition]               = useState("");
  const [department, setDepartment]           = useState("");
  const [workSchedule, setWorkSchedule]       = useState("");
  const [operationsCount, setOperationsCount] = useState(0);
  const [bio, setBio]                         = useState("");
  const [specialties, setSpecialties]         = useState<string[]>([]);
  const [directions, setDirections]           = useState<string[]>([]);
  const [experiences, setExperiences]         = useState<Experience[]>([]);
  const [workplaces, setWorkplaces]           = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/doctor/profile", { credentials: "include" })
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          const d: DoctorProfile = json.data;
          setProfile(d);
          setEducation(d.education ?? "");
          setPosition(d.position ?? "");
          setDepartment(d.department ?? "");
          setWorkSchedule(d.workSchedule ?? "");
          setOperationsCount(d.operationsCount ?? 0);
          setBio(d.bio ?? "");
          setSpecialties(d.specialties.map((s) => s.name));
          setDirections(d.directions.map((s) => s.name));
          setExperiences(d.experiences.map((e) => ({ place: e.place, startYear: e.startYear, endYear: e.endYear })));
          setWorkplaces(d.workplaces.map((w) => w.place));
        } else {
          setErrorMsg(json.error?.message ?? "Ma'lumot yuklanmadi");
        }
      })
      .catch(() => setErrorMsg("Tarmoq xatosi"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setSaved(false);
    try {
      const res = await fetch("/api/doctor/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          education: education || null,
          position: position || null,
          department: department || null,
          workSchedule: workSchedule || null,
          operationsCount,
          bio: bio || null,
          specialties: specialties.filter(Boolean),
          directions: directions.filter(Boolean),
          experiences: experiences.filter((e) => e.place && e.startYear),
          workplaces: workplaces.filter(Boolean),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setErrorMsg(json.error?.message ?? "Saqlashda xatolik");
      }
    } catch {
      setErrorMsg("Tarmoq xatosi");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 animate-pulse">Yuklanmoqda...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave}>
      <Stack gap={6}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Mening ma'lumotlarim</h1>
            {profile && (
              <p className="text-sm text-gray-500 mt-0.5">
                {profile.lastName} {profile.firstName} — {profile.specialty}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {saving ? "Saqlanmoqda..." : "Saqlash"}
          </button>
        </div>

        {saved && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-700 text-sm">
            ✅ Ma'lumotlar saqlandi
          </div>
        )}
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-red-700 text-sm">
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Asosiy maydonlar */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Asosiy ma'lumotlar</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Ta'lim</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                placeholder="Toshkent Tibbiyot Akademiyasi, 2010"
                value={education}
                onChange={(e) => setEducation(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Lavozimi</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                placeholder="Bosh shifokor, Oliy toifali"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Bo'limi</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                placeholder="Kardiologiya bo'limi"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Ish vaqti</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                placeholder="Du-Ju 9:00-18:00"
                value={workSchedule}
                onChange={(e) => setWorkSchedule(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Operatsiyalar soni</label>
              <input
                type="number"
                min={0}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                value={operationsCount}
                onChange={(e) => setOperationsCount(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Qisqa tavsif (bio)</label>
              <textarea
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                rows={3}
                placeholder="O'zingiz haqida qisqacha..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Ko'p qiymatli maydonlar */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Mutaxassisliklar va yo'nalishlar</h2>
          <Stack gap={4}>
            <ListEditor
              label="Mutaxassisliklar"
              items={specialties}
              onChange={setSpecialties}
              placeholder="Masalan: Kardiolog, Aritmolog"
            />
            <ListEditor
              label="Qabul yo'nalishlari"
              items={directions}
              onChange={setDirections}
              placeholder="Masalan: Yurak kasalliklari, EKG"
            />
          </Stack>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Tajriba va ish joylari</h2>
          <Stack gap={4}>
            <ExperienceEditor items={experiences} onChange={setExperiences} />
            <ListEditor
              label="Ish joylari"
              items={workplaces}
              onChange={setWorkplaces}
              placeholder="Masalan: Respublika klinik kasalxonasi"
            />
          </Stack>
        </div>

        <div className="flex justify-end pb-4">
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {saving ? "Saqlanmoqda..." : "Saqlash"}
          </button>
        </div>
      </Stack>
    </form>
  );
}
