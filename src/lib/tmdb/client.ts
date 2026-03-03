import type {
  TMDbMovie,
  TMDbMovieDetail,
  TMDbTVShow,
  TMDbTVShowDetail,
  TMDbPaginatedResponse,
  TMDbPerson,
  TMDbPersonCredits,
  TMDbSearchResult,
  TMDbSeason,
  TMDbEpisode,
} from "@/types/tmdb";

const BASE_URL = process.env.NEXT_PUBLIC_TMDB_BASE_URL ?? "https://api.themoviedb.org/3";
const API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY ?? "";

const DEFAULT_PARAMS = new URLSearchParams({
  language: "fr-FR",
  region: "FR",
});

// ─── Fetch interne avec cache Next.js ─────────────────────────────────────────

async function tmdbFetch<T>(
  endpoint: string,
  params: Record<string, string | number | boolean> = {},
  options: RequestInit = {}
): Promise<T> {
  const url = new URL(`${BASE_URL}${endpoint}`);

  url.searchParams.set("api_key", API_KEY);
  url.searchParams.set("language", "fr-FR");
  url.searchParams.set("region", "FR");

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const res = await fetch(url.toString(), {
    next: { revalidate: 3600 },
    ...options,
  });

  if (!res.ok) {
    throw new Error(`TMDb API error: ${res.status} ${res.statusText} — ${endpoint}`);
  }

  return res.json() as Promise<T>;
}

// ─── IMAGE HELPERS ────────────────────────────────────────────────────────────

const IMAGE_BASE = "https://image.tmdb.org/t/p";

export const tmdbImage = {
  poster: (path: string | null, size: "w185" | "w342" | "w500" | "w780" | "original" = "w500") =>
    path ? `${IMAGE_BASE}/${size}${path}` : null,
  backdrop: (path: string | null, size: "w780" | "w1280" | "original" = "w1280") =>
    path ? `${IMAGE_BASE}/${size}${path}` : null,
  profile: (path: string | null, size: "w45" | "w185" | "h632" | "original" = "w185") =>
    path ? `${IMAGE_BASE}/${size}${path}` : null,
  logo: (path: string | null, size: "w45" | "w92" | "w154" | "w185" | "w300" | "w500" | "original" = "w300") =>
    path ? `${IMAGE_BASE}/${size}${path}` : null,
  still: (path: string | null, size: "w92" | "w185" | "w300" | "original" = "w300") =>
    path ? `${IMAGE_BASE}/${size}${path}` : null,
};

// ─── TRENDING ─────────────────────────────────────────────────────────────────

export async function getTrending(
  type: "movie" | "tv" | "all" = "all",
  timeWindow: "day" | "week" = "week"
): Promise<TMDbPaginatedResponse<TMDbMovie & TMDbTVShow>> {
  return tmdbFetch(`/trending/${type}/${timeWindow}`);
}

// ─── DÉCOUVERTE ───────────────────────────────────────────────────────────────

export async function discoverMovies(
  params: Record<string, string | number | boolean> = {},
  page = 1
): Promise<TMDbPaginatedResponse<TMDbMovie>> {
  return tmdbFetch("/discover/movie", { sort_by: "popularity.desc", page, ...params });
}

export async function discoverTV(
  params: Record<string, string | number | boolean> = {},
  page = 1
): Promise<TMDbPaginatedResponse<TMDbTVShow>> {
  return tmdbFetch("/discover/tv", { sort_by: "popularity.desc", page, ...params });
}

// ─── FILMS ────────────────────────────────────────────────────────────────────

/** Résumé léger (titre + poster) pour listes. */
export async function getMovieSummary(
  id: number
): Promise<{ id: number; title: string; poster_path: string | null }> {
  return tmdbFetch(`/movie/${id}`);
}

export async function getMovieDetail(id: number): Promise<TMDbMovieDetail> {
  return tmdbFetch(`/movie/${id}`, {
    append_to_response: "credits,videos,images,similar,recommendations,release_dates,watch/providers",
    include_image_language: "fr,null,en",
  });
}

export async function getTopRatedMovies(page = 1): Promise<TMDbPaginatedResponse<TMDbMovie>> {
  return tmdbFetch("/movie/top_rated", { page });
}

export async function getNowPlayingMovies(page = 1): Promise<TMDbPaginatedResponse<TMDbMovie>> {
  return tmdbFetch("/movie/now_playing", { page });
}

export async function getUpcomingMovies(page = 1): Promise<TMDbPaginatedResponse<TMDbMovie>> {
  return tmdbFetch("/movie/upcoming", { page });
}

