// ─── Types pour l'API de téléchargement (backend Python / n8n) ────────────────

export interface ProbeStream {
  index: number;
  codec_type: "video" | "audio" | "subtitle";
  language: string;
  title: string;
}

export interface ProbeResponse {
  status: "success" | "error";
  streams: ProbeStream[];
}

export interface DownloadMetadata {
  title: string;
  type: "movie" | "tv";
  user_id: string;
  user_name: string;
  tmdb_id?: number;
  season_number?: number;
  episode_number?: number;
}

export interface DownloadRequest {
  url: string;
  selected_indices: number[];
  destination_path: string;
  metadata: DownloadMetadata;
}

export interface BatchDownloadRequest {
  urls: string[];
  reference_indices: number[];
  destination_dir: string;
  metadata: DownloadMetadata;
}

export interface DownloadApiResponse {
  status: "success" | "error";
  message?: string;
  error?: string;
}

// ─── Webhook entrant depuis le backend Python ─────────────────────────────────

export interface WebhookPayload {
  status: "success" | "error";
  download_id?: string;
  media_title?: string;
  file_path?: string;
  error_log?: string;
}

// ─── Entrée DB (file de téléchargement) ──────────────────────────────────────

export type DownloadStatus = "pending" | "downloading" | "completed" | "error";

export interface DownloadQueueRow {
  id: string;
  user_id: string;
  user_name: string;
  media_title: string;
  media_type: "movie" | "tv";
  tmdb_id: number | null;
  season_number: number | null;
  episode_number: number | null;
  quality: string | null;
  audio_languages: string[];
  sub_languages: string[];
  selected_indices: number[];
  destination_path: string;
  source_urls: string[];
  is_batch: boolean;
  status: DownloadStatus;
  error_log: string | null;
  file_path: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Contexte passé depuis MovieDetailContent / TVDetailContent ───────────────

export interface DownloadMediaInfo {
  streamUrl: string;
  title: string;
  type: "movie" | "tv";
  year?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  episodeTitle?: string;
  tmdbId?: number;
}
