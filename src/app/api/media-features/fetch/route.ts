/**
 * POST /api/media-features/fetch
 *
 * Déclenché lazily après chaque like / dislike dans use-swipe-session.
 * Récupère les features TMDB d'un film/série et les stocke dans media_features.
 *
 * Idempotent : si les features existent et ont été fetchées il y a moins de 7 jours,
 * on renvoie { ok: true, cached: true } sans refetch.
 *
 * Sécurité : authentification utilisateur requise pour déclencher le fetch.
 * L'écriture en base utilise le client admin (service_role) conformément à la RLS.
 */

import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchMediaFeatures } from "@/lib/tmdb/features";

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  let body: { tmdbId: number; mediaType: "movie" | "tv" };
  try {
    body = await request.json() as { tmdbId: number; mediaType: "movie" | "tv" };
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const { tmdbId, mediaType } = body;
  if (typeof tmdbId !== "number" || !["movie", "tv"].includes(mediaType)) {
    return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  // ── Vérifier le cache ────────────────────────────────────────────────────────
  const { data: existing } = await supabase
    .from("media_features")
    .select("fetched_at")
    .eq("tmdb_id", tmdbId)
    .eq("media_type", mediaType)
    .single() as { data: { fetched_at: string } | null };

  if (existing?.fetched_at) {
    const age = Date.now() - new Date(existing.fetched_at).getTime();
    if (age < CACHE_TTL_MS) {
      return NextResponse.json({ ok: true, cached: true });
    }
  }

  // ── Récupérer les features depuis TMDB ───────────────────────────────────────
  const features = await fetchMediaFeatures(tmdbId, mediaType);
  if (!features) {
    // On renvoie 200 silencieusement — le client ne doit pas bloquer sur ça
    return NextResponse.json({ ok: false, error: "TMDB unavailable" });
  }

  // ── Upsert dans media_features ───────────────────────────────────────────────
  const { error } = await supabase.from("media_features").upsert(
    {
      tmdb_id: tmdbId,
      media_type: mediaType,
      genre_ids: features.genre_ids,
      keyword_ids: features.keyword_ids,
      cast_ids: features.cast_ids,
      director_ids: features.director_ids,
      language: features.language,
      vote_average: features.vote_average,
      popularity: features.popularity,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "tmdb_id,media_type" }
  ) as { error: { message: string } | null };

  if (error) {
    console.error("[media-features/fetch] upsert error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, cached: false });
}
