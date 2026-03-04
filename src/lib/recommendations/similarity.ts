/**
 * Similarity — Module de similarité contenu pour le moteur de recommandation
 *
 * Deux sources de similarité :
 *   1. TMDB /similar : données de co-occurrence TMDB (source primaire)
 *   2. Jaccard sur features : similarité calculée sur genre_ids + keyword_ids + cast_ids
 *
 * Score final = Math.max(tmdbLookupScore, jaccardScore)
 *
 * Cache : table similar_items avec TTL 30 jours. Les refreshes sont fire-and-forget
 * — un cache périmé n'empêche pas la réponse (Jaccard fallback actif).
 */

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CandidateFeatures } from "./scorer";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LikedItemRef {
  tmdb_id: number;
  media_type: "movie" | "tv";
}

/** Clé de lookup : "{tmdb_id}-{media_type}" → similarityScore [0,1] */
export type SimilarityMap = Map<string, number>;

// ─── Constantes ───────────────────────────────────────────────────────────────

const TMDB_BASE = process.env.NEXT_PUBLIC_TMDB_BASE_URL ?? "https://api.themoviedb.org/3";
const TMDB_KEY  = process.env.NEXT_PUBLIC_TMDB_API_KEY ?? "";

/** TTL du cache similar_items : 30 jours en millisecondes */
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Nombre max de similar items à stocker par source (top N de TMDB /similar) */
const MAX_SIMILAR_ITEMS = 20;

// ─── Jaccard ──────────────────────────────────────────────────────────────────

/**
 * Calcule le coefficient de Jaccard entre deux listes d'entiers.
 * Jaccard = |A ∩ B| / |A ∪ B|
 * Retourne 0 si l'union est vide (évite la division par zéro).
 */
