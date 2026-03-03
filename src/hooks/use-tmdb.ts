"use client";

import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import {
  getTrending,
  getMovieDetail,
  getTVShowDetail,
  discoverMovies,
  discoverTV,
  getTopRatedMovies,
  getNowPlayingMovies,
  getUpcomingMovies,
  getPopularMovies,
  getTopRatedTV,
  getPopularTV,
  getOnAirTV,
  getPersonDetail,
  getPersonMovieCredits,
  getPersonTVCredits,
  searchMulti,
  searchMovies,
  searchTV,
  getMoviesByProvider,
  getTVByProvider,
  getTVSeason,
  getMovieGenres,
  getTVGenres,
} from "@/lib/tmdb/client";

// ─── Clés de cache ────────────────────────────────────────────────────────────

export const tmdbKeys = {
  all: ["tmdb"] as const,
  trending: (type: string, window: string) => ["tmdb", "trending", type, window] as const,
  movie: (id: number) => ["tmdb", "movie", id] as const,
  tvShow: (id: number) => ["tmdb", "tv", id] as const,
  tvSeason: (showId: number, season: number) => ["tmdb", "tv", showId, "season", season] as const,
  person: (id: number) => ["tmdb", "person", id] as const,
  personMovieCredits: (id: number) => ["tmdb", "person", id, "movies"] as const,
  personTVCredits: (id: number) => ["tmdb", "person", id, "tv"] as const,
  discover: (type: string, params: object) => ["tmdb", "discover", type, params] as const,
  provider: (type: string, id: number) => ["tmdb", "provider", type, id] as const,
  search: (query: string) => ["tmdb", "search", query] as const,
  genres: (type: string) => ["tmdb", "genres", type] as const,
  topRatedMovies: (page: number) => ["tmdb", "movies", "top-rated", page] as const,
  nowPlaying: (page: number) => ["tmdb", "movies", "now-playing", page] as const,
  upcoming: (page: number) => ["tmdb", "movies", "upcoming", page] as const,
  popularMovies: (page: number) => ["tmdb", "movies", "popular", page] as const,
  topRatedTV: (page: number) => ["tmdb", "tv", "top-rated", page] as const,
  popularTV: (page: number) => ["tmdb", "tv", "popular", page] as const,
  onAirTV: (page: number) => ["tmdb", "tv", "on-air", page] as const,
};

// ─── Trending ─────────────────────────────────────────────────────────────────

export function useTrending(type: "movie" | "tv" | "all" = "all", window: "day" | "week" = "week") {
  return useQuery({
    queryKey: tmdbKeys.trending(type, window),
    queryFn: () => getTrending(type, window),
    staleTime: 1000 * 60 * 30,
  });
}

// ─── Films ────────────────────────────────────────────────────────────────────

export function useMovieDetail(id: number) {
  return useQuery({
    queryKey: tmdbKeys.movie(id),
    queryFn: () => getMovieDetail(id),
    staleTime: 1000 * 60 * 60,
    enabled: id > 0,
  });
}

export function useTopRatedMovies(page = 1) {
  return useQuery({
    queryKey: tmdbKeys.topRatedMovies(page),
    queryFn: () => getTopRatedMovies(page),
    staleTime: 1000 * 60 * 60,
  });
}

export function useNowPlayingMovies(page = 1) {
  return useQuery({
    queryKey: tmdbKeys.nowPlaying(page),
    queryFn: () => getNowPlayingMovies(page),
    staleTime: 1000 * 60 * 30,
  });
}

export function useUpcomingMovies(page = 1) {
  return useQuery({
    queryKey: tmdbKeys.upcoming(page),
    queryFn: () => getUpcomingMovies(page),
    staleTime: 1000 * 60 * 60,
  });
}

export function usePopularMovies(page = 1) {
  return useQuery({
    queryKey: tmdbKeys.popularMovies(page),
    queryFn: () => getPopularMovies(page),
    staleTime: 1000 * 60 * 30,
  });
}

// ─── Séries ───────────────────────────────────────────────────────────────────

export function useTVShowDetail(id: number) {
  return useQuery({
    queryKey: tmdbKeys.tvShow(id),
    queryFn: () => getTVShowDetail(id),
    staleTime: 1000 * 60 * 60,
    enabled: id > 0,
  });
}

export function useTopRatedTV(page = 1) {
  return useQuery({
    queryKey: tmdbKeys.topRatedTV(page),
    queryFn: () => getTopRatedTV(page),
    staleTime: 1000 * 60 * 60,
  });
}

export function usePopularTV(page = 1) {
  return useQuery({
    queryKey: tmdbKeys.popularTV(page),
    queryFn: () => getPopularTV(page),
    staleTime: 1000 * 60 * 30,
  });
}

