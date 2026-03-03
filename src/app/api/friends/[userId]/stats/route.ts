import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { createRawAdminClient as createAdminClient } from "@/lib/supabase/admin";
import { getMovieSummary, getTVShowSummary } from "@/lib/tmdb/client";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const { userId } = await params;
  const supabase = createAdminClient();

  // Récupère historique
  const { data: history } = await supabase
    .from("watch_history")
    .select("tmdb_id, media_type, progress, last_watched_at")
    .eq("user_id", userId)
    .order("last_watched_at", { ascending: false });

  // Récupère interactions
  const { data: interactions } = await supabase
    .from("interactions")
    .select("type, tmdb_id, media_type")
    .eq("user_id", userId);

  // Récupère listes
  const { data: lists } = await supabase
    .from("lists")
    .select("id, name, icon")
    .eq("user_id", userId);

  const watched = (history ?? []).filter((h: { progress: number }) => h.progress >= 80);
  const likes = (interactions ?? []).filter((i: { type: string }) => i.type === "like");
  const dislikes = (interactions ?? []).filter((i: { type: string }) => i.type === "dislike");

  // Top genres : enrichit les 20 derniers films/séries avec TMDB
  const recent20 = watched.slice(0, 20);
  const genreCount: Record<string, number> = {};

  await Promise.allSettled(
    recent20.map(async (item: { tmdb_id: number; media_type: string }) => {
      try {
        const data =
          item.media_type === "movie"
            ? await getMovieSummary(item.tmdb_id)
            : await getTVShowSummary(item.tmdb_id);
        const genres = (data as { genres?: Array<{ name: string }> }).genres ?? [];
        genres.forEach((g) => {
          genreCount[g.name] = (genreCount[g.name] ?? 0) + 1;
        });
      } catch {
        // ignore
      }
    })
  );

  const topGenres = Object.entries(genreCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  // Films vus récemment (5 derniers) — données légères
  const recentWatched = watched.slice(0, 5).map((h: { tmdb_id: number; media_type: string; last_watched_at: string }) => ({
    tmdb_id: h.tmdb_id,
    media_type: h.media_type,
    last_watched_at: h.last_watched_at,
  }));

  return NextResponse.json({
    total_watched: watched.length,
    total_likes: likes.length,
    total_dislikes: dislikes.length,
    total_lists: (lists ?? []).length,
    top_genres: topGenres,
    recent_watched: recentWatched,
  });
}
