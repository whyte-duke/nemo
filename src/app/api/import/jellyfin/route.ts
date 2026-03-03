import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createJellyfinClient } from "@/lib/jellyfin/client";

type ExternalWatchHistoryRow = {
  user_id: string;
  source: string;
  tmdb_id: number | null;
  imdb_id: string | null;
  media_type: string;
  title: string;
  watched_at: string | null;
  raw_data: object;
};

export async function POST() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  const { data: profile } = await supabase
    .from("profiles")
    .select("personal_jellyfin_url, jellyfin_user_id, jellyfin_user_token")
    .eq("id", user.id)
    .single();

  if (!profile?.jellyfin_user_token || !profile?.jellyfin_user_id) {
    return NextResponse.json({ error: "Compte Jellyfin non connecté" }, { status: 401 });
  }
  if (!profile?.personal_jellyfin_url) {
    return NextResponse.json({ error: "Serveur Jellyfin non configuré" }, { status: 400 });
  }

  try {
    const client = createJellyfinClient(profile.personal_jellyfin_url as string);
    const items = await client.getPlayedItems(
      profile.jellyfin_user_token as string,
      profile.jellyfin_user_id as string,
      500
    );

    // Séparer en deux groupes selon la disponibilité des IDs :
    // 1. Items avec imdb_id → upsert sur (user_id, source, imdb_id)
    // 2. Items avec tmdb_id seulement → upsert sur (user_id, source, tmdb_id)
    const rowsWithImdb: ExternalWatchHistoryRow[] = [];
    const rowsTmdbOnly: ExternalWatchHistoryRow[] = [];

    const seenKeys = new Set<string>();

    for (const item of items.Items) {
      if (!["Movie", "Series"].includes(item.Type)) continue;

      const tmdbId = item.ProviderIds?.Tmdb ? parseInt(item.ProviderIds.Tmdb, 10) : null;
      const imdbId = item.ProviderIds?.Imdb ?? null;
      const mediaType = item.Type === "Movie" ? "movie" : "tv";

      // Clé de déduplication locale
      const dedupeKey = imdbId ?? (tmdbId ? `tmdb-${tmdbId}` : `jf-${item.Id}`);
      if (seenKeys.has(dedupeKey)) continue;
      seenKeys.add(dedupeKey);

      const row: ExternalWatchHistoryRow = {
        user_id: user.id,
        source: "jellyfin",
        tmdb_id: tmdbId,
        imdb_id: imdbId,
        media_type: mediaType,
        title: item.Name,
        watched_at: item.UserData?.LastPlayedDate ?? null,
        raw_data: {
          jellyfinId: item.Id,
          playCount: item.UserData?.PlayCount ?? 1,
          year: item.ProductionYear,
        },
      };

      if (imdbId) {
        rowsWithImdb.push(row);
      } else if (tmdbId) {
        rowsTmdbOnly.push(row);
      }
      // Items sans aucun ID externe sont ignorés (pas de moyen de dédupliquer)
    }

    let totalInserted = 0;
    const BATCH = 500;

    // Batch 1 : items avec imdb_id → contrainte ewh_imdb_unique
    if (rowsWithImdb.length > 0) {
      for (let i = 0; i < rowsWithImdb.length; i += BATCH) {
        const batch = rowsWithImdb.slice(i, i + BATCH);
        const { error } = await supabase
          .from("external_watch_history")
          .upsert(batch, { onConflict: "user_id,source,imdb_id", ignoreDuplicates: false });
        if (!error) totalInserted += batch.length;
        else console.error("[Jellyfin Import] Batch imdb error:", error);
      }
    }

    // Batch 2 : items avec tmdb_id seulement → contrainte ewh_jellyfin_tmdb_unique
    if (rowsTmdbOnly.length > 0) {
      for (let i = 0; i < rowsTmdbOnly.length; i += BATCH) {
        const batch = rowsTmdbOnly.slice(i, i + BATCH);
        const { error } = await supabase
          .from("external_watch_history")
          .upsert(batch, { onConflict: "user_id,source,tmdb_id", ignoreDuplicates: false });
        if (!error) totalInserted += batch.length;
        else console.error("[Jellyfin Import] Batch tmdb error:", error);
      }
    }

    return NextResponse.json({ count: totalInserted });
  } catch (err) {
    console.error("[Jellyfin Import]", err);
    return NextResponse.json({ error: "Erreur lors de l'import Jellyfin" }, { status: 500 });
  }
}
