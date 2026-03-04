/**
 * Scorer — Phase 4 du système de recommandation
 *
 * Score final pour un candidat M et un utilisateur U :
 *   score(U, M) =
 *     0.60 × taste_score(U, M)   (genres / réalisateurs / acteurs / keywords)
 *   + 0.10 × trending_score(M)   (popularité TMDB normalisée)
 *   + 0.05 × quality_score(M)    (vote_average / 10)
 *
 * Note : social_score (Phase 5) et similarity_score (coûteux) sont réservés.
 * Les poids taste et trending absorberont 0.25 supplémentaires lors de la Phase 5.
 */

import "server-only";
import { computeTasteScore } from "./taste-profile";
import type { TasteProfile } from "./taste-profile";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TMDbCandidateItem {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids?: number[];
  overview?: string;
  release_date?: string;
  first_air_date?: string;
}

export interface CandidateFeatures {
  tmdb_id: number;
  media_type: string;
  genre_ids: number[];
  keyword_ids: number[];
  cast_ids: number[];
  director_ids: number[];
}

export type ReasonType = "taste_match" | "social" | "trending" | "quality";

export interface ScoredItem {
  tmdb_id: number;
  media_type: "movie" | "tv";
  score: number;
  reason_type: ReasonType;
  /** Contexte enrichi Spotify-style : "genre:28", "social:3" */
  reason_detail?: string;
  // ── Champs d'affichage ──
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  popularity: number;
  genre_ids: number[];
  overview: string;
  release_date?: string;
  first_air_date?: string;
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

/**
 * Score un candidat TMDB contre le profil de goût de l'utilisateur.
 *
 * Poids (Phase 4 + 5) :
 *   0.45 × taste_score       (genres / acteurs / réalisateurs / keywords)
 *   0.20 × social_score      (amis qui ont liké ce titre)
 *   0.10 × trending_score    (popularité TMDB normalisée)
 *   0.05 × quality_score     (vote_average pondéré par vote_count)
 *   (+ 0.20 similarity_score réservé Phase 6)
 *
 * @param friendLikes  Map `tmdb_id-media_type` → nombre d'amis ayant liké
 * @param friendCount  Nombre total d'amis (pour normaliser le score social)
 */
export function scoreItem(
  profile: TasteProfile | null,
  item: TMDbCandidateItem,
  features: CandidateFeatures | undefined,
  mediaType: "movie" | "tv",
  friendLikes?: Map<string, number>,
  friendCount?: number
): ScoredItem {
  // Trending : popularité TMDB (max ~1000 pour les blockbusters)
  const trendingScore = Math.min(item.popularity / 500, 1.0);

  // Qualité : vote_average / 10 avec pénalité si vote_count faible
  const qualityRaw = item.vote_average / 10;
  const votePenalty =
    item.vote_count < 100 ? 0.5 : item.vote_count < 500 ? 0.8 : 1.0;
  const qualityScore = qualityRaw * votePenalty;

  // Social : fraction d'amis ayant liké (plafonné à 1.0)
  const likeCount = friendLikes?.get(`${item.id}-${mediaType}`) ?? 0;
  const socialScore =
    friendCount && friendCount > 0
      ? Math.min(likeCount / Math.max(friendCount, 3), 1.0)
      : 0;

  let reason_type: ReasonType = "trending";
  let reason_detail: string | undefined;

  if (profile && features) {
    const tasteRaw = computeTasteScore(
      profile,
      features.genre_ids,
      features.director_ids,
      features.cast_ids,
      features.keyword_ids
    );
    // computeTasteScore retourne [-1, 1] → normalise en [0, 1]
    const tasteNorm = (tasteRaw + 1) / 2;

    const score =
      0.45 * tasteNorm +
      0.20 * socialScore +
      0.10 * trendingScore +
      0.05 * qualityScore;

    if (tasteNorm > 0.65) {
      reason_type = "taste_match";
      // Genre dominant du profil qui est aussi dans les features
      const topGenreId = Object.entries(profile.genre_scores)
        .filter(([, s]) => s > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => Number(id))
        .find((id) => features.genre_ids.includes(id));
      if (topGenreId !== undefined) reason_detail = `genre:${topGenreId}`;
    } else if (socialScore > 0.4) {
      reason_type = "social";
      const likeCount = friendLikes?.get(`${item.id}-${mediaType}`) ?? 0;
      reason_detail = `social:${likeCount}`;
    } else if (qualityScore > 0.82) {
      reason_type = "quality";
    }

    return buildItem(item, mediaType, score, reason_type, reason_detail);
  }

  // Pas de profil ou features manquantes → fallback trending + quality + social
  const score =
    0.55 * trendingScore +
    0.25 * qualityScore +
    0.20 * socialScore;

  if (qualityScore > 0.85) reason_type = "quality";
  else if (socialScore > 0.4) {
    reason_type = "social";
    const likeCount = friendLikes?.get(`${item.id}-${mediaType}`) ?? 0;
    reason_detail = `social:${likeCount}`;
  }

  return buildItem(item, mediaType, score, reason_type, reason_detail);
}

function buildItem(
  item: TMDbCandidateItem,
  mediaType: "movie" | "tv",
  score: number,
  reason_type: ReasonType,
  reason_detail?: string
): ScoredItem {
  return {
    tmdb_id: item.id,
    media_type: mediaType,
    score,
    reason_type,
    reason_detail,
    title: item.title,
    name: item.name,
    poster_path: item.poster_path,
    backdrop_path: item.backdrop_path,
    vote_average: item.vote_average,
    popularity: item.popularity,
    genre_ids: item.genre_ids ?? [],
    overview: item.overview ?? "",
    release_date: item.release_date,
    first_air_date: item.first_air_date,
  };
}
