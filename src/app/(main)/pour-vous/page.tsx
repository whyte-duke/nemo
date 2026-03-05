/**
 * /pour-vous — Page de recommandations personnalisées
 *
 * Affiche les recommandations groupées en sections séquentielles :
 *   - "Parce que vous avez regardé X" (similarity) — max 2 par type de média
 *   - "Correspondance avec vos goûts • [Genre]" (taste_match)
 *   - "[N] amis ont aimé" (social)
 *   - "Hautement noté" (quality)
 *   - "Populaire en ce moment" (trending)
 *
 * Films d'abord, puis Séries.
 */

"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, TrendingUp, Star, Users, Link2 } from "lucide-react";
import Link from "next/link";
import { useState, useCallback } from "react";
import { MediaRow } from "@/components/media/MediaRow";
import { DetailModal } from "@/components/media/DetailModal";
import { MovieWatchModal } from "@/components/player/MovieWatchModal";
import { useMovieDetail, useTVShowDetail } from "@/hooks/use-tmdb";
import type { ScoredItem } from "@/lib/recommendations/scorer";
import { buildReasonGroups } from "@/lib/recommendations/pour-vous-helpers";
import type { ReasonGroup } from "@/lib/recommendations/pour-vous-helpers";
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

// ─── Icônes par raison ────────────────────────────────────────────────────────

const REASON_CONFIG = {
  similarity:  { icon: Link2,      color: "text-purple-400"  },
  taste_match: { icon: Sparkles,   color: "text-indigo-400"  },
  social:      { icon: Users,      color: "text-green-400"   },
  trending:    { icon: TrendingUp, color: "text-blue-400"    },
  quality:     { icon: Star,       color: "text-amber-400"   },

} as const;

// ─── Composant principal ──────────────────────────────────────────────────────

export default function PourVousPage() {
  const queryClient = useQueryClient();

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

  const handleNotInterested = useCallback(
    async (item: { id: number }, type: "movie" | "tv") => {
      // Fire-and-forget — l'UI se met à jour via UserInteractionsContext
      void fetch("/api/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tmdbId: item.id,
          mediaType: type,
          type: null,
          notInterested: true,
        }),
      }).then(() => {
        void queryClient.invalidateQueries({ queryKey: ["recommendations", "full"] });
      });
    },
    [queryClient]
  );

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
          data-test="start-discovering-link"
          className="rounded-2xl px-6 py-3 text-sm font-semibold bg-indigo-500 text-white hover:bg-indigo-400 transition-colors"
        >
          Commencer à découvrir
        </Link>
      </div>
    );
  }

  // ── Chargement skeleton ────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="pt-6 pb-12 space-y-10" data-test="pour-vous-page-loading">
        {/* En-tête */}
        <div className="px-4 sm:px-6 flex items-center gap-3">
          <Sparkles className="size-5 text-indigo-400" />
          <h1 className="text-white text-xl font-bold">Pour vous</h1>
        </div>
        {/* 3 rows skeleton */}
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-3" aria-label="chargement">
            <div className="px-4 sm:px-6">
              <div className="h-4 w-48 skeleton rounded-full" />
            </div>
            <MediaRow
              title=""
              items={[]}
              mediaType="movie"
              isLoading={true}
            />
          </div>
        ))}
      </div>
    );
  }

  // ── Données disponibles ───────────────────────────────────────────────────
  const items = data?.items ?? [];

  // Dérivé pendant le render — pas de useEffect
  const movieItems  = items.filter((i) => i.media_type === "movie");
  const tvItems     = items.filter((i) => i.media_type === "tv");
  const movieGroups = buildReasonGroups(movieItems);
  const tvGroups    = buildReasonGroups(tvItems);

  // ── Rendu d'un groupe de section ──────────────────────────────────────────
  function renderGroup(group: ReasonGroup, keyPrefix: string) {
    const config = REASON_CONFIG[group.reason];
    const Icon = config.icon;
    const groupMediaType: "movie" | "tv" = keyPrefix === "movie" ? "movie" : "tv";

    return (
      <div
        key={`${keyPrefix}-${group.reason}-${group.sourceTitle ?? ""}`}
        className="space-y-3"
      >
        <div className="px-4 sm:px-6 flex items-center gap-2">
          <Icon className={`size-4 ${config.color}`} />
          <span className="text-white/60 text-sm font-medium">{group.label}</span>
        </div>
        <MediaRow
          title=""
          items={group.items.map(toMediaItem) as unknown as Parameters<typeof MediaRow>[0]["items"]}
          mediaType={groupMediaType}
          onPlay={(item) => {
            const scored = group.items.find((s) => s.tmdb_id === item.id);
            if (scored) handlePlay({ id: item.id }, scored.media_type);
          }}
          onMoreInfo={(item) => {
            const scored = group.items.find((s) => s.tmdb_id === item.id);
            if (scored) handleMoreInfo({ id: item.id }, scored.media_type);
          }}
          onNotInterested={(item) => {
            const scored = group.items.find((s) => s.tmdb_id === item.id);
            if (scored) void handleNotInterested({ id: item.id }, scored.media_type);
          }}
          hideIfSeen={true}
        />
      </div>
    );
  }


  return (
    <div className="pt-6 pb-12 space-y-10" data-test="pour-vous-page">
      {/* En-tête */}
      <div className="px-4 sm:px-6 flex items-center gap-3">
        <Sparkles className="size-5 text-indigo-400" />
        <h1 className="text-white text-xl font-bold">Pour vous</h1>
        <span className="text-white/30 text-sm">— {items.length} titres</span>
      </div>

      {/* Section Films */}
      {movieGroups.length > 0 && (
        <div className="space-y-8">
          <div className="px-4 sm:px-6">
            <h2 className="text-white/40 text-xs font-semibold uppercase tracking-widest">
              Films
            </h2>
          </div>
          {movieGroups.map((g) => renderGroup(g, "movie"))}
        </div>
      )}

      {/* Section Séries */}
      {tvGroups.length > 0 && (
        <div className="space-y-8">
          <div className="px-4 sm:px-6">
            <h2 className="text-white/40 text-xs font-semibold uppercase tracking-widest">
              Séries
            </h2>
          </div>
          {tvGroups.map((g) => renderGroup(g, "tv"))}
        </div>
      )}

      {/* Lien pour enrichir le profil */}
      <div className="px-4 sm:px-6">
        <Link
          href="/decouvrir"
          data-test="swipe-more-link"
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
