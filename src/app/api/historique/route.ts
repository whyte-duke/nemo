import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import type { WatchHistory, ExternalWatchHistory } from "@/types/supabase";

export interface HistoryItem {
  id: string;
  source: "nemo" | "letterboxd" | "netflix_csv" | "trakt";
  tmdb_id: number | null;
  media_type: "movie" | "tv";
  title: string | null;
  poster_path: string | null;
  watched_at: string;
  // watch_history
  progress?: number | null;
  season_number?: number | null;
  episode_number?: number | null;
  // external_watch_history
  user_rating?: number | null;
  review?: string | null;
}

export interface HistoryPage {
  items: HistoryItem[];
  nextCursor: string | null;
}

const PAGE_SIZE = 20;
/** Fetch par table avec marge pour absorber l'entrelacement des deux sources */
const FETCH_LIMIT = PAGE_SIZE * 3;

export async function GET(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor"); // ISO date du dernier item reçu
  const source = searchParams.get("source") ?? "all"; // filtre optionnel

  const supabase = createAdminClient();

  const fetchInternal =
    source === "all" || source === "nemo"
      ? supabase
          .from("watch_history")
          .select("*")
          .eq("user_id", user.id)
          .order("last_watched_at", { ascending: false })
          .limit(FETCH_LIMIT)
          .then(({ data }) =>
            ((data ?? []) as WatchHistory[]).map((item) => ({
              id: item.id,
              source: "nemo" as const,
              tmdb_id: item.tmdb_id,
              media_type: item.media_type,
              title: null as string | null,
              poster_path: null as string | null,
              watched_at: item.last_watched_at,
              progress: item.progress,
              season_number: item.season_number,
              episode_number: item.episode_number,
              user_rating: null as number | null,
              review: null as string | null,
            }))
          )
      : Promise.resolve([] as HistoryItem[]);

  const fetchExternal =
    source === "all" || source !== "nemo"
      ? supabase
          .from("external_watch_history")
          .select("*")
          .eq("user_id", user.id)
          .order("watched_at", { ascending: false })
          .limit(FETCH_LIMIT)
          .then(({ data }) =>
            ((data ?? []) as ExternalWatchHistory[])
              .filter((item) => source === "all" || item.source === source)
              .map((item) => ({
                id: item.id,
                source: item.source as "letterboxd" | "netflix_csv" | "trakt",
                tmdb_id: item.tmdb_id,
                media_type: item.media_type as "movie" | "tv",
                title: item.title,
                poster_path: null as string | null,
                watched_at: item.watched_at ?? "",
                progress: null as number | null,
                season_number: null as number | null,
                episode_number: null as number | null,
                user_rating: item.user_rating != null ? Number(item.user_rating) : null,
                review: item.review ?? null,
              }))
          )
      : Promise.resolve([] as HistoryItem[]);

  const [internalItems, externalItems] = await Promise.all([
    fetchInternal,
    fetchExternal,
  ]);

  // Fusionner + trier chronologiquement
  const all = [...internalItems, ...externalItems].sort(
    (a, b) => new Date(b.watched_at).getTime() - new Date(a.watched_at).getTime()
  );

  // Appliquer le curseur (exclure tout ce qui est >= cursor)
  const afterCursor = cursor
    ? all.filter((i) => new Date(i.watched_at).getTime() < new Date(cursor).getTime())
    : all;

  // Prendre la page + 1 pour savoir s'il y a une suite
  const page = afterCursor.slice(0, PAGE_SIZE + 1);
  const hasMore = page.length > PAGE_SIZE;
  const items = page.slice(0, PAGE_SIZE);

  // Enrichissement TMDB uniquement sur les items de la page
  const TMDB_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY ?? "";

  const tmdbKeys = [
    ...new Set(
      items
        .filter((i) => i.tmdb_id != null)
        .map((i) => `${i.media_type}:${i.tmdb_id}`)
    ),
  ];

  const tmdbCache = new Map<string, { title: string; poster_path: string | null }>();

  await Promise.all(
    tmdbKeys.map(async (key) => {
      const [type, id] = key.split(":");
      try {
        const res = await fetch(
          `https://api.themoviedb.org/3/${type}/${id}?api_key=${TMDB_KEY}&language=fr-FR`,
          { next: { revalidate: 86400 } }
        );
        if (res.ok) {
          const data = (await res.json()) as {
            title?: string;
            name?: string;
            poster_path?: string | null;
          };
          tmdbCache.set(key, {
            title: data.title ?? data.name ?? "",
            poster_path: data.poster_path ?? null,
          });
        }
      } catch {
        // ignore les erreurs individuelles
      }
    })
  );

  const enriched: HistoryItem[] = items.map((item) => {
    if (item.tmdb_id != null) {
      const key = `${item.media_type}:${item.tmdb_id}`;
      const tmdb = tmdbCache.get(key);
      if (tmdb) {
        return {
          ...item,
          title: item.title ?? tmdb.title,
          poster_path: tmdb.poster_path,
        };
      }
    }
    return item;
  });

  const result: HistoryPage = {
    items: enriched,
    nextCursor: hasMore ? (items.at(-1)?.watched_at ?? null) : null,
  };

  return NextResponse.json(result);
}
