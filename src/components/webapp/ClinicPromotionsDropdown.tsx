"use client";
import { useEffect, useState } from "react";
import { TelegramPostEmbed } from "./TelegramPostEmbed";

// ─── Types ────────────────────────────────────────────────────────────────────

type PromotionType = "aksiya" | "yangilik" | "elon" | "umumiy";

interface Promotion {
  id: string;
  embedId: string;
  postUrl: string;
  type: PromotionType;
  source: "kanal" | "guruh";
  title: string | null;
  showSubscribeButton: boolean;
  subscribeUsername: string | null;
  publishedAt: string;
}

interface Props {
  clinicId: string;
  tgid?: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<PromotionType, string> = {
  aksiya: "Aksiya", yangilik: "Yangilik", elon: "E'lon", umumiy: "Umumiy",
};

const TYPE_GRADIENT: Record<PromotionType, string> = {
  aksiya:   "from-pink-500 to-rose-500",
  yangilik: "from-blue-500 to-blue-600",
  elon:     "from-amber-400 to-orange-400",
  umumiy:   "from-gray-400 to-gray-500",
};

const TYPE_BG: Record<PromotionType, string> = {
  aksiya:   "bg-pink-50 text-pink-700 border-pink-100",
  yangilik: "bg-blue-50 text-blue-700 border-blue-100",
  elon:     "bg-amber-50 text-amber-700 border-amber-100",
  umumiy:   "bg-gray-100 text-gray-600 border-gray-200",
};

const FILTERS: { key: PromotionType | "all"; label: string }[] = [
  { key: "all", label: "Hammasi" },
  { key: "aksiya", label: "Aksiya" },
  { key: "yangilik", label: "Yangilik" },
  { key: "elon", label: "E'lon" },
];

// ─── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden animate-pulse">
      <div className="h-[140px] bg-gradient-to-r from-gray-100 via-gray-50 to-gray-100" />
      <div className="p-3 space-y-2">
        <div className="h-3 bg-gray-100 rounded w-1/4" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function ClinicPromotionsDropdown({ clinicId, tgid }: Props) {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<PromotionType | "all">("all");

  useEffect(() => {
    if (!clinicId) return;
    setLoading(true);
    const url = tgid
      ? `/api/webapp/clinics/${clinicId}/promotions?tgid=${encodeURIComponent(tgid)}`
      : `/api/webapp/clinics/${clinicId}/promotions`;
    fetch(url)
      .then((r) => r.json())
      .then((d) => setPromotions(d.data?.promotions ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clinicId, tgid]);

  const filtered = filter === "all" ? promotions : promotions.filter((p) => p.type === filter);
  const hasFilter = promotions.some((p) => p.type !== "umumiy");

  return (
    <div
      className="overflow-hidden"
      style={{
        background: "var(--surface)",
      }}
    >
      {/* Liquid top accent */}
      <div className="h-px bg-gradient-to-r from-transparent via-blue-200 to-transparent mb-3" />

      {/* Filter chips — faqat 2+ tur bo'lganda */}
      {hasFilter && !loading && promotions.length > 0 && (
        <div className="flex gap-2 px-3 pb-3 overflow-x-auto scrollbar-hide">
          {FILTERS.map((f) => {
            const count = f.key === "all" ? promotions.length : promotions.filter((p) => p.type === f.key).length;
            if (f.key !== "all" && count === 0) return null;
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                  active
                    ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-sm shadow-blue-200"
                    : "bg-white text-gray-600 border border-gray-200 hover:border-blue-200 hover:text-blue-600"
                }`}
              >
                {f.label}
                {f.key !== "all" && count > 0 && (
                  <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      <div className="px-3 pb-4 space-y-3">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center">
            <div className="text-3xl mb-2">📭</div>
            <p className="text-gray-400 text-sm">Hozircha e'lon yo'q</p>
          </div>
        ) : (
          filtered.map((p) => (
            <PromotionCard key={p.id} promotion={p} />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Promotion Card ───────────────────────────────────────────────────────────

function PromotionCard({ promotion: p }: { promotion: Promotion }) {
  return (
    <div className="rounded-2xl border border-gray-100/80 bg-white shadow-sm overflow-hidden active:scale-[0.99] transition-transform">
      {/* Gradient top strip */}
      <div className={`h-1 bg-gradient-to-r ${TYPE_GRADIENT[p.type]}`} />

      {/* Badges row */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${TYPE_BG[p.type]}`}>
          {TYPE_LABEL[p.type]}
        </span>
        <span className="text-[11px] text-gray-400">
          {p.source === "kanal" ? "📢 Kanal" : "👥 Guruh"}
        </span>
        {p.title && (
          <span className="text-xs text-gray-600 truncate flex-1 font-medium">{p.title}</span>
        )}
      </div>

      {/* Telegram embed */}
      <div className="px-2 pb-2">
        <TelegramPostEmbed embedId={p.embedId} />
      </div>

      {/* Subscribe button */}
      {p.showSubscribeButton && p.subscribeUsername && (
        <div className="px-3 pb-3">
          <a
            href={`https://t.me/${p.subscribeUsername}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-[0.98]"
            style={{
              background: "var(--elevated)",
              boxShadow: "0 2px 8px rgba(37,99,235,0.25)",
            }}
          >
            <span className="text-base">{p.source === "kanal" ? "📢" : "👥"}</span>
            {p.source === "kanal" ? "Kanalga obuna bo'lish" : "Guruhga qo'shilish"}
          </a>
        </div>
      )}
    </div>
  );
}
