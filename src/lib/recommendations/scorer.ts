/**
 * Scorer — Phase 04 du système de recommandation
 *
 * Score final avec profil (Phase 04) :
 *   score(U, M) =
 *     0.40 × taste_score(U, M)      (genres / réalisateurs / acteurs / keywords)
 *   + 0.20 × similarity_score(M)    (similarité contenu — Phase 03)
 *   + 0.20 × social_score(U, M)     (amis qui ont liké ce titre)
 *   + 0.10 × trending_score(M)      (popularité TMDB normalisée)
 *   + 0.10 × quality_score(M)       (vote_average pondéré par vote_count)
 *   Total = 1.00
 *
 * Fallback sans profil :
 *   0.55 × trending_score
 *   0.25 × quality_score
 *   0.20 × social_score
 *   Total = 1.00
 */

import "server-only";
import { computeTasteScore } from "./taste-profile";
import type { TasteProfile } from "./taste-profile";
import type { ReasonType, ReasonDetail, SimilarityData } from "@/types/recommendations";

// Re-exports pour compatibilité avec les imports existants
export type { ReasonType, ReasonDetail, SimilarityData };

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

export interface ScoredItem {
  tmdb_id: number;
  media_type: "movie" | "tv";
  score: number;
  reason_type: ReasonType;
  /**
   * Contexte enrichi pour l'UI Phase 05 : "Parce que vous avez regardé X",
   * "X amis ont aimé", "Correspond à vos goûts (Genre Y)".
   */
  reason_detail?: ReasonDetail;
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
 * Poids avec profil (Phase 04) :
 *   0.40 × taste_score       (genres / acteurs / réalisateurs / keywords)
 *   0.20 × similarity_score  (similarité contenu — Phase 03)
 *   0.20 × social_score      (amis qui ont liké ce titre)
 *   0.10 × trending_score    (popularité TMDB normalisée)
 *   0.10 × quality_score     (vote_average pondéré par vote_count)
 *   Total = 1.00
 *
 * Fallback sans profil :
 *   0.55 × trending_score
 *   0.25 × quality_score
 *   0.20 × social_score
 *   Total = 1.00
 *
 * @param friendLikes    Map `tmdb_id-media_type` → nombre d'amis ayant liké
 * @param friendCount    Nombre total d'amis (pour normaliser le score social)
 * @param similarityMap  Map `tmdb_id-media_type` → SimilarityData enrichie (optionnel)
 */
export function scoreItem(
  profile: TasteProfile | null,
  item: TMDbCandidateItem,
  features: CandidateFeatures | undefined,
  mediaType: "movie" | "tv",
  friendLikes?: Map<string, number>,
  friendCount?: number,
  similarityMap?: Map<string, SimilarityData>
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

  // Similarité : score de Phase 03, plafonné à [0, 1]
  const simData = similarityMap?.get(`${item.id}-${mediaType}`);
  const simScore = Math.min(Math.max(simData?.score ?? 0, 0), 1.0);

  let reason_type: ReasonType = "trending";
  let reason_detail: ReasonDetail | undefined;

  if (profile && features) {
    const tasteRaw = computeTasteScore(
      profile,
      features.genre_ids,
      features.director_ids,
      features.cast_ids,
      features.keyword_ids
    );
    // computeTasteScore retourne [-1, 1] → normalise en [0, 1]
    const tasteNorm = Math.min(Math.max((tasteRaw + 1) / 2, 0), 1.0);

    const score =
      0.40 * tasteNorm +
      0.20 * simScore +
      0.20 * socialScore +
      0.10 * trendingScore +
      0.10 * qualityScore;

    // Priorité : similarity > taste_match > social > quality > trending
    if (simScore > 0.5 && simData) {
      reason_type = "similarity";
      reason_detail = {
        sourceTitle: simData.sourceTitle,
        sourceTmdbId: simData.sourceTmdbId,
      };
    } else if (tasteNorm > 0.65) {
      reason_type = "taste_match";
      // Genre dominant du profil qui est aussi dans les features
      const topGenreId = Object.entries(profile.genre_scores)
        .filter(([, s]) => s > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([id]) => Number(id))
        .find((id) => features.genre_ids.includes(id));
      if (topGenreId !== undefined) {
        reason_detail = { topGenre: String(topGenreId) };
      }
    } else if (socialScore > 0.4) {
      reason_type = "social";
      reason_detail = { friendCount: likeCount };
    } else if (qualityScore > 0.82) {
      reason_type = "quality";
    }

    return buildItem(item, mediaType, score, reason_type, reason_detail);
  }

  // Pas de profil ou features manquantes → fallback trending + quality + social
  // 0.55 + 0.25 + 0.20 = 1.00
  const score =
    0.55 * trendingScore +
    0.25 * qualityScore +
    0.20 * socialScore;

  if (qualityScore > 0.85) {
    reason_type = "quality";
  } else if (socialScore > 0.4) {
    reason_type = "social";
    reason_detail = { friendCount: likeCount };
  }

  return buildItem(item, mediaType, score, reason_type, reason_detail);
}

function buildItem(
  item: TMDbCandidateItem,
  mediaType: "movie" | "tv",
  score: number,
  reason_type: ReasonType,
  reason_detail?: ReasonDetail
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
