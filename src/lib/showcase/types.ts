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
