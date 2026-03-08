import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WatchHistory } from "@/types/supabase";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("watch_history")
    .select("*")
    .eq("user_id", user.id)
    .order("last_watched_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data as WatchHistory[]);
}

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  let body: {
    tmdbId: number;
    mediaType: "movie" | "tv";
    progress: number;
    duration?: number;
    seasonNumber?: number;
    episodeNumber?: number;
    lastPositionSeconds?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const { tmdbId, mediaType, progress, duration, seasonNumber, episodeNumber, lastPositionSeconds } = body;
  if (typeof tmdbId !== "number" || !mediaType || typeof progress !== "number") {
    return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
  }

  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from("watch_history").upsert(
    {
      user_id: user.id,
      tmdb_id: tmdbId,
      media_type: mediaType,
      progress,
      duration: duration ?? null,
      season_number: seasonNumber ?? null,
      episode_number: episodeNumber ?? null,
      last_watched_at: new Date().toISOString(),
      last_position_seconds: lastPositionSeconds ?? null,
    },
    { onConflict: "user_id,tmdb_id,media_type" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
