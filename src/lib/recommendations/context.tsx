"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { TMDB_GENRE_NAMES } from "@/lib/tmdb/genres";
import type { ReasonType, ReasonDetail } from "@/types/recommendations";

export interface ScoredItemClient {
  tmdb_id: number;
  media_type: "movie" | "tv";
  score: number;
  reason_type: ReasonType;
  reason_detail?: ReasonDetail;
}

interface RecommendationsState {
  map: Map<string, ScoredItemClient>;
  loaded: boolean;
}

const RecommendationsContext = createContext<RecommendationsState>({
  map: new Map(),
  loaded: false,
});

const STALE_MS = 20 * 60 * 1000; // 20 minutes

export function RecommendationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<RecommendationsState>({ map: new Map(), loaded: false });
  const lastFetchRef = useRef<number>(0);
  const fetchedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;
    // Ne re-fetche pas si déjà chargé pour cet utilisateur et récent
    if (
      fetchedForRef.current === user.id &&
      Date.now() - lastFetchRef.current < STALE_MS
    ) return;

    fetchedForRef.current = user.id;
    lastFetchRef.current = Date.now();

    void fetch("/api/recommendations?limit=50")
      .then((r) => r.ok ? r.json() : null)
      .then((data: { items: ScoredItemClient[] } | null) => {
        if (!data?.items) return;
        const map = new Map<string, ScoredItemClient>();
        for (const item of data.items) {
          map.set(`${item.tmdb_id}-${item.media_type}`, item);
        }
        setState({ map, loaded: true });
      })
      .catch(() => {
        // Silencieux — les stickers sont optionnels
      });
  }, [user]);

  return (
    <RecommendationsContext.Provider value={state}>
      {children}
    </RecommendationsContext.Provider>
  );
}

export function useItemRecommendation(
  tmdbId: number,
  mediaType: string
): ScoredItemClient | null {
  const { map } = useContext(RecommendationsContext);
  return map.get(`${tmdbId}-${mediaType}`) ?? null;
}

/**
 * Retourne un label enrichi Spotify-style pour une recommandation.
 * Ex: "Parce que vous aimez l'Action", "3 de vos amis ont aimé", "Film très bien noté"
 *
 * Phase 04 : reason_detail est maintenant un objet typé (ReasonDetail),
 * plus une chaîne freeform comme en Phase 03.
 */
export function useRecommendationLabel(
  tmdbId: number,
  mediaType: string
): string | null {
  const item = useItemRecommendation(tmdbId, mediaType);
  if (!item) return null;

  const { reason_type, reason_detail, score } = item;

  if (reason_type === "similarity") {
    if (reason_detail?.sourceTitle) {
      return `Parce que vous avez regardé ${reason_detail.sourceTitle}`;
    }
    return "Similaire à vos films regardés";
  }

  if (reason_type === "taste_match") {
    if (reason_detail?.topGenre) {
      const genreId = Number(reason_detail.topGenre);
      const genreName = TMDB_GENRE_NAMES[genreId];
      if (genreName) return `Parce que vous aimez ${genreName}`;
    }
    return score > 0.80 ? "Vous allez adorer" : "Pour vous";
  }

  if (reason_type === "social") {
    const count = reason_detail?.friendCount ?? 0;
    if (count === 1) return "1 de vos amis a aimé";
    if (count > 1) return `${count} de vos amis ont aimé`;
    return "Vos amis ont aimé";
  }

  if (reason_type === "quality") return "Film très bien noté";
  if (reason_type === "trending") return "Populaire en ce moment";

  return null;
}
