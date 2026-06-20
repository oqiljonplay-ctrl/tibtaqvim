"use client";
import { useState, useRef } from "react";
import { Stack } from "@/components/layout";

type MediaKind = "image" | "gif" | "video" | "audio" | "youtube" | "telegram" | "pdf";
type MediaSource = "upload" | "url";
type Shape = "original" | "circle";

interface Media {
  id: string;
  kind: MediaKind;
  mediaSource: MediaSource;
  url: string | null;
  embedRef: string | null;
  title: string | null;
  shape: Shape;
  sortOrder: number;
  mimeType: string | null;
  fileSizeBytes: number | null;
}

interface Block {
  id: string;
  clinicId: string;
  media: Media[];
}

interface Limits {
  maxImageKb: number;
  maxGifKb: number;
  maxAudioKb: number;
  maxPdfKb: number;
  allowedFormats: string[];
  maxMediaPerBlock: number;
}

interface Props {
  block: Block;
  limits: Limits | null;
  onChange: () => void;
}

const KIND_LABEL: Record<MediaKind, string> = {
  image: "Rasm", gif: "GIF", video: "Video", audio: "Audio",
  youtube: "YouTube", telegram: "Telegram", pdf: "PDF",
};

const KIND_ICON: Record<MediaKind, string> = {
  image: "🖼️", gif: "🎞️", video: "🎬", audio: "🎵",
  youtube: "▶️", telegram: "✈️", pdf: "📄",
};

