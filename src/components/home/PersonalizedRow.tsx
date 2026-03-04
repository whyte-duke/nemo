"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import { useCallback } from "react";
import { MediaRow } from "@/components/media/MediaRow";
import type { ScoredItem } from "@/lib/recommendations/scorer";
import type { TMDbMovie } from "@/types/tmdb";

interface RecommendationsResponse {
  items: ScoredItem[];
  hasProfile: boolean;
}

interface PersonalizedRowProps {
  onPlay: (item: ScoredItem, type: "movie" | "tv") => void;
  onMoreInfo: (item: ScoredItem, type: "movie" | "tv") => void;
}

export function PersonalizedRow({ onPlay, onMoreInfo }: PersonalizedRowProps) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<RecommendationsResponse>({
    queryKey: ["recommendations"],
    queryFn: async () => {
      const res = await fetch("/api/recommendations?limit=20");
      if (!res.ok) throw new Error("Erreur chargement recommandations");
      return res.json() as Promise<RecommendationsResponse>;
    },
    staleTime: 15 * 60 * 1000,
    retry: 1,
  });

  // "Pas intéressé" — marque en DB et invalide le cache de recommandations
  const handleNotInterested = useCallback(
    async (item: { id: number }) => {
      const scored = data?.items.find((s) => s.tmdb_id === item.id);
      if (!scored) return;
      try {
        await fetch("/api/interactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tmdbId: scored.tmdb_id,
            mediaType: scored.media_type,
            type: "dislike",
            notInterested: true,
          }),
        });
        // Recharger les recommandations après exclusion
        void queryClient.invalidateQueries({ queryKey: ["recommendations"] });
      } catch {
        // ignore
      }
    },
    [data, queryClient]
  );

  // Aucun swipe effectué → invitation à découvrir
  if (!isLoading && data && !data.hasProfile) {
    return (
      <div className="px-4 sm:px-6">
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/4 border border-white/8">
          <Sparkles className="size-5 shrink-0 text-indigo-400" />
          <div className="flex-1 min-w-0">
            <p className="text-white text-sm font-medium">Personnalisez votre feed</p>
            <p className="text-white/50 text-xs mt-0.5">
              Swipez quelques films pour que Nemo apprenne vos goûts.
            </p>
          </div>
          <Link
            href="/decouvrir"
            className="shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold bg-indigo-500 text-white hover:bg-indigo-400 transition-colors"
          >
            Découvrir
          </Link>
        </div>
      </div>
    );
  }

  const items = (data?.items ?? []).map((item) => ({
    id: item.tmdb_id,
    title: item.title,
    name: item.name,
    poster_path: item.poster_path,
    backdrop_path: item.backdrop_path,
    vote_average: item.vote_average,
    popularity: item.popularity,
    genre_ids: item.genre_ids,
    overview: item.overview,
    release_date: item.release_date,
    first_air_date: item.first_air_date,
  }));

  return (
    <MediaRow
      title="Pour vous"
      badge="✦"
      viewAllHref="/pour-vous"
      items={items as unknown as TMDbMovie[]}
      mediaType="movie"
      isLoading={isLoading}
      onPlay={(item) => {
        const scored = data?.items.find((s) => s.tmdb_id === item.id);
        if (scored) onPlay(scored, scored.media_type);
      }}
      onMoreInfo={(item) => {
        const scored = data?.items.find((s) => s.tmdb_id === item.id);
        if (scored) onMoreInfo(scored, scored.media_type);
      }}
      onNotInterested={(item) => void handleNotInterested(item)}
    />
  );
}
