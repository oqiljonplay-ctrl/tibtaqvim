"use client";
import { useState, useEffect, useCallback } from "react";

const WEEKDAYS = [
  { label: "Yakshanba", short: "Ya", value: 0 },
  { label: "Dushanba",  short: "Du", value: 1 },
  { label: "Seshanba",  short: "Se", value: 2 },
  { label: "Chorshanba",short: "Ch", value: 3 },
  { label: "Payshanba", short: "Pa", value: 4 },
  { label: "Juma",      short: "Ju", value: 5 },
  { label: "Shanba",    short: "Sh", value: 6 },
];

interface BlockItem {
  id: string;
  type: "recurring" | "once";
  weekday: number | null;
  date: string | null;
  reason: string | null;
  createdAt: string;
}

interface Props {
  doctorId: string;
  credentials?: RequestCredentials;
}

export function DoctorBlockedDatesManager({ doctorId, credentials = "include" }: Props) {
  const [blocks, setBlocks] = useState<BlockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form state
  const [type, setType] = useState<"recurring" | "once">("recurring");
  const [weekday, setWeekday] = useState<number>(1);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");

  const fetchBlocks = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/doctors/${doctorId}/blocked-dates`, { credentials });
      const j = await r.json();
      if (j.success) setBlocks(j.data ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [doctorId, credentials]);

  useEffect(() => { fetchBlocks(); }, [fetchBlocks]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setErrMsg(null);
    setSuccessMsg(null);
    setSaving(true);
    try {
      const body: Record<string, unknown> = { type, reason: reason.trim() || null };
      if (type === "recurring") body.weekday = weekday;
      else body.date = date;

      const r = await fetch(`/api/doctors/${doctorId}/blocked-dates`, {
        method: "POST",
        credentials,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (j.success) {
        setSuccessMsg("Blok qo'shildi");
        setReason("");
        setDate("");
        fetchBlocks();
      } else {
        setErrMsg(j.error?.message ?? "Xatolik");
      }
    } catch {
      setErrMsg("Server bilan bog'lanishda xatolik");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(blockId: string) {
    try {
      const r = await fetch(`/api/doctors/${doctorId}/blocked-dates/${blockId}`, {
        method: "DELETE",
        credentials,
      });
      const j = await r.json();
      if (j.success) fetchBlocks();
    } catch {
      // ignore
    }
  }

  function blockLabel(b: BlockItem) {
    if (b.type === "recurring") {
      const day = WEEKDAYS.find((w) => w.value === b.weekday);
      return `Har ${day?.label ?? b.weekday}`;
    }
    return b.date ?? "—";
  }

  return (
    <div className="space-y-4">
      {/* Mavjud bloklar */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Bloklangan kunlar</h3>
        {loading ? (
          <p className="text-sm text-gray-400">Yuklanmoqda...</p>
        ) : blocks.length === 0 ? (
          <p className="text-sm text-gray-400">Bloklangan kun yo'q</p>
        ) : (
          <ul className="space-y-2">
            {blocks.map((b) => (
              <li key={b.id} className="flex items-center justify-between bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                <div>
                  <span className="text-sm font-medium text-red-800">{blockLabel(b)}</span>
                  {b.reason && <span className="ml-2 text-xs text-red-500">— {b.reason}</span>}
                </div>
                <button
                  onClick={() => handleDelete(b.id)}
                  className="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded-lg hover:bg-red-100 transition-colors"
                >
                  O'chirish
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Yangi blok qo'shish formasi */}
      <form onSubmit={handleAdd} className="bg-gray-50 rounded-xl p-3 space-y-3 border border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700">Yangi blok qo'shish</h3>

        {/* Tur */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setType("recurring")}
            className={`flex-1 py-2 text-sm rounded-lg font-medium transition-colors ${
              type === "recurring"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            Takroriy kun
          </button>
          <button
            type="button"
            onClick={() => setType("once")}
            className={`flex-1 py-2 text-sm rounded-lg font-medium transition-colors ${
              type === "once"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            Bir martalik
          </button>
        </div>

        {/* Takroriy → haftaning kuni */}
        {type === "recurring" && (
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Qaysi kun?</label>
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((w) => (
                <button
                  key={w.value}
                  type="button"
                  onClick={() => setWeekday(w.value)}
                  className={`h-9 text-xs font-medium rounded-lg transition-colors ${
                    weekday === w.value
                      ? "bg-red-500 text-white"
                      : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                  }`}
                  title={w.label}
                >
                  {w.short}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Bir martalik → aniq sana */}
        {type === "once" && (
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Qaysi sana?</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={new Date().toLocaleDateString("sv-SE")}
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
        )}

        {/* Sabab (ixtiyoriy) */}
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Sabab (ixtiyoriy)</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Masalan: Ta'tilday, O'quv seminari..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>

        {errMsg && <p className="text-xs text-red-500">{errMsg}</p>}
        {successMsg && <p className="text-xs text-green-600">{successMsg}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-2 bg-red-500 text-white text-sm font-medium rounded-xl hover:bg-red-600 disabled:opacity-60 transition-colors"
        >
          {saving ? "Saqlanmoqda..." : "Bloklash"}
        </button>
      </form>
    </div>
  );
}
