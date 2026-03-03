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

  const { data: likes } = await supabase
    .from("interactions")
    .select("tmdb_id, media_type, created_at")
    .eq("user_id", userId)
    .eq("type", "like")
    .order("created_at", { ascending: false })
    .limit(50);

  if (!likes || likes.length === 0) return NextResponse.json([]);

  const enriched = await Promise.all(
    likes.map(async (l: { tmdb_id: number; media_type: string }) => {
      try {
        if (l.media_type === "movie") {
          const m = await getMovieSummary(l.tmdb_id);
          return { ...l, title: m.title, poster_path: m.poster_path };
        }
        const t = await getTVShowSummary(l.tmdb_id);
        return { ...l, title: t.name, poster_path: t.poster_path };
      } catch {
        return { ...l, title: `#${l.tmdb_id}`, poster_path: null };
      }
    })
  );

  return NextResponse.json(enriched);
}
