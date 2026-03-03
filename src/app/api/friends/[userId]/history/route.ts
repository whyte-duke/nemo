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

  const { data: history } = await supabase
    .from("watch_history")
    .select("tmdb_id, media_type, progress, last_watched_at")
    .eq("user_id", userId)
    .gte("progress", 80)
    .order("last_watched_at", { ascending: false })
    .limit(50);

  if (!history || history.length === 0) return NextResponse.json([]);

  const enriched = await Promise.all(
    history.map(async (h: { tmdb_id: number; media_type: string; last_watched_at: string }) => {
      try {
        if (h.media_type === "movie") {
          const m = await getMovieSummary(h.tmdb_id);
          return { ...h, title: m.title, poster_path: m.poster_path };
        }
        const t = await getTVShowSummary(h.tmdb_id);
        return { ...h, title: t.name, poster_path: t.poster_path };
      } catch {
        return { ...h, title: `#${h.tmdb_id}`, poster_path: null };
      }
    })
  );

  return NextResponse.json(enriched);
}
