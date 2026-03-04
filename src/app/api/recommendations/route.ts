/**
 * GET /api/recommendations
 *
 * Retourne les recommandations personnalisées de l'utilisateur.
 *
 * Flux :
 *   1. Charge le profil de goût (user_taste_profiles)
 *   2. Charge les exclusions (interactions existantes)
 *   3. Fetch 2 pages de films populaires + 2 pages de séries depuis TMDB
 *   4. Filtre les exclusions
 *   5. Charge les features disponibles depuis media_features
 *   6. Score + trie par score décroissant
 *   7. Retourne les N premiers
 *
 * Le client utilise staleTime: 15min (React Query) pour éviter les refetch.
 *
 * Paramètres :
 *   ?limit=20  — nombre de résultats (max 50, défaut 20)
 */

import { NextResponse, type NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTasteProfile } from "@/lib/recommendations/taste-profile";
import { scoreItem } from "@/lib/recommendations/scorer";
import type { ScoredItem, TMDbCandidateItem, CandidateFeatures } from "@/lib/recommendations/scorer";
import type { TasteProfile } from "@/lib/recommendations/taste-profile";

const TMDB_BASE = process.env.NEXT_PUBLIC_TMDB_BASE_URL ?? "https://api.themoviedb.org/3";
const TMDB_KEY  = process.env.NEXT_PUBLIC_TMDB_API_KEY ?? "";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function tmdbPage<T>(endpoint: string, page: number): Promise<T[]> {
  try {
    const url = `${TMDB_BASE}${endpoint}?api_key=${TMDB_KEY}&language=fr-FR&region=FR&page=${page}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json() as { results: T[] };
    return data.results ?? [];
  } catch {
    return [];
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const params = request.nextUrl.searchParams;
  const limit  = Math.min(Number(params.get("limit") ?? 20), 50);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  // 1. ── Profil de goût ──────────────────────────────────────────────────────
  const profile: TasteProfile | null = await getTasteProfile(user.id);

  const hasProfile = profile !== null && (
    Object.keys(profile.genre_scores).length > 0 ||
    Object.keys(profile.director_scores).length > 0
  );

  // 2. ── Exclusions (déjà interagi) + likes amis ───────────────────────────
  const [{ data: interacted }, { data: friends }] = await Promise.all([
    supabase
      .from("interactions")
      .select("tmdb_id, media_type")
      .eq("user_id", user.id) as Promise<{ data: Array<{ tmdb_id: number; media_type: string }> | null }>,
    supabase
      .from("friendships")
      .select("user_id, friend_id")
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`) as Promise<{ data: Array<{ user_id: string; friend_id: string }> | null }>,
  ]);

  const excludedSet = new Set<string>(
    (interacted ?? []).map((r) => `${r.tmdb_id}-${r.media_type}`)
  );

  // IDs des amis (les deux sens de la relation)
  const friendIds = (friends ?? []).map((f) =>
    f.user_id === user.id ? f.friend_id : f.user_id
  );
  const friendCount = friendIds.length;

  // Likes des amis — utilisés pour le score social
  let friendLikeMap = new Map<string, number>();
  if (friendIds.length > 0) {
    const { data: friendInteractions } = await supabase
      .from("interactions")
      .select("tmdb_id, media_type")
      .in("user_id", friendIds)
      .eq("type", "like") as { data: Array<{ tmdb_id: number; media_type: string }> | null };

    for (const fi of friendInteractions ?? []) {
      const key = `${fi.tmdb_id}-${fi.media_type}`;
      friendLikeMap.set(key, (friendLikeMap.get(key) ?? 0) + 1);
    }
  }

  // 3. ── Candidats TMDB ──────────────────────────────────────────────────────
  const [moviesP1, moviesP2, tvP1, tvP2] = await Promise.all([
    tmdbPage<TMDbCandidateItem>("/movie/popular", 1),
    tmdbPage<TMDbCandidateItem>("/movie/popular", 2),
    tmdbPage<TMDbCandidateItem>("/tv/popular", 1),
    tmdbPage<TMDbCandidateItem>("/tv/popular", 2),
  ]);

  const movieCandidates = [...moviesP1, ...moviesP2].filter(
    (m) => !excludedSet.has(`${m.id}-movie`)
  );
  const tvCandidates = [...tvP1, ...tvP2].filter(
    (m) => !excludedSet.has(`${m.id}-tv`)
  );

  // 4. ── Features DB ─────────────────────────────────────────────────────────
  const allIds = [
    ...movieCandidates.map((m) => m.id),
    ...tvCandidates.map((m) => m.id),
  ].slice(0, 160);

  const { data: featuresRows } = await supabase
    .from("media_features")
    .select("tmdb_id, media_type, genre_ids, keyword_ids, cast_ids, director_ids")
    .in("tmdb_id", allIds) as { data: CandidateFeatures[] | null };

  const featureMap = new Map<string, CandidateFeatures>();
  for (const f of featuresRows ?? []) {
    featureMap.set(`${f.tmdb_id}-${f.media_type}`, f);
  }

  // 5. ── Scoring ─────────────────────────────────────────────────────────────
  const scored: ScoredItem[] = [];

  for (const m of movieCandidates) {
    scored.push(scoreItem(hasProfile ? profile : null, m, featureMap.get(`${m.id}-movie`), "movie", friendLikeMap, friendCount));
  }
  for (const m of tvCandidates) {
    scored.push(scoreItem(hasProfile ? profile : null, m, featureMap.get(`${m.id}-tv`), "tv", friendLikeMap, friendCount));
  }

  scored.sort((a, b) => b.score - a.score);

  return NextResponse.json({
    items: scored.slice(0, limit),
    hasProfile,
  });
}
