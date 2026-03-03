// ─── Types de base TMDb ───────────────────────────────────────────────────────

export type MediaType = "movie" | "tv" | "person";

export interface TMDbImage {
  aspect_ratio: number;
  file_path: string;
  height: number;
  width: number;
  vote_average: number;
  vote_count: number;
  iso_639_1: string | null;
}

export interface TMDbVideo {
  id: string;
  iso_639_1: string;
  iso_3166_1: string;
  key: string;
  name: string;
  official: boolean;
  published_at: string;
  site: string;
  size: number;
  type: string;
}

export interface TMDbGenre {
  id: number;
  name: string;
}

export interface TMDbProductionCompany {
  id: number;
  logo_path: string | null;
  name: string;
  origin_country: string;
}

export interface TMDbCastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
  known_for_department: string;
  popularity: number;
}

export interface TMDbCrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

export interface TMDbCredits {
  cast: TMDbCastMember[];
  crew: TMDbCrewMember[];
}

export interface TMDbReleaseDateEntry {
  certification: string;
  release_date: string;
  type: number;
}

export interface TMDbReleaseDates {
  results: Array<{
    iso_3166_1: string;
    release_dates: TMDbReleaseDateEntry[];
  }>;
}

export interface TMDbWatchProvider {
  logo_path: string;
  provider_id: number;
  provider_name: string;
  display_priority: number;
}

export interface TMDbWatchProviderResult {
  results: {
    [country: string]: {
      link: string;
      flatrate?: TMDbWatchProvider[];
      rent?: TMDbWatchProvider[];
      buy?: TMDbWatchProvider[];
    };
  };
}

// ─── Film (Movie) ─────────────────────────────────────────────────────────────

export interface TMDbMovie {
  id: number;
  imdb_id: string | null;
  title: string;
  original_title: string;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  adult: boolean;
  genres: TMDbGenre[];
  genre_ids?: number[];
  runtime: number | null;
  status: string;
  tagline: string | null;
  original_language: string;
  production_companies: TMDbProductionCompany[];
  belongs_to_collection: {
    id: number;
    name: string;
    poster_path: string | null;
    backdrop_path: string | null;
  } | null;
}

export interface TMDbMovieDetail extends TMDbMovie {
  budget?: number;
  revenue?: number;
  credits: TMDbCredits;
  videos: { results: TMDbVideo[] };
  images: {
    backdrops: TMDbImage[];
    posters: TMDbImage[];
    logos: TMDbImage[];
  };
  similar: TMDbPaginatedResponse<TMDbMovie>;
  recommendations: TMDbPaginatedResponse<TMDbMovie>;
  release_dates: TMDbReleaseDates;
  "watch/providers": TMDbWatchProviderResult;
}

// ─── Série TV (TV Show) ───────────────────────────────────────────────────────

export interface TMDbSeason {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  season_number: number;
  episode_count: number;
  air_date: string | null;
  vote_average: number;
}

export interface TMDbEpisode {
  id: number;
  name: string;
  overview: string;
  still_path: string | null;
  episode_number: number;
  season_number: number;
  air_date: string | null;
  vote_average: number;
  runtime: number | null;
}

export interface TMDbTVShow {
  id: number;
  name: string;
  original_name: string;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genres: TMDbGenre[];
  genre_ids?: number[];
  number_of_seasons: number;
  number_of_episodes: number;
  status: string;
  tagline: string | null;
  original_language: string;
  created_by: Array<{
    id: number;
    name: string;
    profile_path: string | null;
  }>;
  networks: TMDbProductionCompany[];
  seasons: TMDbSeason[];
  production_companies: TMDbProductionCompany[];
  last_air_date: string | null;
  in_production: boolean;
}

export interface TMDbTVShowDetail extends TMDbTVShow {
  credits: TMDbCredits;
  videos: { results: TMDbVideo[] };
  images: {
    backdrops: TMDbImage[];
    posters: TMDbImage[];
    logos: TMDbImage[];
  };
  similar: TMDbPaginatedResponse<TMDbTVShow>;
  recommendations: TMDbPaginatedResponse<TMDbTVShow>;
  content_ratings: {
    results: Array<{ iso_3166_1: string; rating: string }>;
  };
  "watch/providers": TMDbWatchProviderResult;
  external_ids?: {
    imdb_id: string | null;
    tvdb_id?: number | null;
    wikidata_id?: string | null;
  };
}

// ─── Personne / Acteur ────────────────────────────────────────────────────────

export interface TMDbPerson {
  id: number;
  name: string;
  biography: string | null;
  birthday: string | null;
  deathday: string | null;
  place_of_birth: string | null;
  profile_path: string | null;
  known_for_department: string;
  popularity: number;
  also_known_as: string[];
  homepage: string | null;
  imdb_id: string | null;
  gender: number;
}

export interface TMDbPersonMovieCredit {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  character: string;
  job: string;
  popularity: number;
  genre_ids: number[];
}

export interface TMDbPersonCredits {
  cast: TMDbPersonMovieCredit[];
  crew: TMDbPersonMovieCredit[];
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface TMDbPaginatedResponse<T> {
  page: number;
  results: T[];
  total_pages: number;
  total_results: number;
}

// ─── Recherche ────────────────────────────────────────────────────────────────

export interface TMDbSearchResult {
  id: number;
  media_type: MediaType;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  profile_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  popularity: number;
  genre_ids?: number[];
  known_for_department?: string;
}

// ─── Providers connus ─────────────────────────────────────────────────────────

export const WATCH_PROVIDERS = {
  NETFLIX: { id: 8, name: "Netflix", color: "#E50914" },
  APPLE_TV: { id: 350, name: "Apple TV+", color: "#000000" },
  CANAL_PLUS: { id: 381, name: "Canal+", color: "#000000" },
  DISNEY_PLUS: { id: 337, name: "Disney+", color: "#113CCF" },
  AMAZON: { id: 119, name: "Amazon Prime Video", color: "#00A8E1" },
  OCS: { id: 56, name: "OCS", color: "#FF6600" },
  PARAMOUNT: { id: 531, name: "Paramount+", color: "#0064FF" },
  MAX: { id: 1899, name: "Max", color: "#002BE7" },
} as const;

export type WatchProviderKey = keyof typeof WATCH_PROVIDERS;
