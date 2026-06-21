"use client";

import { useState } from "react";
import { TelegramPostEmbed } from "@/components/webapp/TelegramPostEmbed";
import type { ShowcaseMedia } from "@/lib/showcase/types";

function openExternal(url: string) {
  const tg =
    typeof window !== "undefined"
      ? (window as unknown as { Telegram?: { WebApp?: { openLink?: (u: string) => void } } })
          .Telegram?.WebApp
      : undefined;
  if (tg?.openLink) tg.openLink(url);
  else window.open(url, "_blank", "noopener,noreferrer");
}

function parseTelegramEmbedId(embedRef: string): string {
  return embedRef.replace(/^https?:\/\/t\.me\//i, "").replace(/^\//, "");
}

function aspectStyle(m: ShowcaseMedia): React.CSSProperties {
  if (m.aspectW && m.aspectH) return { aspectRatio: `${m.aspectW} / ${m.aspectH}` };
  if (m.kind === "youtube") return { aspectRatio: "16 / 9" };
  if (m.shape === "circle") return { aspectRatio: "1 / 1" };
  return {};
}

function NeutralFallback({ label }: { label: string }) {
  return (
    <div className="w-full h-full min-h-[120px] flex items-center justify-center bg-gray-50 border border-gray-100 rounded-xl">
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  );
}

export function ShowcaseMediaRenderer({ media }: { media: ShowcaseMedia }) {
  const [imgBroken, setImgBroken] = useState(false);
  const rounded = media.shape === "circle" ? "rounded-full" : "rounded-xl";

  switch (media.kind) {
    case "image":
    case "gif": {
      if (!media.url || imgBroken) return <NeutralFallback label="Rasm yuklanmadi" />;

      if (media.shape === "circle") {
        return (
          <div className="flex flex-col items-center">
            <img
              src={media.url}
              alt={media.title ?? ""}
              onError={() => setImgBroken(true)}
              className={`${rounded} object-cover w-28 h-28 border border-gray-100`}
              loading="lazy"
            />
            {media.title && (
              <span className="mt-1 text-xs text-gray-500">{media.title}</span>
            )}
          </div>
        );
      }

      return (
        <img
          src={media.url}
          alt={media.title ?? ""}
          onError={() => setImgBroken(true)}
          className={`${rounded} object-cover w-full`}
          style={{
            ...aspectStyle(media),
            ...(media.aspectW && media.aspectH ? {} : { maxHeight: 320 }),
          }}
          loading="lazy"
        />
      );
    }

    case "youtube": {
      const id = (media.embedRef ?? "").trim();
      if (!id) return <NeutralFallback label="Video manzili yo'q" />;
      const thumb = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
      return (
        <button
          type="button"
          onClick={() => openExternal(`https://youtu.be/${id}`)}
          className="relative w-full rounded-xl overflow-hidden border border-gray-100"
          style={{ aspectRatio: "16 / 9" }}
          aria-label={media.title ? `${media.title} — videoni ochish` : "Videoni ochish"}
        >
          <img
            src={thumb}
            alt={media.title ?? "YouTube"}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex items-center justify-center w-14 h-14 rounded-full bg-black/60">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </span>
          {media.title && (
            <span className="absolute bottom-0 inset-x-0 px-2 py-1 text-left text-xs text-white bg-gradient-to-t from-black/70 to-transparent">
              {media.title}
            </span>
          )}
        </button>
      );
    }

    case "telegram": {
      const ref = media.embedRef ?? "";
      const embedId = parseTelegramEmbedId(ref);
      if (!embedId) return <NeutralFallback label="Telegram post yo'q" />;
      return <TelegramPostEmbed embedId={embedId} />;
    }

    case "video": {
      if (!media.url) return <NeutralFallback label="Video yo'q" />;
      return (
        <video
          src={media.url}
          autoPlay
          muted
          playsInline
          loop
          controls
          poster={media.posterUrl ?? undefined}
          className={`${rounded} w-full object-cover`}
          style={media.aspectW && media.aspectH ? aspectStyle(media) : { maxHeight: 360 }}
        />
      );
    }

    case "audio": {
      if (!media.url) return <NeutralFallback label="Audio yo'q" />;
      return (
        <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl">
          {media.posterUrl && (
            <img
              src={media.posterUrl}
              alt={media.title ?? "cover"}
              className="w-16 h-16 rounded-lg object-cover mb-2"
              loading="lazy"
            />
          )}
          <audio controls src={media.url} className="w-full" />
          {media.title && <p className="text-xs text-gray-500 mt-1">{media.title}</p>}
        </div>
      );
    }

    case "pdf": {
      if (!media.url) return <NeutralFallback label="PDF yo'q" />;
      return (
        <a
          href={media.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl"
        >
          <span className="text-xl" aria-hidden="true">📄</span>
          <span className="text-sm text-blue-600 truncate">
            {media.title ?? "PDF faylni ochish"}
          </span>
        </a>
      );
    }

    default:
      return null;
  }
}
