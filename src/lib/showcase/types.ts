export type ShowcaseMediaKind =
  | "image" | "gif" | "video" | "audio" | "youtube" | "telegram" | "pdf";
export type ShowcaseMediaSource = "upload" | "url";
export type ShowcaseShape = "original" | "circle";
export type ShowcaseSource = "em" | "service" | "manual";
export type ShowcaseCta = "auto" | "generic";
export type ShowcaseTab = "doctors" | "services";

export type ShowcaseMedia = {
  id: string;
  sortOrder: number;
  kind: ShowcaseMediaKind;
  mediaSource: ShowcaseMediaSource;
  url: string | null;
  embedRef: string | null;
  posterUrl: string | null;
  shape: ShowcaseShape;
  aspectW: number | null;
  aspectH: number | null;
  title: string | null;
  caption: string | null;
};

export type ShowcaseRating = { value: number; count: number };

export type ShowcaseBlock = {
  id: string;
  tab: ShowcaseTab;
  sortOrder: number;
  source: ShowcaseSource;
  employeeId: string | null;
  serviceId: string | null;
  title: string;
  subtitle: string | null;
  cta: ShowcaseCta;
  rating: ShowcaseRating | null;
  media: ShowcaseMedia[];
};

export type ShowcaseResponse = {
  success: boolean;
  data?: { tab: ShowcaseTab; blocks: ShowcaseBlock[] };
  error?: { code: string; message: string };
};

// ── 4-bosqich: vitrina o'lchami ──────────────────────────────
export type ShowcaseSize = "S" | "M" | "L" | "XL";

/** Coverflow element BALANDLIGI (px). Kenglik = balandlik × aspect. */
export const SHOWCASE_SIZE_PX: Record<ShowcaseSize, number> = {
  S: 140,
  M: 190,
  L: 250,
  XL: 320,
};

export const SHOWCASE_SIZE_DEFAULT: ShowcaseSize = "M";
export const SHOWCASE_SIZE_KEY = "tibtaqvim_showcase_size";

/** Coverflow elementining width/height nisbati. */
export function showcaseAspectRatio(m: {
  shape: "original" | "circle";
  aspectW: number | null;
  aspectH: number | null;
  kind: string;
}): number {
  if (m.shape === "circle") return 1;
  if (m.aspectW && m.aspectH) return m.aspectW / m.aspectH;
  if (m.kind === "youtube" || m.kind === "video") return 16 / 9;
  return 4 / 3;
}

/** Coverflow'da ko'rsatiladigan "ramkali vizual" kindlar. Qolganlari pastda stack. */
export const GALLERY_KINDS = ["image", "gif", "youtube", "video"] as const;
export function isGalleryKind(k: string): boolean {
  return (GALLERY_KINDS as readonly string[]).includes(k);
}
