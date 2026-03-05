/**
 * Taste Profile — Phase 3 + Phase 1 Upgrade du système de recommandation
 *
 * Calcule le profil de goût agrégé d'un utilisateur à partir de :
 *   1. Interactions explicites (like/dislike/not_interested)
 *   2. Historique de visionnage natif Nemo (watch_history) — signal implicite
 *
 * Poids des signaux :
 *   like              → +1.0
 *   dislike           → −1.0
 *   not_interested    → −2.0  (signal fort, contenu activement rejeté)
 *   list              → non pris en compte (signal faible, ambigu)
 *   watch ≥ 80%       → +0.8  (WATCH_COMPLETED_WEIGHT : like implicite fort)
 *   watch 20–79%      → +0.3  (WATCH_PARTIAL_WEIGHT : signal doux)
 *   watch < 20%       → ignoré (probablement abandonné dès le début)
 *
 * Décroissance temporelle (appliquée à tous les signaux) :
 *   ≤30 jours  → ×1.0 (signal récent, plein poids)
 *   31–90 jours → ×0.7 (signal récent-modéré)
 *   >90 jours  → ×0.4 (signal ancien, impact atténué)
 *
 * Déduplication : si un tmdb_id figure dans interactions ET dans watch_history,
 * l'explicite prime — watch_history est ignoré pour cet item.
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

/** Interaction explicite de l'utilisateur (like/dislike/not_interested) */
interface InteractionRow {
  tmdb_id: number;
  media_type: string;
  type: string | null;
  not_interested: boolean;
  /** Date de création — utilisée pour le calcul du temporal decay */
  created_at: string;
}

/** Entrée d'historique de visionnage natif Nemo */
interface WatchHistoryRow {
  tmdb_id: number;
  media_type: string;
  /** Progression en pourcentage (0–100) */
  progress: number;
  /** Date du dernier visionnage — utilisée pour le calcul du temporal decay */
  last_watched_at: string;
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

/** Poids d'un visionnage complet (progress ≥ 80%) — like implicite fort */
const WATCH_COMPLETED_WEIGHT = 0.8;
/** Poids d'un visionnage partiel (progress 20–79%) — signal doux */
const WATCH_PARTIAL_WEIGHT = 0.3;
/** Seuil minimal de progress pour considérer le visionnage comme signal */
const WATCH_MIN_PROGRESS = 20;
/** Seuil de progress pour considérer le visionnage comme "complet" */
const WATCH_COMPLETED_THRESHOLD = 80;

// ─── Fonctions pures exportées ────────────────────────────────────────────────

/**
 * Calcule le coefficient de décroissance temporelle selon l'âge d'un signal.
 *
 * Paliers discrets (lisibles et testables unitairement) :
 *   - ≤30 jours  → 1.0 (signal récent, plein poids)
 *   - ≤90 jours  → 0.7 (signal récent-modéré)
 *   - >90 jours  → 0.4 (signal ancien, goûts potentiellement évolués)
 *
 * Retourne 1.0 pour une date nulle (pas de pénalisation sans information temporelle).
 *
 * @param date - Date du signal (Date, string ISO, ou null)
 * @returns Coefficient multiplicateur entre 0.4 et 1.0
 */
export function computeTemporalDecay(date: Date | string | null): number {
  if (!date) return 1.0;

  const d = typeof date === 'string' ? new Date(date) : date;
  const daysSince = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSince <= 30) return 1.0;
  if (daysSince <= 90) return 0.7;
  return 0.4;
}

// ─── Calcul et sauvegarde ─────────────────────────────────────────────────────

/**
 * Calcule et persiste le profil de goût d'un utilisateur dans `user_taste_profiles`.
 *
 * Intègre deux sources de signal :
 *   1. `interactions` — signaux explicites (like/dislike/not_interested) avec created_at
 *   2. `watch_history` — signaux implicites basés sur la progression de visionnage
 *
 * La déduplication garantit que l'explicite prime : tout item présent dans
 * `interactions` est exclu de `watch_history` pour éviter le double-comptage.
 *
 * Chaque signal est pondéré par son type × le coefficient de décroissance temporelle.
 *
 * @param userId - UUID de l'utilisateur Supabase
 * @returns Le profil de goût calculé (brut, non normalisé)
 */