function extractYoutubeId(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

export function ShowcaseMediaManager({ block, limits, onChange }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [addMode, setAddMode] = useState<"upload" | "link">("upload");
  const [kind, setKind] = useState<MediaKind>("image");
  const [shape, setShape] = useState<Shape>("original");
  const [linkUrl, setLinkUrl] = useState("");
  const [mediaTitle, setMediaTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const allowedKinds = limits
    ? (["image", "gif", "audio", "pdf"] as MediaKind[]).filter((k) =>
        limits.allowedFormats.includes(k)
      )
    : (["image", "gif", "audio", "pdf"] as MediaKind[]);

  const linkKinds = limits
    ? (["youtube", "telegram", "image"] as const).filter((k) =>
        limits.allowedFormats.includes(k === "image" ? "url" : k)
      )
    : (["youtube", "telegram", "image"] as const);

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) { setErr("Fayl tanlanmadi"); return; }
    const kbLimit =
      kind === "image" ? limits?.maxImageKb :
      kind === "gif"   ? limits?.maxGifKb :
      kind === "audio" ? limits?.maxAudioKb :
      kind === "pdf"   ? limits?.maxPdfKb : 0;
    if (kbLimit && file.size > kbLimit * 1024) {
      setErr(`Fayl katta: ${Math.round(file.size / 1024)}KB > ${kbLimit}KB`);
      return;
    }
    setErr(null); setSaving(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);
    fd.append("shape", shape);
    fd.append("title", mediaTitle);
    if (kind === "image" || kind === "gif") {
      await new Promise<void>((res) => {
        const img = new Image();
        img.onload = () => {
          fd.append("aspectW", String(img.naturalWidth));
          fd.append("aspectH", String(img.naturalHeight));
          URL.revokeObjectURL(img.src);
          res();
        };
        img.onerror = () => res();
        img.src = URL.createObjectURL(file);
      });
    }
    const r = await fetch(`/api/admin/showcase/blocks/${block.id}/media`, {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    const j = await r.json();
    setSaving(false);
    if (!j.success) { setErr(j.error?.message ?? "Yuklashda xato"); return; }
    setShowAdd(false);
    setMediaTitle("");
    if (fileRef.current) fileRef.current.value = "";
    onChange();
  }

  async function handleLink() {
    setErr(null);
    let embedRef: string | null = null;
    let url: string | null = null;
    if (kind === "youtube") {
      const vid = extractYoutubeId(linkUrl);
      if (!vid) { setErr("YouTube URL noto'g'ri"); return; }
      embedRef = vid;
    } else if (kind === "telegram") {
      if (!linkUrl.trim()) { setErr("Telegram havola kerak"); return; }
      embedRef = linkUrl.trim();
    } else {
      if (!linkUrl.trim()) { setErr("URL kerak"); return; }
      url = linkUrl.trim();
    }
    setSaving(true);
    const r = await fetch(`/api/admin/showcase/blocks/${block.id}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ kind, mediaSource: "url", url, embedRef, title: mediaTitle || null, shape }),
    });
    const j = await r.json();
    setSaving(false);
    if (!j.success) { setErr(j.error?.message ?? "Qo'shishda xato"); return; }
    setShowAdd(false);
    setLinkUrl("");
    setMediaTitle("");
    onChange();
  }

  async function deleteMedia(id: string) {
    const r = await fetch(`/api/admin/showcase/media/${id}`, { method: "DELETE", credentials: "include" });
    const j = await r.json();
    if (!j.success) { setErr(j.error?.message ?? "O'chirishda xato"); }
    setConfirmDelId(null);
    onChange();
  }

  async function moveMedia(id: string, dir: "up" | "down") {
    const media = block.media;
    const i = media.findIndex((m) => m.id === id);
    const s = dir === "up" ? i - 1 : i + 1;
    if (s < 0 || s >= media.length) return;
    const updates = [
      { id: media[i].id, sortOrder: media[s].sortOrder },
      { id: media[s].id, sortOrder: media[i].sortOrder },
    ];
    await fetch("/api/admin/showcase/media/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ updates }),
    });
    onChange();
  }

  const inputCls = "w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      {err && (
        <div className="mb-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-xs text-red-700">
          {err}
        </div>
      )}

      {/* Media ro'yxati */}
      {block.media.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {block.media.map((m, i) => (
            <div key={m.id} className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-xl px-2 py-1.5 text-xs">
              <span>{KIND_ICON[m.kind]}</span>
              <span className="text-gray-700">{m.title || KIND_LABEL[m.kind]}</span>
              {m.fileSizeBytes && (
                <span className="text-gray-400">{Math.round(m.fileSizeBytes / 1024)}KB</span>
              )}
              <div className="flex items-center gap-0.5 ml-1">
                <button
                  onClick={() => moveMedia(m.id, "up")}
                  disabled={i === 0}
                  className="px-1 text-gray-400 disabled:opacity-30 hover:text-gray-700"
                >↑</button>
                <button
                  onClick={() => moveMedia(m.id, "down")}
                  disabled={i === block.media.length - 1}
                  className="px-1 text-gray-400 disabled:opacity-30 hover:text-gray-700"
                >↓</button>
                <button
                  onClick={() => setConfirmDelId(m.id)}
                  className="px-1 text-red-400 hover:text-red-600"
                >✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Media qo'shish tugmasi */}
      {!showAdd && (
        <button
          onClick={() => { setShowAdd(true); setErr(null); }}
          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          + Media qo&apos;shish
        </button>
      )}

      {/* Media qo'shish forma */}
      {showAdd && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mt-2">
          {/* Yuklash / Havola tab */}
          <div className="flex gap-2 mb-3">
            {(["upload", "link"] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setAddMode(m); setErr(null); setLinkUrl(""); setMediaTitle(""); }}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${addMode === m ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600"}`}
              >
                {m === "upload" ? "📎 Yuklash" : "🔗 Havola"}
              </button>
            ))}
          </div>

          <Stack gap={3}>
            {addMode === "upload" ? (
              <>
                {/* Kind tanlov */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Format</label>
                  <select
                    value={kind}
                    onChange={(e) => setKind(e.target.value as MediaKind)}
                    className={inputCls + " bg-white text-xs"}
                  >
                    {allowedKinds.map((k) => (
                      <option key={k} value={k}>{KIND_LABEL[k]}</option>
                    ))}
                  </select>
                </div>
                {/* Fayl */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Fayl{kind === "image" ? " (jpg/png/webp)" : kind === "gif" ? " (.gif)" : kind === "audio" ? " (.mp3)" : " (.pdf)"}
                  </label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept={
                      kind === "image" ? "image/jpeg,image/png,image/webp" :
                      kind === "gif"   ? "image/gif" :
                      kind === "audio" ? "audio/mpeg" :
                      "application/pdf"
                    }
                    className="text-xs text-gray-600 file:mr-2 file:px-2 file:py-1 file:text-xs file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700"
                  />
                  {kind === "image" && limits?.maxImageKb && (
                    <p className="text-xs text-gray-400 mt-0.5">Maks: {limits.maxImageKb}KB</p>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Havola turi */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Havola turi</label>
                  <select
                    value={kind}
                    onChange={(e) => { setKind(e.target.value as MediaKind); setLinkUrl(""); }}
                    className={inputCls + " bg-white text-xs"}
                  >
                    {linkKinds.includes("youtube") && <option value="youtube">YouTube</option>}
                    {linkKinds.includes("telegram") && <option value="telegram">Telegram post</option>}
                    {linkKinds.includes("image") && <option value="image">Rasm URL</option>}
                  </select>
                </div>
                {/* Telegram ogohlantirish */}
                {kind === "telegram" && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-800">
                    ⚠️ Faqat <strong>play tugmasi bosiladigan kichik video</strong> yoki{" "}
                    <strong>bittalik post</strong> havolasini joylang. Kanal/guruhga yo&apos;naltiruvchi
                    &quot;video is long&quot; postlar dizaynni buzadi va bemorga ko&apos;rinmaydi.
                    Videoni kanalga <strong>alohida, qisqa</strong> holda joylang.
                  </div>
                )}
                {/* URL input */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {kind === "youtube" ? "YouTube URL (youtube.com/watch?v=...)" :
                     kind === "telegram" ? "Telegram post URL" : "Rasm URL"}
                  </label>
                  <input
                    type="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder={
                      kind === "youtube" ? "https://youtu.be/..." :
                      kind === "telegram" ? "https://t.me/channel/123" : "https://..."
                    }
                    className={inputCls + " text-xs"}
                  />
                </div>
              </>
            )}

            {/* Shakl */}
            {(kind === "image" || kind === "gif") && (
              <div className="flex gap-4">
                {(["original", "circle"] as Shape[]).map((sh) => (
                  <label key={sh} className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="radio"
                      value={sh}
                      checked={shape === sh}
                      onChange={() => setShape(sh)}
                      className="accent-blue-600"
                    />
                    {sh === "original" ? "Asl o'lcham" : "Doira"}
                  </label>
                ))}
              </div>
            )}

            {/* Sarlavha */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Sarlavha (ixtiyoriy)
              </label>
              <input
                type="text"
                value={mediaTitle}
                onChange={(e) => setMediaTitle(e.target.value)}
                placeholder="Media sarlavhasi"
                className={inputCls + " text-xs"}
              />
            </div>

            {/* Tugmalar */}
            <div className="flex gap-2">
              <button
                onClick={addMode === "upload" ? handleUpload : handleLink}
                disabled={saving}
                className="px-4 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 transition disabled:opacity-60"
              >
                {saving ? "Yuklanmoqda..." : "Qo'shish"}
              </button>
              <button
                onClick={() => { setShowAdd(false); setErr(null); setLinkUrl(""); setMediaTitle(""); }}
                className="px-4 py-1.5 bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-300 transition"
              >
                Bekor
              </button>
            </div>
          </Stack>
        </div>
      )}

      {/* Delete confirm */}
      {confirmDelId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-5 max-w-xs mx-4 shadow-xl">
            <h3 className="font-semibold mb-2">Mediani o&apos;chirish</h3>
            <p className="text-gray-600 text-sm mb-4">
              Media o&apos;chiriladi. Yuklangan fayl ham Supabase'dan o&apos;chiriladi.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDelId(null)}
                className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50"
              >
                Bekor
              </button>
              <button
                onClick={() => deleteMedia(confirmDelId)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm"
              >
                O&apos;chirish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