export function useOnAirTV(page = 1) {
  return useQuery({
    queryKey: tmdbKeys.onAirTV(page),
    queryFn: () => getOnAirTV(page),
    staleTime: 1000 * 60 * 30,
  });
}

export function useTVSeason(showId: number, seasonNumber: number) {
  return useQuery({
    queryKey: tmdbKeys.tvSeason(showId, seasonNumber),
    queryFn: () => getTVSeason(showId, seasonNumber),
    staleTime: 1000 * 60 * 60,
    enabled: showId > 0 && seasonNumber >= 0,
  });
}

// ─── Providers / Hubs ─────────────────────────────────────────────────────────

export function useMoviesByProvider(providerId: number, page = 1) {
  return useQuery({
    queryKey: tmdbKeys.provider("movie", providerId),
    queryFn: () => getMoviesByProvider(providerId, page),
    staleTime: 1000 * 60 * 60,
    enabled: providerId > 0,
  });
}

export function useTVByProvider(providerId: number, page = 1) {
  return useQuery({
    queryKey: tmdbKeys.provider("tv", providerId),
    queryFn: () => getTVByProvider(providerId, page),
    staleTime: 1000 * 60 * 60,
    enabled: providerId > 0,
  });
}

export function useInfiniteMoviesByProvider(providerId: number) {
  return useInfiniteQuery({
    queryKey: ["tmdb", "provider", "movie", "infinite", providerId],
    queryFn: ({ pageParam }) => getMoviesByProvider(providerId, pageParam as number),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.total_pages ? lastPage.page + 1 : undefined,
    enabled: providerId > 0,
    staleTime: 1000 * 60 * 60,
  });
}

// ─── Personnes ────────────────────────────────────────────────────────────────

export function usePersonDetail(id: number) {
  return useQuery({
    queryKey: tmdbKeys.person(id),
    queryFn: () => getPersonDetail(id),
    staleTime: 1000 * 60 * 60 * 24,
    enabled: id > 0,
  });
}

export function usePersonMovieCredits(id: number) {
  return useQuery({
    queryKey: tmdbKeys.personMovieCredits(id),
    queryFn: () => getPersonMovieCredits(id),
    staleTime: 1000 * 60 * 60 * 24,
    enabled: id > 0,
  });
}

export function usePersonTVCredits(id: number) {
  return useQuery({
    queryKey: tmdbKeys.personTVCredits(id),
    queryFn: () => getPersonTVCredits(id),
    staleTime: 1000 * 60 * 60 * 24,
    enabled: id > 0,
  });
}

// ─── Recherche ────────────────────────────────────────────────────────────────

export function useSearchMulti(query: string, page = 1) {
  return useQuery({
    queryKey: tmdbKeys.search(query),
    queryFn: () => searchMulti(query, page),
    staleTime: 1000 * 60 * 5,
    enabled: query.trim().length >= 2,
  });
}

export function useSearchMovies(query: string, page = 1) {
  return useQuery({
    queryKey: ["tmdb", "search", "movie", query, page],
    queryFn: () => searchMovies(query, page),
    staleTime: 1000 * 60 * 5,
    enabled: query.trim().length >= 2,
  });
}

export function useSearchTV(query: string, page = 1) {
  return useQuery({
    queryKey: ["tmdb", "search", "tv", query, page],
    queryFn: () => searchTV(query, page),
    staleTime: 1000 * 60 * 5,
    enabled: query.trim().length >= 2,
  });
}

// ─── Discover ────────────────────────────────────────────────────────────────

export function useDiscoverMovies(params: Record<string, string | number | boolean> = {}, page = 1) {
  return useQuery({
    queryKey: tmdbKeys.discover("movie", { ...params, page }),
    queryFn: () => discoverMovies(params, page),
    staleTime: 1000 * 60 * 60,
  });
}

export function useDiscoverTV(params: Record<string, string | number | boolean> = {}, page = 1) {
  return useQuery({
    queryKey: tmdbKeys.discover("tv", { ...params, page }),
    queryFn: () => discoverTV(params, page),
    staleTime: 1000 * 60 * 60,
  });
}

// ─── Genres ──────────────────────────────────────────────────────────────────

export function useMovieGenres() {
  return useQuery({
    queryKey: tmdbKeys.genres("movie"),
    queryFn: getMovieGenres,
    staleTime: Infinity,
  });
}

export function useTVGenres() {
  return useQuery({
    queryKey: tmdbKeys.genres("tv"),
    queryFn: getTVGenres,
    staleTime: Infinity,
  });
}
