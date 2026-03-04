/**
 * Taste Profile — Phase 3 du système de recommandation
 *
 * Calcule le profil de goût agrégé d'un utilisateur à partir de ses interactions
 * (like/dislike) croisées avec les features TMDB (media_features).
 *
 * Poids des signaux :
 *   like          → +1.0
 *   dislike        → −1.0
 *   not_interested → −2.0  (signal fort, film activement rejeté)
 *   list           → non pris en compte ici (signal faible, ambigu)
 *
 * Keywords : pondérés à ×0.5 (plus bruités, moins discriminants que genres/cast)
 *
 * Les scores accumulés sont bruts (non normalisés) — la normalisation est
 * faite dans le scorer de la Phase 4 au moment du calcul de taste_score(U,M).
 */

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TasteProfile {
  genre_scores: Record<string, number>;     // { "28": 4.5, "18": 2.0, "27": -3.0 }
  director_scores: Record<string, number>;  // { "525": 2.0 } (Nolan)
  actor_scores: Record<string, number>;     // { "6193": 1.5 } (DiCaprio)
  keyword_scores: Record<string, number>;   // { "4344": 2.0 } (mind-bending)
}

interface InteractionRow {
  tmdb_id: number;
  media_type: string;
  type: string | null;
  not_interested: boolean;
}

interface FeatureRow {
  tmdb_id: number;
  media_type: string;
  genre_ids: number[];
  keyword_ids: number[];
  cast_ids: number[];
  director_ids: number[];
}

// ─── Poids ────────────────────────────────────────────────────────────────────

const SIGNAL_WEIGHT: Record<string, number> = {
  like:    1.0,
  dislike: -1.0,
};
const NOT_INTERESTED_WEIGHT = -2.0;
const KEYWORD_DAMPING = 0.5; // Keywords = signal plus bruité

// ─── Calcul et sauvegarde ─────────────────────────────────────────────────────

export async function computeAndSaveTasteProfile(userId: string): Promise<TasteProfile> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  // 1. Toutes les interactions de l'utilisateur
  const { data: interactions } = await supabase
    .from("interactions")
    .select("tmdb_id, media_type, type, not_interested")
    .eq("user_id", userId) as { data: InteractionRow[] | null };

  if (!interactions || interactions.length === 0) {
    return emptyProfile();
  }

  // 2. Features TMDB pour ces films (ceux qui ont déjà été fetchés en Phase 2)
  const uniqueIds = [...new Set(interactions.map((i) => i.tmdb_id))];
  const { data: features } = await supabase
    .from("media_features")
    .select("tmdb_id, media_type, genre_ids, keyword_ids, cast_ids, director_ids")
    .in("tmdb_id", uniqueIds) as { data: FeatureRow[] | null };

  if (!features || features.length === 0) {
    return emptyProfile();
  }

  // Index features par "tmdbId-mediaType"
  const featureMap = new Map<string, FeatureRow>();
  for (const f of features) {
    featureMap.set(`${f.tmdb_id}-${f.media_type}`, f);
  }

  // 3. Accumulation des scores
  const genre_scores: Record<string, number> = {};
  const director_scores: Record<string, number> = {};
  const actor_scores: Record<string, number> = {};
  const keyword_scores: Record<string, number> = {};

  for (const interaction of interactions) {
    const feature = featureMap.get(`${interaction.tmdb_id}-${interaction.media_type}`);
    if (!feature) continue; // Pas encore de features cachées → sera ignoré

    const weight = interaction.not_interested
      ? NOT_INTERESTED_WEIGHT
      : (SIGNAL_WEIGHT[interaction.type ?? ""] ?? 0);

    if (weight === 0) continue;

    for (const id of feature.genre_ids ?? []) {
      genre_scores[id] = (genre_scores[id] ?? 0) + weight;
    }
    for (const id of feature.director_ids ?? []) {
      director_scores[id] = (director_scores[id] ?? 0) + weight;
    }
    for (const id of feature.cast_ids ?? []) {
      actor_scores[id] = (actor_scores[id] ?? 0) + weight;
    }
    for (const id of feature.keyword_ids ?? []) {
      keyword_scores[id] = (keyword_scores[id] ?? 0) + weight * KEYWORD_DAMPING;
    }
  }

  const profile: TasteProfile = { genre_scores, director_scores, actor_scores, keyword_scores };

  // 4. Upsert dans user_taste_profiles (service_role = contourne RLS)
  await supabase.from("user_taste_profiles").upsert(
    {
      user_id: userId,
      genre_scores,
      director_scores,
      actor_scores,
      keyword_scores,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  return profile;
}

// ─── Lecture ──────────────────────────────────────────────────────────────────

export async function getTasteProfile(userId: string): Promise<TasteProfile | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  const { data } = await supabase
    .from("user_taste_profiles")
    .select("genre_scores, director_scores, actor_scores, keyword_scores")
    .eq("user_id", userId)
    .single() as { data: TasteProfile | null };

  return data ?? null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyProfile(): TasteProfile {
  return { genre_scores: {}, director_scores: {}, actor_scores: {}, keyword_scores: {} };
}

/**
 * Calcule le taste_score d'un film candidat pour un utilisateur.
 * Utilisé par le scorer de Phase 4.
 *
 * Retourne un score entre -1 et 1 (normalisé par le nombre de features matchantes).
 * Les films sans features connues obtiennent 0.
 */
export function computeTasteScore(
  profile: TasteProfile,
  genreIds: number[],
  directorIds: number[],
  castIds: number[],
  keywordIds: number[]
): number {
  let total = 0;
  let count = 0;

  for (const id of genreIds) {
    const score = profile.genre_scores[id];
    if (score !== undefined) { total += score; count++; }
  }
  for (const id of directorIds) {
    const score = profile.director_scores[id];
    if (score !== undefined) { total += score * 1.5; count++; } // Réalisateur = signal fort
  }
  for (const id of castIds) {
    const score = profile.actor_scores[id];
    if (score !== undefined) { total += score * 0.8; count++; }
  }
  for (const id of keywordIds) {
    const score = profile.keyword_scores[id];
    if (score !== undefined) { total += score * 0.5; count++; }
  }

  if (count === 0) return 0;

  // Normalisation softmax simple : clamp entre -1 et 1
  const raw = total / count;
  return Math.max(-1, Math.min(1, raw));
}
