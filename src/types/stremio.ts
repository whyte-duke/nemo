// ─── Types Stremio / StreamFusion ─────────────────────────────────────────────

export interface StremioStreamBehaviorHints {
  bingeGroup?: string;
  countryWhitelist?: string[];
  notWebReady?: boolean;
  videoHash?: string;
  videoSize?: number;
}

export interface StremioRawStream {
  name: string;
  title?: string;
  description?: string;
  url?: string;
  infoHash?: string;
  fileIdx?: number;
  behaviorHints?: StremioStreamBehaviorHints;
  sources?: string[];
}

export interface StremioStreamsResponse {
  streams: StremioRawStream[];
}

// ─── Flux parsé et enrichi ────────────────────────────────────────────────────

export type StreamQuality = "4K" | "1080p" | "720p" | "480p" | "SD";
export type StreamLanguage = "VF" | "VOSTFR" | "VO" | "VFF" | "MULTI";
export type StreamCodec = "HEVC" | "AV1" | "AVC" | "H264" | "H265" | "VP9";
export type StreamHDR = "HDR10+" | "HDR10" | "DV" | "SDR" | "HDR";

export interface ParsedStream {
  id: string;
  name: string;
  url: string;
  quality: StreamQuality;
  sizeMb: number | null;
  sizeLabel: string | null;
  language: StreamLanguage;
  codec: StreamCodec | null;
  hdr: StreamHDR | null;
  source: string | null;
  seeders: number | null;
  raw: StremioRawStream;
}

// ─── Résolution d'un flux ─────────────────────────────────────────────────────

export interface StreamResolutionResult {
  streams: ParsedStream[];
  isLoading: boolean;
  error: string | null;
}
