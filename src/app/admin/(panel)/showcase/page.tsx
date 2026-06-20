"use client";
import { useEffect, useState } from "react";
import { Container, Stack } from "@/components/layout";
import { LimitBar } from "@/components/admin/showcase/LimitBar";
import { ShowcaseBlockForm } from "@/components/admin/showcase/ShowcaseBlockForm";
import { ShowcaseMediaManager } from "@/components/admin/showcase/ShowcaseMediaManager";

type Tab = "doctors" | "services";

interface ShowcaseLimits {
  maxBlocksDoctors: number;
  maxBlocksServices: number;
  maxMediaPerBlock: number;
  maxImageKb: number;
  maxGifKb: number;
  maxAudioKb: number;
  maxPdfKb: number;
  storageTotalMb: number;
  allowedFormats: string[];
  allowVideoUpload: boolean;
}

interface Media {
  id: string;
  kind: "image" | "gif" | "video" | "audio" | "youtube" | "telegram" | "pdf";
  mediaSource: "upload" | "url";
  url: string | null;
  embedRef: string | null;
  title: string | null;
  shape: "original" | "circle";
  sortOrder: number;
  mimeType: string | null;
  fileSizeBytes: number | null;
}

interface Block {
  id: string;
  clinicId: string;
  tab: Tab;
  sortOrder: number;
  source: string;
  employeeId: string | null;
  serviceId: string | null;
  title: string;
  subtitle: string | null;
  showRating: boolean;
  cta: string;
  isActive: boolean;
  media: Media[];
}

