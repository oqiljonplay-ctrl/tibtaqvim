"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Container, Stack } from "@/components/layout";

declare global { interface Window { Telegram?: { WebApp?: any } } }

interface Dependent { id: string; firstName: string; lastName: string | null; phone: string | null; relation: string | null }
interface Profile { id: string; fullName: string; firstName: string; lastName: string | null; phone: string | null; tibId: string | null; dependents: Dependent[]; canAddDependent: boolean }

function waitForTG(ms = 3000): Promise<any> {
  return new Promise((res) => {
    if (window.Telegram?.WebApp) return res(window.Telegram.WebApp);
    const s = Date.now(), t = setInterval(() => {
      if (window.Telegram?.WebApp) { clearInterval(t); res(window.Telegram.WebApp); }
      else if (Date.now() - s > ms) { clearInterval(t); res(null); }
    }, 50);
  });
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [telegramId, setTelegramId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Add dependent
  const [addingDep, setAddingDep] = useState(false);
  const [newDepName, setNewDepName] = useState("");
  const [newDepLast, setNewDepLast] = useState("");
  const [newDepRel, setNewDepRel] = useState("");
  const [depSaving, setDepSaving] = useState(false);

  async function fetchProfile(tgId: string) {
    const r = await fetch(`/api/user/by-telegram?telegramId=${tgId}`);
    const j = await r.json();
    if (j.success) {
      setProfile(j.data);
      setFirstName(j.data.firstName || "");
      setLastName(j.data.lastName || "");
    }
    setLoading(false);
  }

  useEffect(() => {
    waitForTG().then(async (tg) => {
      if (tg) { tg.ready(); tg.expand(); }
      let tgId: string | null = null;
      if (tg?.initDataUnsafe?.user?.id) tgId = String(tg.initDataUnsafe.user.id);
      if (!tgId) tgId = new URLSearchParams(window.location.search).get("tgid");
      setTelegramId(tgId);
      if (tgId) {
        await fetchProfile(tgId);
      } else {
        setLoading(false);
      }
    });
  }, []);

  async function handleSaveProfile() {
    if (!telegramId) return;
    setSaving(true); setErr(null);
    try {
      // Profile editing via /api/user/update-name
      const res = await fetch("/api/user/update-name", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegramId, firstName: firstName.trim(), lastName: lastName.trim() || null }),
      });
      const j = await res.json();
      if (!j.success) { setErr(j.error?.message || "Xatolik"); return; }
      await fetchProfile(telegramId);
      setEditing(false);
    } catch { setErr("Tarmoq xatosi"); }
    finally { setSaving(false); }
  }

  async function handleAddDependent() {
    if (!telegramId) return;
    if (!newDepName.trim() || newDepName.length < 2) { setErr("Ism kamida 2 harf bo'lishi kerak"); return; }
    setDepSaving(true); setErr(null);
    try {
      const res = await fetch("/api/dependents/by-telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegramId, firstName: newDepName.trim(), lastName: newDepLast.trim() || null, relation: newDepRel || null }),
      });
      const j = await res.json();
      if (!j.success) { setErr(j.error?.message || "Qo'shib bo'lmadi"); return; }
      await fetchProfile(telegramId);
      setAddingDep(false); setNewDepName(""); setNewDepLast(""); setNewDepRel("");
    } catch { setErr("Tarmoq xatosi"); }
    finally { setDepSaving(false); }
  }

  async function handleDeleteDependent(depId: string) {
    if (!telegramId) return;
    if (!confirm("Rostdan ham o'chirishni xohlaysizmi?")) return;
    try {
      // Delete by telegramId-scoped endpoint
      const res = await fetch(`/api/dependents/by-telegram/${depId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telegramId }),
      });
      if (res.ok) await fetchProfile(telegramId);
    } catch {}
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen text-gray-400 text-sm">Yuklanmoqda...</div>;
  if (!profile) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
      <div className="text-4xl mb-4">🔐</div>
      <p className="text-gray-500 text-sm mb-4">Profil topilmadi. Telegram orqali kiring.</p>
      <button onClick={() => router.push("/webapp")} className="text-blue-600 text-sm">← Asosiy sahifaga</button>
    </div>
  );

  return (
    <Container size="sm" className="min-h-[100dvh] bg-gray-50">
      <div className="bg-white shadow-sm py-3 sticky top-0 z-10 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-blue-600 text-sm">←</button>
        <h1 className="text-lg font-bold flex-1">Mening profilim</h1>
        {profile.tibId && <span className="text-xs font-mono bg-blue-50 text-blue-600 px-2 py-1 rounded">{profile.tibId}</span>}
      </div>

      <Stack gap={4} className="py-4">
        {err && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-2">
            <span className="text-red-500">⚠️</span>
            <p className="text-red-700 text-sm flex-1">{err}</p>
            <button onClick={() => setErr(null)} className="text-red-400">×</button>
          </div>
        )}

        {/* Profile card */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm">👤 Ma&apos;lumotlarim</h2>
            {!editing && (
              <button onClick={() => setEditing(true)} className="text-blue-600 text-sm">✏️ Tahrirlash</button>
            )}
          </div>

          {editing ? (
            <div className="space-y-2">
              <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ism" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" maxLength={50} />
              <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                placeholder="Familiya" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" maxLength={50} />
              <div className="flex gap-2">
                <button onClick={handleSaveProfile} disabled={saving}
                  className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
                  {saving ? "Saqlanmoqda..." : "Saqlash"}
                </button>
                <button onClick={() => { setEditing(false); setFirstName(profile.firstName); setLastName(profile.lastName || ""); }}
                  className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm">Bekor</button>
              </div>
            </div>
          ) : (
            <div className="space-y-1 text-sm">
              <div><span className="text-gray-500">Ism familiya:</span> <strong>{profile.fullName}</strong></div>
              <div><span className="text-gray-500">Telefon:</span> {profile.phone || "—"}</div>
              <p className="text-xs text-gray-400 mt-2">ℹ️ Telefon Telegram orqali bog&apos;langan</p>
            </div>
          )}
        </div>

        {/* Dependents */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="font-semibold text-sm mb-3">
            👨‍👩‍👧 Qaramog&apos;imdagilar ({profile.dependents.length}/2)
          </h2>

          {profile.dependents.length === 0 && !addingDep && (
            <p className="text-sm text-gray-400 mb-3">Hali qo&apos;shilmagan</p>
          )}

          <div className="space-y-2 mb-3">
            {profile.dependents.map((dep) => {
              const name = [dep.firstName, dep.lastName].filter(Boolean).join(" ");
              return (
                <div key={dep.id} className="p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{name}</div>
                    <div className="text-xs text-gray-500">{dep.relation || "Qaramog'imdagi"}{dep.phone && ` · ${dep.phone}`}</div>
                  </div>
                  <button onClick={() => handleDeleteDependent(dep.id)} className="text-red-400 text-lg leading-none hover:text-red-600">🗑</button>
                </div>
              );
            })}
          </div>

          {addingDep && (
            <div className="p-3 bg-gray-50 rounded-xl space-y-2 mb-3">
              <input type="text" placeholder="Ism *" value={newDepName} onChange={(e) => setNewDepName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white" maxLength={50} />
              <input type="text" placeholder="Familiya" value={newDepLast} onChange={(e) => setNewDepLast(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white" maxLength={50} />
              <select value={newDepRel} onChange={(e) => setNewDepRel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                <option value="">— Kim bo&apos;ladi (ixtiyoriy) —</option>
                {["Onam","Otam","O'g'lim","Qizim","Xotinim","Erim","Aka","Singil","Boshqa"].map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button onClick={handleAddDependent} disabled={depSaving}
                  className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
                  {depSaving ? "Saqlanmoqda..." : "Qo'shish"}
                </button>
                <button onClick={() => { setAddingDep(false); setNewDepName(""); setNewDepLast(""); setNewDepRel(""); }}
                  className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm">Bekor</button>
              </div>
            </div>
          )}

          {profile.canAddDependent && !addingDep && (
            <button onClick={() => setAddingDep(true)}
              className="w-full p-3 rounded-xl border-2 border-dashed border-gray-300 text-sm text-gray-600 hover:bg-gray-50">
              ➕ Yangi qo&apos;shish
            </button>
          )}
        </div>
      </Stack>
    </Container>
  );
}
