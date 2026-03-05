/**
 * /pour-vous — Page de recommandations personnalisées
 *
 * Affiche la liste complète des recommandations groupées par raison :
 *   - "Correspondant à vos goûts" (taste_match)
 *   - "Tendances" (trending)
 *   - "Très bien notés" (quality)
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import { Sparkles, TrendingUp, Star, Users, Loader2, Film } from "lucide-react";
import Link from "next/link";
import { useState, useCallback } from "react";
import { MediaRow } from "@/components/media/MediaRow";
import { DetailModal } from "@/components/media/DetailModal";
import { MovieWatchModal } from "@/components/player/MovieWatchModal";
import { useMovieDetail, useTVShowDetail } from "@/hooks/use-tmdb";
import type { ScoredItem } from "@/lib/recommendations/scorer";
import type { TMDbMovieDetail, TMDbTVShowDetail } from "@/types/tmdb";

interface RecommendationsResponse {
  items: ScoredItem[];
  hasProfile: boolean;
}

// ─── Conversion ScoredItem → objet compatible MediaRow ───────────────────────

function toMediaItem(item: ScoredItem) {
  return {
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
  };
}

// ─── Icônes et labels par raison ─────────────────────────────────────────────

const REASON_CONFIG = {
  similarity:  { icon: Film,       label: "Similaire à vos films regardés", color: "text-purple-400" },
  taste_match: { icon: Sparkles,   label: "Correspondant à vos goûts",      color: "text-indigo-400" },
  social:      { icon: Users,      label: "Aimé par vos amis",              color: "text-green-400"  },
  trending:    { icon: TrendingUp, label: "Tendances",                       color: "text-blue-400"   },
  quality:     { icon: Star,       label: "Très bien notés",                 color: "text-amber-400"  },
} as const;

// ─── Composant principal ──────────────────────────────────────────────────────

export default function PourVousPage() {
  const { data, isLoading } = useQuery<RecommendationsResponse>({
    queryKey: ["recommendations", "full"],
    queryFn: async () => {
      const res = await fetch("/api/recommendations?limit=50");
      if (!res.ok) throw new Error("Erreur");
      return res.json() as Promise<RecommendationsResponse>;
    },
    staleTime: 15 * 60 * 1000,
  });

  const [detailId, setDetailId] = useState<{ id: number; type: "movie" | "tv" } | null>(null);
  const [watchMovieId, setWatchMovieId] = useState<number | null>(null);

  const movieDetail = useMovieDetail(detailId?.type === "movie" ? (detailId?.id ?? 0) : 0);
  const tvDetail    = useTVShowDetail(detailId?.type === "tv"    ? (detailId?.id ?? 0) : 0);
  const activeDetail = detailId?.type === "movie" ? movieDetail.data : tvDetail.data;

  const handleMoreInfo = useCallback((item: { id: number }, type: "movie" | "tv") => {
    setDetailId({ id: item.id, type });
  }, []);

  const handlePlay = useCallback((item: { id: number }, type: "movie" | "tv") => {
    if (type === "movie") setWatchMovieId(item.id);
  }, []);

  // ── Pas de profil ─────────────────────────────────────────────────────────
  if (!isLoading && data && !data.hasProfile) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6 px-6 text-center">
        <Sparkles className="size-12 text-indigo-400 opacity-60" />
        <div className="space-y-2">
          <h1 className="text-white text-xl font-bold">Aucune recommandation encore</h1>
          <p className="text-white/50 text-sm max-w-xs">
            Swipez quelques films pour que Nemo apprenne vos goûts et génère un feed personnalisé.
          </p>
        </div>
        <Link
          href="/decouvrir"
          className="rounded-2xl px-6 py-3 text-sm font-semibold bg-indigo-500 text-white hover:bg-indigo-400 transition-colors"
        >
          Commencer à découvrir
        </Link>
      </div>
    );
  }

  // ── Chargement ─────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="size-8 text-white/40 animate-spin" />
      </div>
    );
  }

  const items = data?.items ?? [];

  // Grouper par reason_type (Phase 04 : ajout de "similarity")
  const groups = (["similarity", "taste_match", "social", "trending", "quality"] as const).map((reason) => ({
    reason,
    items: items.filter((i) => i.reason_type === reason),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="pt-6 pb-12 space-y-10">
      {/* En-tête */}
      <div className="px-4 sm:px-6 flex items-center gap-3">
        <Sparkles className="size-5 text-indigo-400" />
        <h1 className="text-white text-xl font-bold">Pour vous</h1>
        <span className="text-white/30 text-sm">— {items.length} titres</span>
      </div>

      {/* Groupes */}
      {groups.map(({ reason, items: groupItems }) => {
        const config = REASON_CONFIG[reason];
        const Icon = config.icon;

        return (
          <div key={reason} className="space-y-3">
            {/* Sous-titre du groupe */}
            <div className="px-4 sm:px-6 flex items-center gap-2">
              <Icon className={`size-4 ${config.color}`} />
              <span className="text-white/60 text-sm font-medium">{config.label}</span>
            </div>

            <MediaRow
              title=""
              items={groupItems.map(toMediaItem) as unknown as Parameters<typeof MediaRow>[0]["items"]}
              mediaType="movie"
              onPlay={(item) => {
                const scored = groupItems.find((s) => s.tmdb_id === item.id);
                if (scored) handlePlay({ id: item.id }, scored.media_type);
              }}
              onMoreInfo={(item) => {
                const scored = groupItems.find((s) => s.tmdb_id === item.id);
                if (scored) handleMoreInfo({ id: item.id }, scored.media_type);
              }}
            />
          </div>
        );
      })}

      {/* Bouton pour enrichir le profil */}
      <div className="px-4 sm:px-6">
        <Link
          href="/decouvrir"
          className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm transition-colors"
        >
          <Sparkles className="size-4" />
          Swiper plus de films pour améliorer vos recommandations
        </Link>
      </div>

      {detailId && (
        <DetailModal
          media={(activeDetail as TMDbMovieDetail | TMDbTVShowDetail) ?? null}
          open={!!detailId}
          onClose={() => setDetailId(null)}
          mediaType={detailId.type}
          onPlay={(media) => {
            setDetailId(null);
            handlePlay(media as { id: number }, detailId.type);
          }}
        />
      )}

      <MovieWatchModal
        open={watchMovieId !== null}
        onClose={() => setWatchMovieId(null)}
        movieId={watchMovieId ?? 0}
      />
    </div>
  );
}
