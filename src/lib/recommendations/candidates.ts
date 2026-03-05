/**
 * Candidate Pipeline — Phase 02 du système de recommandation
 *
 * Sources TMDB diversifiées :
 *   - /movie/popular, /tv/popular (1 page chacun)
 *   - /movie/top_rated, /tv/top_rated (1 page chacun)
 *   - /trending/movie/week, /trending/tv/week (1 page chacun)
 *   - /discover/movie?with_genres=X, /discover/tv?with_genres=X (top genre du profil)
 *
 * Déduplique par tmdb_id+media_type. Résultat max 200 candidats par type.
 */

import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { fetchMediaFeatures } from "@/lib/tmdb/features";
import type { TMDbCandidateItem, CandidateFeatures } from "@/lib/recommendations/scorer";
import type { TasteProfile } from "@/lib/recommendations/taste-profile";

const TMDB_BASE = process.env.NEXT_PUBLIC_TMDB_BASE_URL ?? "https://api.themoviedb.org/3";
const TMDB_KEY  = process.env.NEXT_PUBLIC_TMDB_API_KEY ?? "";
const MAX_CANDIDATES = 200;
const MAX_PREFETCH = 20;
const PREFETCH_CONCURRENCY = 5;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Limite la concurrence d'un ensemble de tâches async.
 * Alternative légère à p-limit — pas de dépendance supplémentaire.
 * Retourne les résultats dans l'ordre d'achèvement (non garanti d'être dans
 * l'ordre d'entrée, mais acceptable pour ce use-case).
 */
export async function asyncPool<T>(
  concurrency: number,
  tasks: Array<() => Promise<T>>
): Promise<T[]> {
  const results: T[] = [];
  const active = new Set<Promise<void>>();
  const indexedResults: Array<{ idx: number; value: T }> = [];

  for (let i = 0; i < tasks.length; i++) {
    const taskIndex = i;
    const task = tasks[taskIndex]!;
    const p: Promise<void> = task().then((r) => {
      indexedResults.push({ idx: taskIndex, value: r });
      active.delete(p);
    });
    active.add(p);
    if (active.size >= concurrency) {
      await Promise.race(active);
    }
  }

  await Promise.all(active);

  // Trier par index pour garantir l'ordre d'entrée
  indexedResults.sort((a, b) => a.idx - b.idx);
  for (const { value } of indexedResults) {
    results.push(value);
  }

  return results;
}

/**
 * Fetch une page de résultats TMDB.
 * Retourne un tableau vide en cas d'erreur (silent failure).
 */
async function tmdbPage<T>(
  endpoint: string,
  page = 1,
  extraParams: Record<string, string> = {}
): Promise<T[]> {
  try {
    const url = new URL(`${TMDB_BASE}${endpoint}`);
    url.searchParams.set("api_key", TMDB_KEY);
    url.searchParams.set("language", "fr-FR");
    url.searchParams.set("region", "FR");
    url.searchParams.set("page", String(page));
    for (const [k, v] of Object.entries(extraParams)) {
      url.searchParams.set(k, v);
    }
    const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json() as { results: T[] };
    return data.results ?? [];
  } catch {
    return [];
  }
}

// ─── Types publics ─────────────────────────────────────────────────────────────

export interface CandidateSet {
  movies: TMDbCandidateItem[];
  tv: TMDbCandidateItem[];
}

// ─── Fetch candidats ───────────────────────────────────────────────────────────

/**
 * Récupère les candidats depuis les sources TMDB diversifiées.
 * Les sources fixes (6 appels) sont appelées en parallèle (Promise.all).
 * Les appels genre-based sont ajoutés si un profil avec genre_scores existe.
 *
 * @param profile  Profil de goût utilisateur (null = pas encore calculé)
 */