export async function computeAndSaveTasteProfile(userId: string): Promise<TasteProfile> {
  // createAdminClient() : contourne RLS — nécessaire pour lire les tables
  // admin-only (user_taste_profiles, media_features) et watch_history d'un autre user.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  // 1 + 2. Interactions et historique de visionnage — requêtes indépendantes en parallèle
  // createAdminClient() : watch_history a RLS auth.uid() — le service_role contourne
  const [{ data: interactions }, { data: watchHistory }] = await Promise.all([
    supabase
      .from("interactions")
      .select("tmdb_id, media_type, type, not_interested, created_at")
      .eq("user_id", userId) as Promise<{ data: InteractionRow[] | null }>,
    supabase
      .from("watch_history")
      .select("tmdb_id, media_type, progress, last_watched_at")
      .eq("user_id", userId)
      .gte("progress", WATCH_MIN_PROGRESS) as Promise<{ data: WatchHistoryRow[] | null }>,
  ]);

  // Si aucune donnée exploitable, retourner un profil vide
  const hasInteractions = interactions && interactions.length > 0;
  const hasWatchHistory = watchHistory && watchHistory.length > 0;

  if (!hasInteractions && !hasWatchHistory) {
    return emptyProfile();
  }

  // 3. Construire le Set de déduplication : items déjà dans interactions
  // L'explicite prime — ces items seront ignorés dans watch_history
  const interactedKeys = new Set<string>(
    (interactions ?? []).map((i) => `${i.tmdb_id}-${i.media_type}`)
  );

  // 4. Collecter tous les tmdb_ids à charger depuis media_features
  const interactionIds = new Set<number>((interactions ?? []).map((i) => i.tmdb_id));
  const watchIds = (watchHistory ?? [])
    .filter((w) => !interactedKeys.has(`${w.tmdb_id}-${w.media_type}`))
    .map((w) => w.tmdb_id);

  const uniqueIds = [...new Set([...interactionIds, ...watchIds])];

  if (uniqueIds.length === 0) {
    return emptyProfile();
  }

  // 5. Features TMDB pour tous les items (ceux qui ont déjà été fetchés en Phase 2)
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

  // 6. Accumulation des scores
  const genre_scores: Record<string, number> = {};
  const director_scores: Record<string, number> = {};
  const actor_scores: Record<string, number> = {};
  const keyword_scores: Record<string, number> = {};

  /** Accumule les scores d'un signal dans les dictionnaires */
  function accumulateSignal(feature: FeatureRow, weight: number): void {
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

  // 6a. Signaux explicites (interactions) avec temporal decay sur created_at
  for (const interaction of interactions ?? []) {
    const feature = featureMap.get(`${interaction.tmdb_id}-${interaction.media_type}`);
    if (!feature) continue; // Pas encore de features cachées → ignoré

    const baseWeight = interaction.not_interested
      ? NOT_INTERESTED_WEIGHT
      : (SIGNAL_WEIGHT[interaction.type ?? ""] ?? 0);

    if (baseWeight === 0) continue;

    const decay = computeTemporalDecay(interaction.created_at);
    accumulateSignal(feature, baseWeight * decay);
  }

  // 6b. Signaux implicites (watch_history) avec temporal decay sur last_watched_at
  // Les items déjà dans interactions sont exclus (l'explicite prime)
  for (const watch of watchHistory ?? []) {
    // Vérifier que ce n'est pas un item déjà traité via interactions
    if (interactedKeys.has(`${watch.tmdb_id}-${watch.media_type}`)) continue;

    const feature = featureMap.get(`${watch.tmdb_id}-${watch.media_type}`);
    if (!feature) continue; // Pas de features pour cet item → ignoré

    // Poids selon la progression du visionnage
    const baseWeight = watch.progress >= WATCH_COMPLETED_THRESHOLD
      ? WATCH_COMPLETED_WEIGHT   // ≥80% : like implicite fort
      : WATCH_PARTIAL_WEIGHT;    // 20–79% : signal doux

    const decay = computeTemporalDecay(watch.last_watched_at);
    accumulateSignal(feature, baseWeight * decay);
  }

  const profile: TasteProfile = { genre_scores, director_scores, actor_scores, keyword_scores };

  // 7. Upsert dans user_taste_profiles (service_role = contourne RLS)
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

/**
 * Récupère le profil de goût pré-calculé d'un utilisateur.
 *
 * Retourne null si le profil n'existe pas encore (ex: nouvel utilisateur).
 * Appeler `computeAndSaveTasteProfile()` pour le créer/mettre à jour.
 *
 * @param userId - UUID de l'utilisateur Supabase
 */
export async function getTasteProfile(userId: string): Promise<TasteProfile | null> {
  // createAdminClient() : user_taste_profiles est admin-only (pas de policy utilisateur)
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
 *
 * @param profile - Profil de goût de l'utilisateur
 * @param genreIds - IDs des genres du candidat
 * @param directorIds - IDs des réalisateurs du candidat
 * @param castIds - IDs des acteurs principaux du candidat
 * @param keywordIds - IDs des keywords du candidat
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