export function computeJaccard(a: number[], b: number[]): number {
  if (a.length === 0 && b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const id of setB) {
    if (setA.has(id)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Calcule un score Jaccard pondéré entre deux jeux de features.
 * Pondération : 0.40×genres + 0.35×keywords + 0.25×cast
 * (les directors sont ignorés — peu de réalisateurs en commun entre films différents)
 */
function jaccardFeatures(a: CandidateFeatures, b: CandidateFeatures): number {
  const genreScore   = computeJaccard(a.genre_ids, b.genre_ids);
  const keywordScore = computeJaccard(a.keyword_ids, b.keyword_ids);
  const castScore    = computeJaccard(a.cast_ids, b.cast_ids);
  return 0.40 * genreScore + 0.35 * keywordScore + 0.25 * castScore;
}

// ─── Score de similarité ──────────────────────────────────────────────────────

/**
 * Calcule le similarity_score d'un candidat par rapport aux liked items.
 *
 * Logique :
 *   1. Lookup dans similarityMap (données TMDB /similar pré-chargées)
 *   2. Fallback Jaccard sur les features disponibles
 *   3. Retourne Math.max(tmdbScore, jaccardScore)
 *
 * @param candidateTmdbId   ID TMDB du candidat à scorer
 * @param candidateMediaType Type du candidat ('movie' | 'tv')
 * @param likedItems        Liste des liked items de l'utilisateur (top 10)
 * @param featuresMap       Map "{tmdb_id}-{media_type}" → CandidateFeatures
 * @param similarityMap     Map "{similar_tmdb_id}-{media_type}" → score TMDB
 */
export function getSimilarityScore(
  candidateTmdbId: number,
  candidateMediaType: "movie" | "tv",
  likedItems: LikedItemRef[],
  featuresMap: Map<string, CandidateFeatures>,
  similarityMap: SimilarityMap
): number {
  const candidateKey = `${candidateTmdbId}-${candidateMediaType}`;

  // 1. Lookup TMDB /similar (le score est déjà agrégé dans la map par route.ts)
  const tmdbScore = similarityMap.get(candidateKey) ?? 0;

  // 2. Jaccard fallback sur features
  const candidateFeatures = featuresMap.get(candidateKey);
  let jaccardScore = 0;

  if (candidateFeatures && likedItems.length > 0) {
    let maxJaccard = 0;
    for (const liked of likedItems) {
      const likedFeatures = featuresMap.get(`${liked.tmdb_id}-${liked.media_type}`);
      if (!likedFeatures) continue;
      const score = jaccardFeatures(candidateFeatures, likedFeatures);
      if (score > maxJaccard) maxJaccard = score;
    }
    jaccardScore = maxJaccard;
  }

  return Math.max(tmdbScore, jaccardScore);
}

// ─── Cache similar_items ──────────────────────────────────────────────────────

/**
 * Vérifie si le cache similar_items est frais pour un source item donné.
 * Retourne true si des données existent et sont < 30 jours.
 */
async function isCacheFresh(tmdbId: number, mediaType: "movie" | "tv"): Promise<boolean> {
  // Admin client — similar_items est une table de cache interne
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  const cutoff = new Date(Date.now() - CACHE_TTL_MS).toISOString();

  const { data } = await supabase
    .from("similar_items")
    .select("fetched_at")
    .eq("source_tmdb_id", tmdbId)
    .eq("source_media_type", mediaType)
    .gt("fetched_at", cutoff)
    .limit(1) as { data: Array<{ fetched_at: string }> | null };

  return (data?.length ?? 0) > 0;
}

/**
 * Fetch les items similaires depuis TMDB et les stocke dans similar_items.
 * Idempotent : upsert sur la clé primaire composite.
 * Ne plante jamais — les erreurs sont silencieuses (cache best-effort).
 *
 * À appeler en fire-and-forget depuis route.ts :
 *   void fetchAndCacheSimilarItems(tmdbId, mediaType);
 */
export async function fetchAndCacheSimilarItems(
  tmdbId: number,
  mediaType: "movie" | "tv"
): Promise<void> {
  try {
    // Vérifie le TTL avant de fetcher
    const fresh = await isCacheFresh(tmdbId, mediaType);
    if (fresh) return;

    // Fetch TMDB /similar
    const endpoint = mediaType === "movie"
      ? `/movie/${tmdbId}/similar`
      : `/tv/${tmdbId}/similar`;

    const url = `${TMDB_BASE}${endpoint}?api_key=${TMDB_KEY}&language=fr-FR&page=1`;
    const res = await fetch(url, { next: { revalidate: 86400 } });
    if (!res.ok) return;

    const data = await res.json() as {
      results: Array<{ id: number; title?: string; name?: string }>;
    };

    const results = (data.results ?? []).slice(0, MAX_SIMILAR_ITEMS);
    if (results.length === 0) return;

    // Score positionnel : premier item = 1.0, dernier ≈ 0.5 (interpolation linéaire)
    const rows = results.map((item, index) => ({
      source_tmdb_id:    tmdbId,
      source_media_type: mediaType,
      similar_tmdb_id:   item.id,
      similar_media_type: mediaType, // TMDB /similar retourne le même type
      score: Number((1.0 - (index / (results.length - 1 || 1)) * 0.5).toFixed(3)),
      fetched_at: new Date().toISOString(),
    }));

    // Admin client — similar_items est une table de cache interne
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any;
    await supabase
      .from("similar_items")
      .upsert(rows, { onConflict: "source_tmdb_id,source_media_type,similar_tmdb_id" });

  } catch {
    // Silencieux — le cache est best-effort, le Jaccard fallback prend le relais
  }
}

// ─── Chargement de la similarityMap ──────────────────────────────────────────

/**
 * Charge la similarityMap depuis similar_items pour un ensemble de liked items.
 * Pour chaque candidat potentiel, agrège le score max parmi tous les liked items
 * qui l'ont comme similar_item.
 *
 * Utilisé dans route.ts avant la boucle de scoring.
 *
 * @param likedItems  Top 10 liked items de l'utilisateur
 * @returns SimilarityMap : "{similar_tmdb_id}-{media_type}" → score max [0,1]
 */
export async function loadSimilarityMap(likedItems: LikedItemRef[]): Promise<SimilarityMap> {
  if (likedItems.length === 0) return new Map();

  // Admin client — similar_items est une table de cache interne
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;
  const likedIds = likedItems.map((l) => l.tmdb_id);

  const { data } = await supabase
    .from("similar_items")
    .select("source_tmdb_id, source_media_type, similar_tmdb_id, similar_media_type, score")
    .in("source_tmdb_id", likedIds) as {
      data: Array<{
        source_tmdb_id: number;
        source_media_type: string;
        similar_tmdb_id: number;
        similar_media_type: string;
        score: number;
      }> | null;
    };

  const map: SimilarityMap = new Map();
  for (const row of data ?? []) {
    const key = `${row.similar_tmdb_id}-${row.similar_media_type}`;
    // Garde le score max si plusieurs liked items ont le même similar
    const existing = map.get(key) ?? 0;
    if (row.score > existing) {
      map.set(key, row.score);
    }
  }

  return map;
}