export async function fetchCandidates(profile: TasteProfile | null): Promise<CandidateSet> {
  // Sources fixes : 6 appels en parallèle
  const [
    moviesPopular,
    tvPopular,
    moviesTopRated,
    tvTopRated,
    moviesTrending,
    tvTrending,
  ] = await Promise.all([
    tmdbPage<TMDbCandidateItem>("/movie/popular"),
    tmdbPage<TMDbCandidateItem>("/tv/popular"),
    tmdbPage<TMDbCandidateItem>("/movie/top_rated"),
    tmdbPage<TMDbCandidateItem>("/tv/top_rated"),
    tmdbPage<TMDbCandidateItem>("/trending/movie/week"),
    tmdbPage<TMDbCandidateItem>("/trending/tv/week"),
  ]);

  // Sources genre-based : seulement si profil avec genre_scores disponible
  let moviesGenre: TMDbCandidateItem[] = [];
  let tvGenre: TMDbCandidateItem[] = [];

  if (profile && Object.keys(profile.genre_scores).length > 0) {
    // Top genre du profil trié par score décroissant (ADR-02-02 : top 1 genre)
    const topGenreEntry = Object.entries(profile.genre_scores)
      .sort((a, b) => b[1] - a[1])
      .at(0);

    if (topGenreEntry) {
      const [genreId] = topGenreEntry;
      // Discover films + séries pour le genre dominant — en parallèle
      const [gMovies, gTV] = await Promise.all([
        tmdbPage<TMDbCandidateItem>("/discover/movie", 1, { with_genres: genreId }),
        tmdbPage<TMDbCandidateItem>("/discover/tv", 1, { with_genres: genreId }),
      ]);
      moviesGenre = gMovies;
      tvGenre = gTV;
    }
  }

  // Déduplique films par tmdb_id
  const movieSet = new Set<number>();
  const movies: TMDbCandidateItem[] = [];
  for (const m of [
    ...moviesPopular,
    ...moviesTopRated,
    ...moviesTrending,
    ...moviesGenre,
  ]) {
    if (!movieSet.has(m.id)) {
      movieSet.add(m.id);
      movies.push(m);
    }
  }

  // Déduplique séries par tmdb_id
  const tvSet = new Set<number>();
  const tv: TMDbCandidateItem[] = [];
  for (const s of [
    ...tvPopular,
    ...tvTopRated,
    ...tvTrending,
    ...tvGenre,
  ]) {
    if (!tvSet.has(s.id)) {
      tvSet.add(s.id);
      tv.push(s);
    }
  }

  return {
    movies: movies.slice(0, MAX_CANDIDATES),
    tv: tv.slice(0, MAX_CANDIDATES),
  };
}

// ─── Pre-fetch features manquantes ────────────────────────────────────────────

/**
 * Pré-charge les features manquantes pour les candidats non encore indexés.
 * Les erreurs sont ignorées silencieusement — le scoring dégrade gracieusement
 * vers trending/quality si les features restent absentes.
 *
 * Admin client justifié : écriture dans media_features est un cache cross-user
 * (contenu TMDB, pas de données utilisateur) — bypass RLS nécessaire.
 */
export async function preFetchMissingFeatures(
  candidates: Array<{ id: number; mediaType: "movie" | "tv" }>,
  existingFeatureMap: Map<string, CandidateFeatures>
): Promise<void> {
  // Identifier les candidats sans features
  const missing = candidates
    .filter((c) => !existingFeatureMap.has(`${c.id}-${c.mediaType}`))
    .slice(0, MAX_PREFETCH);

  if (missing.length === 0) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  const tasks = missing.map((c) => async () => {
    try {
      const features = await fetchMediaFeatures(c.id, c.mediaType);
      if (!features) return;

      await supabase.from("media_features").upsert(
        {
          tmdb_id: c.id,
          media_type: c.mediaType,
          genre_ids: features.genre_ids,
          keyword_ids: features.keyword_ids,
          cast_ids: features.cast_ids,
          director_ids: features.director_ids,
          language: features.language,
          vote_average: features.vote_average,
          popularity: features.popularity,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tmdb_id,media_type" }
      );
    } catch {
      // Erreur silencieuse — le candidat sera scoré avec le fallback trending
    }
  });

  await asyncPool(PREFETCH_CONCURRENCY, tasks);
}
