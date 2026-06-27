"use client";

import { useEffect, useRef, useState } from "react";
import { TelegramPostEmbed } from "@/components/webapp/TelegramPostEmbed";
import { useImageAlpha } from "@/lib/webapp/use-image-alpha";
import type { ShowcaseMedia } from "@/lib/showcase/types";

function openExternal(url: string) {
  const tg =
    typeof window !== "undefined"
      ? (window as unknown as {
          Telegram?: { WebApp?: { openLink?: (u: string) => void } };
        }).Telegram?.WebApp
      : undefined;
  if (tg?.openLink) tg.openLink(url);
  else window.open(url, "_blank", "noopener,noreferrer");
}

function parseTelegramEmbedId(embedRef: string): string {
  return embedRef.replace(/^https?:\/\/t\.me\//i, "").replace(/^\//, "");
}

type Props = {
  media: ShowcaseMedia;
  active?: boolean;
  fill?: boolean;
};

export function ShowcaseMediaRenderer({ media, active = true, fill = false }: Props) {
  const [imgBroken, setImgBroken] = useState(false);
  const [ytPlaying, setYtPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Video: faqat markazda o'ynaydi
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (active) v.play().catch(() => {});
    else v.pause();
  }, [active]);

  // YouTube: markazdan chiqsa to'xtaydi (iframe unmount)
  useEffect(() => {
    if (!active) setYtPlaying(false);
  }, [active]);

  const alphaEnabled =
    (media.kind === "image" || media.kind === "gif") && media.mediaSource === "upload";
  const alpha = useImageAlpha(alphaEnabled ? media.url : null, alphaEnabled);
  const transparent = alpha === "transparent";

  const fillCls = fill ? "h-full w-full" : "w-full";

  switch (media.kind) {
    case "image":
    case "gif": {
      if (media.shape === "circle") {
        if (imgBroken || !media.url) {
          return (
            <div
              className={`${fill ? "h-full w-full" : "w-28 h-28"} rounded-full flex items-center justify-center bg-[var(--media)]`}
              style={{ border: "1px solid var(--border)" }}
            >
              <span className="text-2xl" style={{ color: "var(--text-muted)" }}>👤</span>
            </div>
          );
        }
        return (
          <img
            src={media.url}
            alt={media.title ?? ""}
            loading="lazy"
            decoding="async"
            onError={() => setImgBroken(true)}
            className={`${fill ? "h-full w-full" : "w-28 h-28"} rounded-full object-cover`}
            style={{ border: "1px solid var(--border)" }}
          />
        );
      }
      if (!media.url || imgBroken) {
        return (
          <div className="h-full w-full min-h-[100px] flex items-center justify-center bg-[var(--media)] border border-gray-100 rounded-xl">
            <span className="text-xs text-gray-400">Rasm yuklanmadi</span>
          </div>
        );
      }
      if (transparent) {
        return (
          <div className={`${fillCls} flex items-center justify-center bg-[var(--media)] rounded-xl overflow-hidden`}>
            <img
              src={media.url}
              alt={media.title ?? ""}
              loading="lazy"
              decoding="async"
              onError={() => setImgBroken(true)}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        );
      }
      return (
        <img
          src={media.url}
          alt={media.title ?? ""}
          loading="lazy"
          decoding="async"
          onError={() => setImgBroken(true)}
          className={`${fillCls} object-cover rounded-xl`}
          style={fill ? undefined : { maxHeight: 320 }}
        />
      );
    }

    // ── YouTube: tap → ICHKI iframe ijro (5a) ──
    case "youtube": {
      const id = (media.embedRef ?? "").trim();
      if (!id)
        return (
          <div className="h-full w-full flex items-center justify-center bg-[var(--media)] rounded-xl text-xs text-gray-400">
            Video manzili yo&apos;q
          </div>
        );

      if (ytPlaying) {
        return (
          <iframe
            src={`https://www.youtube.com/embed/${id}?autoplay=1&playsinline=1&rel=0&modestbranding=1`}
            title={media.title ?? "YouTube"}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className={`${fill ? "h-full w-full" : "w-full"} rounded-xl`}
            style={{ border: 0, ...(fill ? {} : { aspectRatio: "16 / 9" }) }}
          />
        );
      }

      const thumb = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
      return (
        <button
          type="button"
          onClick={() => setYtPlaying(true)}
          className={`relative ${fill ? "h-full w-full" : "w-full"} rounded-xl overflow-hidden`}
          style={fill ? undefined : { aspectRatio: "16 / 9" }}
          aria-label={media.title ? `${media.title} — ijro` : "Videoni ijro qilish"}
        >
          <img src={thumb} alt={media.title ?? "YouTube"} className="w-full h-full object-cover" loading="lazy" decoding="async" />
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex items-center justify-center w-14 h-14 rounded-full bg-black/60">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
            </span>
          </span>
        </button>
      );
    }

    case "video": {
      if (!media.url)
        return (
          <div className="h-full w-full flex items-center justify-center bg-[var(--media)] rounded-xl text-xs text-gray-400">
            Video yo&apos;q
          </div>
        );
      return (
        <video
          ref={videoRef}
          src={media.url}
          muted
          playsInline
          loop
          controls
          poster={media.posterUrl ?? undefined}
          className={`${fillCls} object-cover rounded-xl`}
          style={fill ? undefined : { maxHeight: 360 }}
        />
      );
    }

    case "telegram": {
      const ref = media.embedRef ?? "";
      const embedId = parseTelegramEmbedId(ref);
      if (!embedId)
        return (
          <div className="w-full p-3 bg-[var(--media)] border border-gray-100 rounded-xl text-xs text-gray-400">
            Telegram post yo&apos;q
          </div>
        );
      return <TelegramPostEmbed embedId={embedId} />;
    }

    case "audio": {
      if (!media.url) return null;
      return (
        <div className="p-3 bg-[var(--media)] border border-gray-100 rounded-xl">
          {media.posterUrl && (
            <img src={media.posterUrl} alt={media.title ?? "cover"} className="w-16 h-16 rounded-lg object-cover mb-2" loading="lazy" decoding="async" />
          )}
          <audio controls src={media.url} className="w-full" />
          {media.title && <p className="text-xs text-gray-500 mt-1">{media.title}</p>}
        </div>
      );
    }

    case "pdf": {
      if (!media.url) return null;
      return (
        <a href={media.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 bg-[var(--media)] border border-gray-200 rounded-xl">
          <span className="text-xl" aria-hidden="true">📄</span>
          <span className="text-sm text-blue-600 truncate">{media.title ?? "PDF faylni ochish"}</span>
        </a>
      );
    }

    default:
      return null;
  }
}
