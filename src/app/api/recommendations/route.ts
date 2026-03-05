/**
 * GET /api/recommendations
 *
 * Retourne les recommandations personnalisées de l'utilisateur.
 *
 * Flux :
 *   1. Charge le profil de goût (user_taste_profiles)
 *   2. Charge les exclusions (interactions existantes) + likes amis
 *   3. Fetch les candidats TMDB diversifiés (6 sources fixes + genre-based discover)
 *      + loadEnrichedSimilarityMap en parallèle (Phase 04)
 *   4. Filtre les exclusions
 *   4b. Charge les features DB — chargement initial
 *   4c. Pre-fetch inline des features manquantes (max 20, concurrent 5)
 *   4d. Recharge les features après pre-fetch
 *   5. Score + trie par score décroissant
 *   6. Retourne les N premiers
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
import { fetchCandidates, preFetchMissingFeatures } from "@/lib/recommendations/candidates";
import type { ScoredItem, TMDbCandidateItem, CandidateFeatures } from "@/lib/recommendations/scorer";
import type { TasteProfile } from "@/lib/recommendations/taste-profile";
import {
  loadEnrichedSimilarityMap,
  fetchAndCacheSimilarItems,
} from "@/lib/recommendations/similarity";
import type { LikedItemRef, EnrichedSimilarityMap } from "@/lib/recommendations/similarity";

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
      .select("tmdb_id, media_type, type")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }) as Promise<{ data: Array<{ tmdb_id: number; media_type: string; type: string | null }> | null }>,
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

  // Top 10 liked items les plus récents — base du calcul de similarité
  // Triés par ordre d'insertion (les plus récents d'abord via la query .order ci-dessous)
  const likedItemsBase: Array<{ tmdb_id: number; media_type: "movie" | "tv" }> = (interacted ?? [])
    .filter((r) => r.type === "like")
    .slice(0, 10)
    .map((r) => ({ tmdb_id: r.tmdb_id, media_type: r.media_type as "movie" | "tv" }));

  // 3. ── Candidats TMDB diversifiés + similarityMap enrichie (en parallèle) ──
  // Sources : popular, top_rated, trending (×2 médias) + genre-based discover
  // Phase 04 : loadEnrichedSimilarityMap retourne Map<key, SimilarityData> avec sourceTitle
  const [{ movies: allMovies, tv: allTV }, enrichedSimilarityMap] = await Promise.all([
    fetchCandidates(hasProfile ? profile : null),
    // Charge la similarityMap — les titres seront enrichis depuis les candidats après
    // Si Phase 03 n'est pas déployée, retourne Map vide (graceful degradation)
    loadEnrichedSimilarityMap(likedItemsBase).catch(
      (): EnrichedSimilarityMap => new Map()
    ),
  ]);

  // Enrichit les titres des liked items depuis les candidats TMDB (si disponibles)
  // Les liked items populaires apparaissent souvent dans les candidats trending
  const candidateTitleMap = new Map<string, string>();
  for (const m of allMovies) {
    if (m.title) candidateTitleMap.set(`${m.id}-movie`, m.title);
  }
  for (const t of allTV) {
    if (t.name) candidateTitleMap.set(`${t.id}-tv`, t.name);
  }

  // Enrichit sourceTitle dans la similarityMap en mémoire (évite un 2e appel DB)
  const likedItems: LikedItemRef[] = likedItemsBase.map((r) => ({
    ...r,
    title: candidateTitleMap.get(`${r.tmdb_id}-${r.media_type}`),
  }));

  const finalSimilarityMap: EnrichedSimilarityMap = new Map(enrichedSimilarityMap);
  for (const item of likedItems) {
    if (!item.title) continue;
    const key = `${item.tmdb_id}-${item.media_type}`;
    const existing = finalSimilarityMap.get(key);
    if (existing) finalSimilarityMap.set(key, { ...existing, sourceTitle: item.title });
  }

  // Fire-and-forget : refresh similar_items pour les liked items périmés
  // Batch de 3 pour respecter les rate limits TMDB (40 req/s)
  for (let i = 0; i < likedItems.length; i += 3) {
    const batch = likedItems.slice(i, i + 3);
    void Promise.all(batch.map((item) => fetchAndCacheSimilarItems(item.tmdb_id, item.media_type)));
  }

  const movieCandidates = allMovies.filter((m) => !excludedSet.has(`${m.id}-movie`));
  const tvCandidates    = allTV.filter((m) => !excludedSet.has(`${m.id}-tv`));

  // 4. ── Features DB — chargement initial ───────────────────────────────────
  const allIds = [
    ...movieCandidates.map((m) => m.id),
    ...tvCandidates.map((m) => m.id),
  ].slice(0, 200);

  const { data: featuresRows } = await supabase
    .from("media_features")
    .select("tmdb_id, media_type, genre_ids, keyword_ids, cast_ids, director_ids")
    .in("tmdb_id", allIds) as { data: CandidateFeatures[] | null };

  const featureMap = new Map<string, CandidateFeatures>();
  for (const f of featuresRows ?? []) {
    featureMap.set(`${f.tmdb_id}-${f.media_type}`, f);
  }

  // 4b. ── Pre-fetch features manquantes (inline, max 20, concurrent 5) ──────
  const allCandidatesMeta = [
    ...movieCandidates.map((m) => ({ id: m.id, mediaType: "movie" as const })),
    ...tvCandidates.map((m) => ({ id: m.id, mediaType: "tv" as const })),
  ];

  await preFetchMissingFeatures(allCandidatesMeta, featureMap);

  // 4c. ── Recharge les features après pre-fetch ─────────────────────────────
  const { data: featuresRowsUpdated } = await supabase
    .from("media_features")
    .select("tmdb_id, media_type, genre_ids, keyword_ids, cast_ids, director_ids")
    .in("tmdb_id", allIds) as { data: CandidateFeatures[] | null };

  const featureMapFinal = new Map<string, CandidateFeatures>();
  for (const f of featuresRowsUpdated ?? []) {
    featureMapFinal.set(`${f.tmdb_id}-${f.media_type}`, f);
  }

  // 5. ── Scoring — Phase 04 : nouveaux poids + similarityMap enrichie ────────
  // Formule : 0.40*taste + 0.20*similarity + 0.20*social + 0.10*trending + 0.10*quality
  const scored: ScoredItem[] = [];

  for (const m of movieCandidates) {
    scored.push(
      scoreItem(
        hasProfile ? profile : null,
        m,
        featureMapFinal.get(`${m.id}-movie`),
        "movie",
        friendLikeMap,
        friendCount,
        finalSimilarityMap
      )
    );
  }
  for (const m of tvCandidates) {
    scored.push(
      scoreItem(
        hasProfile ? profile : null,
        m,
        featureMapFinal.get(`${m.id}-tv`),
        "tv",
        friendLikeMap,
        friendCount,
        finalSimilarityMap
      )
    );
  }

  scored.sort((a, b) => b.score - a.score);

  return NextResponse.json({
    items: scored.slice(0, limit),
    hasProfile,
  });
}