export async function getPopularMovies(page = 1): Promise<TMDbPaginatedResponse<TMDbMovie>> {
  return tmdbFetch("/movie/popular", { page });
}

// ─── SÉRIES ───────────────────────────────────────────────────────────────────

/** Résumé léger (nom + poster) pour listes. */
export async function getTVShowSummary(
  id: number
): Promise<{ id: number; name: string; poster_path: string | null }> {
  return tmdbFetch(`/tv/${id}`);
}

export async function getTVShowDetail(id: number): Promise<TMDbTVShowDetail> {
  return tmdbFetch(`/tv/${id}`, {
    append_to_response: "credits,videos,images,similar,recommendations,content_ratings,watch/providers,external_ids",
    include_image_language: "fr,null,en",
  });
}

export async function getTopRatedTV(page = 1): Promise<TMDbPaginatedResponse<TMDbTVShow>> {
  return tmdbFetch("/tv/top_rated", { page });
}

export async function getPopularTV(page = 1): Promise<TMDbPaginatedResponse<TMDbTVShow>> {
  return tmdbFetch("/tv/popular", { page });
}

export async function getOnAirTV(page = 1): Promise<TMDbPaginatedResponse<TMDbTVShow>> {
  return tmdbFetch("/tv/on_the_air", { page });
}

export async function getTVSeason(showId: number, seasonNumber: number): Promise<TMDbSeason & { episodes: TMDbEpisode[] }> {
  return tmdbFetch(`/tv/${showId}/season/${seasonNumber}`);
}

// ─── PROVIDERS / HUBS ─────────────────────────────────────────────────────────

export async function getMoviesByProvider(
  providerId: number,
  page = 1,
  sortBy = "popularity.desc"
): Promise<TMDbPaginatedResponse<TMDbMovie>> {
  return tmdbFetch("/discover/movie", {
    with_watch_providers: providerId,
    watch_region: "FR",
    sort_by: sortBy,
    page,
  });
}

export async function getTVByProvider(
  providerId: number,
  page = 1,
  sortBy = "popularity.desc"
): Promise<TMDbPaginatedResponse<TMDbTVShow>> {
  return tmdbFetch("/discover/tv", {
    with_watch_providers: providerId,
    watch_region: "FR",
    sort_by: sortBy,
    page,
  });
}

// ─── PERSONNES ────────────────────────────────────────────────────────────────

export async function getPersonDetail(id: number): Promise<TMDbPerson> {
  return tmdbFetch(`/person/${id}`);
}

export async function getPersonMovieCredits(id: number): Promise<TMDbPersonCredits> {
  return tmdbFetch(`/person/${id}/movie_credits`);
}

export async function getPersonTVCredits(id: number): Promise<TMDbPersonCredits> {
  return tmdbFetch(`/person/${id}/tv_credits`);
}

export async function getPopularPeople(page = 1): Promise<TMDbPaginatedResponse<TMDbPerson>> {
  return tmdbFetch("/person/popular", { page });
}

// ─── RECHERCHE ────────────────────────────────────────────────────────────────

export async function searchMulti(
  query: string,
  page = 1
): Promise<TMDbPaginatedResponse<TMDbSearchResult>> {
  return tmdbFetch("/search/multi", { query, page, include_adult: false });
}

export async function searchMovies(
  query: string,
  page = 1
): Promise<TMDbPaginatedResponse<TMDbMovie>> {
  return tmdbFetch("/search/movie", { query, page, include_adult: false });
}

export async function searchTV(
  query: string,
  page = 1
): Promise<TMDbPaginatedResponse<TMDbTVShow>> {
  return tmdbFetch("/search/tv", { query, page, include_adult: false });
}

// ─── GENRES ───────────────────────────────────────────────────────────────────

export async function getMovieGenres(): Promise<{ genres: Array<{ id: number; name: string }> }> {
  return tmdbFetch("/genre/movie/list");
}

export async function getTVGenres(): Promise<{ genres: Array<{ id: number; name: string }> }> {
  return tmdbFetch("/genre/tv/list");
}

// ─── UTILITAIRES ─────────────────────────────────────────────────────────────

export function getTrailerKey(videos: { results: Array<{ type: string; site: string; key: string; official: boolean }> }): string | null {
  const trailers = videos.results.filter(
    (v) => v.site === "YouTube" && v.type === "Trailer"
  );
  const official = trailers.find((t) => t.official);
  return official?.key ?? trailers[0]?.key ?? null;
}

export function getWatchProvidersForFR(
  providers: { results: { FR?: { flatrate?: unknown[]; link: string } } } | undefined
) {
  return providers?.results?.FR ?? null;
}

void DEFAULT_PARAMS;
