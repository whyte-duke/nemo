// ─── Types API Jellyfin (alignés sur les réponses serveur) ───────────────────

export interface JellyfinUser {
  Id: string;
  Name: string;
  ServerId?: string;
  HasPassword?: boolean;
  LastLoginDate?: string;
  LastActivityDate?: string;
  Configuration?: {
    PlayDefaultAudioTrack?: boolean;
    SubtitleLanguagePreference?: string;
    DisplayMissingEpisodes?: boolean;
  };
}

export interface JellyfinAuthenticationResult {
  User: JellyfinUser;
  AccessToken: string;
  ServerId?: string;
  SessionInfo?: unknown;
}

// ─── Items (bibliothèque, played, favorites) ───────────────────────────────────

export interface JellyfinProviderIds {
  Tmdb?: string;
  Imdb?: string;
  Tvdb?: string;
}

export interface JellyfinMediaStream {
  Index: number;
  Type: "Video" | "Audio" | "Subtitle" | "EmbeddedImage" | string;
  Codec?: string;
  Language?: string;
  DisplayTitle?: string;
  IsDefault?: boolean;
  IsForced?: boolean;
  IsExternal?: boolean;
  Path?: string;
  DeliveryMethod?: "Hls" | "External" | "Embed" | string;
  DeliveryUrl?: string;
}

export interface JellyfinMediaSource {
  Id?: string;
  Container?: string;
  Size?: number;
  Bitrate?: number;
  TranscodingUrl?: string;
  TranscodingSubProtocol?: string;
  TranscodingContainer?: string;
  DirectStreamUrl?: string;
  MediaStreams?: JellyfinMediaStream[];
}

export interface JellyfinBaseItem {
  Id: string;
  Name: string;
  Type: "Movie" | "Series" | "Episode" | "Season" | "BoxSet" | string;
  ServerId?: string;
  IsFolder?: boolean;
  RunTimeTicks?: number;
  ProductionYear?: number;
  ProviderIds?: JellyfinProviderIds;
  UserData?: {
    PlaybackPositionTicks?: number;
    PlayedPercentage?: number;
    PlayCount?: number;
    IsFavorite?: boolean;
    LastPlayedDate?: string;
    Played?: boolean;
  };
  MediaSources?: JellyfinMediaSource[];
  Overview?: string;
  ImageTags?: Record<string, string>;
  BackdropImageTags?: string[];
  /** Champs épisode */
  SeriesName?: string;
  SeriesId?: string;
  SeasonName?: string;
  IndexNumber?: number;
  ParentIndexNumber?: number;
  ParentBackdropItemId?: string;
  ParentBackdropImageTags?: string[];
  ParentThumbItemId?: string;
  ParentThumbImageTag?: string;
}

export interface JellyfinItemsResponse {
  Items: JellyfinBaseItem[];
  TotalRecordCount: number;
}

// ─── Playback (MediaInfo) ────────────────────────────────────────────────────

export interface JellyfinPlaybackInfoResponse {
  MediaSources?: Array<{
    Id?: string;
    Container?: string;
    Size?: number;
    TranscodingUrl?: string;
    TranscodingSubProtocol?: string;
    DirectStreamUrl?: string;
    MediaStreams?: JellyfinMediaStream[];
  }>;
}

// ─── Résumés pour NEMO (mapping TMDB ↔ Jellyfin) ─────────────────────────────

export interface JellyfinItemSummary {
  itemId: string;
  name: string;
  type: "Movie" | "Series";
  tmdbId: number | null;
  imdbId: string | null;
  isPlayed: boolean;
  isFavorite: boolean;
  playCount: number;
  lastPlayedDate: string | null;
  resumePositionTicks: number;
}