export default function ShowcasePage() {
  const [tab, setTab] = useState<Tab>("doctors");
  const [limits, setLimits] = useState<ShowcaseLimits | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editBlock, setEditBlock] = useState<Block | null>(null);
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null);
  const [pageErr, setPageErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setPageErr(null);
    const [lr, br] = await Promise.all([
      fetch("/api/admin/showcase-limits", { credentials: "include" }),
      fetch(`/api/admin/showcase/blocks?tab=${tab}`, { credentials: "include" }),
    ]);
    const lj = await lr.json();
    const bj = await br.json();
    if (lj.success) setLimits(lj.data.limits);
    if (bj.success) setBlocks(bj.data);
    else setPageErr(bj.error?.message ?? "Yuklashda xato");
    setLoading(false);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [tab]);

  const max = tab === "doctors"
    ? (limits?.maxBlocksDoctors ?? 0)
    : (limits?.maxBlocksServices ?? 0);

  async function delBlock(id: string) {
    const res = await fetch(`/api/admin/showcase/blocks/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    const j = await res.json();
    if (!j.success) setPageErr(j.error?.message ?? "O'chirishda xato");
    setConfirmDelId(null);
    load();
  }

  async function move(id: string, dir: "up" | "down") {
    const i = blocks.findIndex((b) => b.id === id);
    const s = dir === "up" ? i - 1 : i + 1;
    if (s < 0 || s >= blocks.length) return;
    const updates = [
      { id: blocks[i].id, sortOrder: blocks[s].sortOrder },
      { id: blocks[s].id, sortOrder: blocks[i].sortOrder },
    ];
    await fetch("/api/admin/showcase/blocks/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ updates }),
    });
    load();
  }

  async function toggleActive(block: Block) {
    await fetch(`/api/admin/showcase/blocks/${block.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ isActive: !block.isActive }),
    });
    load();
  }

  return (
    <Container size="lg">
      <Stack gap={6}>
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Reklama vitrina</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Bemorlar webapp&apos;da ko&apos;radigan reklama bloklari
            </p>
          </div>
          <button
            onClick={() => { setEditBlock(null); setShowForm(true); setPageErr(null); }}
            disabled={max > 0 && blocks.length >= max}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-60"
          >
            + Yangi blok
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-2 bg-gray-100 p-1 rounded-xl w-fit">
          {(["doctors", "services"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setShowForm(false); setEditBlock(null); }}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
                tab === t ? "bg-white text-blue-700 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "doctors" ? "Shifokorlar" : "Xizmatlar"}
            </button>
          ))}
        </div>

        {/* Limit ko'rsatkich */}
        {limits && (
          <LimitBar
            label={tab === "doctors" ? "Shifokor bloklari" : "Xizmat bloklari"}
            current={blocks.length}
            max={max}
          />
        )}

        {/* Xato */}
        {pageErr && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-700">
            {pageErr}
          </div>
        )}

        {/* Blok forma */}
        {showForm && (
          <ShowcaseBlockForm
            tab={tab}
            block={editBlock}
            limits={limits}
            onClose={() => { setShowForm(false); setEditBlock(null); }}
            onSaved={() => { setShowForm(false); setEditBlock(null); load(); }}
          />
        )}

        {/* Bloklar ro'yxati */}
        {loading ? (
          <Stack gap={3}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </Stack>
        ) : blocks.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            <div className="text-4xl mb-3">🗂️</div>
            <p className="text-gray-500 text-sm">
              Hozircha blok yo&apos;q. &quot;+ Yangi blok&quot; tugmasini bosing.
            </p>
          </div>
        ) : (
          <Stack gap={4}>
            {blocks.map((b, i) => (
              <div
                key={b.id}
                className={`bg-white rounded-2xl border shadow-sm p-4 ${
                  b.isActive ? "border-gray-200" : "border-gray-100 opacity-70"
                }`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900 truncate">{b.title}</span>
                      {!b.isActive && (
                        <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">
                          yashirin
                        </span>
                      )}
                    </div>
                    {b.subtitle && (
                      <div className="text-sm text-blue-600 mt-0.5">{b.subtitle}</div>
                    )}
                    <div className="text-xs text-gray-400 mt-1">
                      {b.source === "em" ? "Shifokor" : b.source === "service" ? "Xizmat" : "Qo'lda"} ·{" "}
                      {b.media.length} media · #{i + 1}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    <button
                      onClick={() => move(b.id, "up")}
                      disabled={i === 0}
                      title="Yuqoriga"
                      className="px-2 py-1 text-gray-400 disabled:opacity-30 hover:text-gray-700 text-sm"
                    >↑</button>
                    <button
                      onClick={() => move(b.id, "down")}
                      disabled={i === blocks.length - 1}
                      title="Pastga"
                      className="px-2 py-1 text-gray-400 disabled:opacity-30 hover:text-gray-700 text-sm"
                    >↓</button>
                    <button
                      onClick={() => toggleActive(b)}
                      className="px-3 py-1 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      {b.isActive ? "Yashir" : "Ko'rsat"}
                    </button>
                    <button
                      onClick={() => { setEditBlock(b); setShowForm(true); setPageErr(null); }}
                      className="px-3 py-1 text-sm text-blue-600 hover:text-blue-700"
                    >
                      Tahrir
                    </button>
                    <button
                      onClick={() => setConfirmDelId(b.id)}
                      className="px-3 py-1 text-sm text-red-600 hover:text-red-700"
                    >
                      O&apos;chirish
                    </button>
                  </div>
                </div>

                {/* Media menejeri */}
                <ShowcaseMediaManager block={b} limits={limits} onChange={load} />
              </div>
            ))}
          </Stack>
        )}

        {/* Blok o'chirish confirm */}
        {confirmDelId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-xl">
              <h3 className="font-semibold text-lg mb-2">Blokni o&apos;chirish</h3>
              <p className="text-gray-600 text-sm mb-4">
                Blok va uning barcha mediasi (yuklangan fayllar ham) o&apos;chiriladi. Qaytarib
                bo&apos;lmaydi.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setConfirmDelId(null)}
                  className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50"
                >
                  Bekor
                </button>
                <button
                  onClick={() => delBlock(confirmDelId)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
                >
                  Ha, o&apos;chirish
                </button>
              </div>
            </div>
          </div>
        )}
      </Stack>
    </Container>
  );
}
