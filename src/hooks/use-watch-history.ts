"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import type { WatchHistory } from "@/types/supabase";

/** Seuil de progression pour considérer un épisode/film comme vu (%). */
const WATCHED_THRESHOLD = 95;

export function useWatchHistory() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["watch-history", user?.id],
    queryFn: async (): Promise<WatchHistory[]> => {
      if (!user) return [];
      const res = await fetch("/api/watch-history");
      if (!res.ok) throw new Error("Erreur chargement historique");
      return res.json();
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });
}

export function useUpdateProgress() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      tmdbId,
      mediaType,
      progress,
      duration,
      seasonNumber,
      episodeNumber,
      lastPositionSeconds,
    }: {
      tmdbId: number;
      mediaType: "movie" | "tv";
      progress: number;
      duration?: number;
      seasonNumber?: number;
      episodeNumber?: number;
      lastPositionSeconds?: number;
    }) => {
      if (!user) throw new Error("Non connecté");
      const res = await fetch("/api/watch-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tmdbId,
          mediaType,
          progress,
          duration,
          seasonNumber,
          episodeNumber,
          lastPositionSeconds,
        }),
      });
      if (!res.ok) throw new Error("Erreur mise à jour");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["watch-history", user?.id] });
    },
  });
}

export function useItemProgress(tmdbId: number, mediaType: "movie" | "tv") {
  const { data: history } = useWatchHistory();
  return history?.find(
    (item) => item.tmdb_id === tmdbId && item.media_type === mediaType
  );
}

/** Indique si un film est considéré comme vu (progress >= seuil). */
export function isMovieWatched(entry: WatchHistory | null | undefined): boolean {
  return (entry?.progress ?? 0) >= WATCHED_THRESHOLD;
}

/**
 * Indique si l’épisode (season, episode) est considéré comme vu
 * selon l’entrée watch_history de la série (une ligne = dernier épisode + progression).
 */
export function isEpisodeWatched(
  entry: WatchHistory | null | undefined,
  season: number,
  episode: number
): boolean {
  if (!entry) return false;
  const s = entry.season_number ?? 0;
  const e = entry.episode_number ?? 0;
  if (s > season) return true;
  if (s === season && e > episode) return true;
  if (s === season && e === episode) return (entry.progress ?? 0) >= WATCHED_THRESHOLD;
  return false;
}

/** Mutation pour marquer un film ou un épisode comme vu (progress 100). */
export function useMarkAsWatched() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { mutateAsync: updateProgress } = useUpdateProgress();

  return useMutation({
    mutationFn: async ({
      tmdbId,
      mediaType,
      seasonNumber,
      episodeNumber,
    }: {
      tmdbId: number;
      mediaType: "movie" | "tv";
      seasonNumber?: number;
      episodeNumber?: number;
    }) => {
      if (!user) throw new Error("Non connecté");
      await updateProgress({
        tmdbId,
        mediaType,
        progress: 100,
        seasonNumber,
        episodeNumber,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["watch-history", user?.id] });
    },
  });
}
