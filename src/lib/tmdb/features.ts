/**
 * TMDB Features Extractor — Phase 2 du système de recommandation
 *
 * Récupère les données brutes TMDB (genres, keywords, cast, directors)
 * nécessaires au calcul de similarité contenu.
 *
 * Format de similarité (Jaccard) :
 *   sim(A,B) = 0.30×genres + 0.25×keywords + 0.20×cast + 0.15×director + 0.10×langue
 */

const BASE_URL = process.env.NEXT_PUBLIC_TMDB_BASE_URL ?? "https://api.themoviedb.org/3";
const API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY ?? "";

// ─── Types internes ───────────────────────────────────────────────────────────

interface TMDbKeyword {
  id: number;
  name: string;
}

interface TMDbCastRaw {
  id: number;
  order: number;
  known_for_department: string;
}

interface TMDbCrewRaw {
  id: number;
  job: string;
}

interface MovieDetailRaw {
  genres: Array<{ id: number }>;
  keywords: { keywords: TMDbKeyword[] };
  credits: {
    cast: TMDbCastRaw[];
    crew: TMDbCrewRaw[];
  };
  original_language: string;
  vote_average: number;
  popularity: number;
}

interface TVDetailRaw {
  genres: Array<{ id: number }>;
  keywords: { results: TMDbKeyword[] };
  created_by: Array<{ id: number }>;
  credits: {
    cast: TMDbCastRaw[];
    crew: TMDbCrewRaw[];
  };
  original_language: string;
  vote_average: number;
  popularity: number;
}

// ─── Type public ─────────────────────────────────────────────────────────────

export interface MediaFeatures {
  genre_ids: number[];
  keyword_ids: number[];
  cast_ids: number[];      // top 5 acteurs principaux
  director_ids: number[];  // réalisateurs (film) ou créateurs (série)
  language: string | null;
  vote_average: number;
  popularity: number;
}

// ─── Fetch helper ─────────────────────────────────────────────────────────────

async function tmdbGet<T>(endpoint: string, appendToResponse: string): Promise<T | null> {
  try {
    const url = new URL(`${BASE_URL}${endpoint}`);
    url.searchParams.set("api_key", API_KEY);
    url.searchParams.set("language", "fr-FR");
    url.searchParams.set("append_to_response", appendToResponse);
    const res = await fetch(url.toString(), {
      // Cache 24h côté Next.js — les features d'un film changent rarement
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

// ─── Films ────────────────────────────────────────────────────────────────────

export async function fetchMovieFeatures(tmdbId: number): Promise<MediaFeatures | null> {
  const data = await tmdbGet<MovieDetailRaw>(`/movie/${tmdbId}`, "keywords,credits");
  if (!data) return null;

  const genre_ids = (data.genres ?? []).map((g) => g.id);

  // Limité à 30 keywords — équilibre entre précision et taille de la liste
  const keyword_ids = (data.keywords?.keywords ?? []).slice(0, 30).map((k) => k.id);

  // Top 5 acteurs (triés par ordre d'apparition au générique)
  const cast_ids = (data.credits?.cast ?? [])
    .filter((c) => c.known_for_department === "Acting")
    .sort((a, b) => a.order - b.order)
    .slice(0, 5)
    .map((c) => c.id);

  // Réalisateurs uniquement
  const director_ids = (data.credits?.crew ?? [])
    .filter((c) => c.job === "Director")
    .map((c) => c.id);

  return {
    genre_ids,
    keyword_ids,
    cast_ids,
    director_ids,
    language: data.original_language ?? null,
    vote_average: data.vote_average ?? 0,
    popularity: data.popularity ?? 0,
  };
}

// ─── Séries TV ────────────────────────────────────────────────────────────────

export async function fetchTVFeatures(tmdbId: number): Promise<MediaFeatures | null> {
  const data = await tmdbGet<TVDetailRaw>(`/tv/${tmdbId}`, "keywords,credits");
  if (!data) return null;

  const genre_ids = (data.genres ?? []).map((g) => g.id);

  // Pour les séries, keywords sont dans `results` (pas `keywords`)
  const keyword_ids = (data.keywords?.results ?? []).slice(0, 30).map((k) => k.id);

  const cast_ids = (data.credits?.cast ?? [])
    .filter((c) => c.known_for_department === "Acting")
    .sort((a, b) => a.order - b.order)
    .slice(0, 5)
    .map((c) => c.id);

  // Pour les séries : priorité aux créateurs (created_by), sinon showrunners dans crew
  const creator_ids = (data.created_by ?? []).map((c) => c.id);
  const director_ids =
    creator_ids.length > 0
      ? creator_ids
      : (data.credits?.crew ?? [])
          .filter((c) => c.job === "Creator" || c.job === "Executive Producer")
          .slice(0, 3)
          .map((c) => c.id);

  return {
    genre_ids,
    keyword_ids,
    cast_ids,
    director_ids,
    language: data.original_language ?? null,
    vote_average: data.vote_average ?? 0,
    popularity: data.popularity ?? 0,
  };
}

// ─── Dispatch selon media_type ────────────────────────────────────────────────

export async function fetchMediaFeatures(
  tmdbId: number,
  mediaType: "movie" | "tv"
): Promise<MediaFeatures | null> {
  return mediaType === "movie"
    ? fetchMovieFeatures(tmdbId)
    : fetchTVFeatures(tmdbId);
}
