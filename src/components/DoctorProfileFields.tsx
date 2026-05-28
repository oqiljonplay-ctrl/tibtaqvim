"use client";
import { useState } from "react";
import { Stack } from "@/components/layout";

export interface DoctorProfileData {
  education: string;
  position: string;
  department: string;
  workSchedule: string;
  operationsCount: number;
  bio: string;
  specialties: string[];
  directions: string[];
  experiences: { place: string; startYear: number; endYear: number | null }[];
  workplaces: string[];
}

export function emptyProfileData(): DoctorProfileData {
  return {
    education: "", position: "", department: "", workSchedule: "",
    operationsCount: 0, bio: "",
    specialties: [], directions: [], experiences: [], workplaces: [],
  };
}

export function profileFromServer(data: {
  education?: string | null; position?: string | null; department?: string | null;
  workSchedule?: string | null; operationsCount?: number; bio?: string | null;
  specialties?: { name: string }[]; directions?: { name: string }[];
  experiences?: { place: string; startYear: number; endYear: number | null }[];
  workplaces?: { place: string }[];
}): DoctorProfileData {
  return {
    education:      data.education      ?? "",
    position:       data.position       ?? "",
    department:     data.department     ?? "",
    workSchedule:   data.workSchedule   ?? "",
    operationsCount: data.operationsCount ?? 0,
    bio:            data.bio            ?? "",
    specialties:   (data.specialties   ?? []).map((s) => s.name),
    directions:    (data.directions    ?? []).map((s) => s.name),
    experiences:   (data.experiences   ?? []).map((e) => ({ place: e.place, startYear: e.startYear, endYear: e.endYear })),
    workplaces:    (data.workplaces    ?? []).map((w) => w.place),
  };
}

function ListEditor({
  label, items, onChange, placeholder,
}: { label: string; items: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              value={item} placeholder={placeholder}
              onChange={(e) => { const n = [...items]; n[i] = e.target.value; onChange(n); }}
            />
            <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg text-sm">✕</button>
          </div>
        ))}
        <button type="button" onClick={() => onChange([...items, ""])}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium">+ Qo'shish</button>
      </div>
    </div>
  );
}

function ExperienceEditor({ items, onChange }: {
  items: { place: string; startYear: number; endYear: number | null }[];
  onChange: (v: { place: string; startYear: number; endYear: number | null }[]) => void;
}) {
  const cy = new Date().getFullYear();
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">Tajriba</label>
      <div className="space-y-3">
        {items.map((exp, i) => (
          <div key={i} className="border border-gray-200 rounded-lg p-3 bg-gray-50 space-y-2">
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="Ish joyi nomi"
              value={exp.place}
              onChange={(e) => { const n = [...items]; n[i] = { ...n[i], place: e.target.value }; onChange(n); }}
            />
            <div className="flex gap-2 items-center">
              <input type="number" min={1950} max={cy}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                placeholder="Bosh. yil" value={exp.startYear || ""}
                onChange={(e) => { const n = [...items]; n[i] = { ...n[i], startYear: Number(e.target.value) }; onChange(n); }}
              />
              <span className="text-gray-400 text-sm shrink-0">—</span>
              <input type="number" min={1950} max={cy + 5}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-100"
                placeholder="Tug. yil" value={exp.endYear ?? ""}
                disabled={exp.endYear === null}
                onChange={(e) => { const n = [...items]; n[i] = { ...n[i], endYear: e.target.value ? Number(e.target.value) : null }; onChange(n); }}
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={exp.endYear === null}
                  onChange={(e) => { const n = [...items]; n[i] = { ...n[i], endYear: e.target.checked ? null : cy }; onChange(n); }}
                />
                Hozirgacha
              </label>
              <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))}
                className="text-sm text-red-500 hover:text-red-700">O'chirish</button>
            </div>
          </div>
        ))}
        <button type="button"
          onClick={() => onChange([...items, { place: "", startYear: new Date().getFullYear(), endYear: null }])}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium">+ Tajriba qo'shish</button>
      </div>
    </div>
  );
}

export function DoctorProfileFields({
  value, onChange,
}: { value: DoctorProfileData; onChange: (v: DoctorProfileData) => void }) {
  function set<K extends keyof DoctorProfileData>(k: K, v: DoctorProfileData[K]) {
    onChange({ ...value, [k]: v });
  }

  return (
    <Stack gap={6}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Ta'lim</label>
          <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="Toshkent Tibbiyot Akademiyasi, 2010"
            value={value.education}
            onChange={(e) => set("education", e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Lavozimi</label>
          <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="Bosh shifokor, Oliy toifali"
            value={value.position}
            onChange={(e) => set("position", e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Bo'limi</label>
          <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="Kardiologiya bo'limi"
            value={value.department}
            onChange={(e) => set("department", e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Ish vaqti</label>
          <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="Du-Ju 9:00-18:00"
            value={value.workSchedule}
            onChange={(e) => set("workSchedule", e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Operatsiyalar soni</label>
          <input type="number" min={0}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            value={value.operationsCount}
            onChange={(e) => set("operationsCount", Number(e.target.value))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Bio (qisqa tavsif)</label>
          <textarea rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
            placeholder="Shifokor haqida qisqacha..."
            value={value.bio}
            onChange={(e) => set("bio", e.target.value)} />
        </div>
      </div>

      <ListEditor label="Mutaxassisliklar" items={value.specialties}
        onChange={(v) => set("specialties", v)}
        placeholder="Masalan: Kardiolog, Aritmolog" />

      <ListEditor label="Qabul yo'nalishlari" items={value.directions}
        onChange={(v) => set("directions", v)}
        placeholder="Masalan: Yurak kasalliklari, EKG" />

      <ExperienceEditor items={value.experiences}
        onChange={(v) => set("experiences", v)} />

      <ListEditor label="Ish joylari" items={value.workplaces}
        onChange={(v) => set("workplaces", v)}
        placeholder="Masalan: Respublika klinik kasalxonasi" />
    </Stack>
  );
}
