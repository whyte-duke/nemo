import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { createRawAdminClient } from "@/lib/supabase/admin";
import { getMovieSummary, getTVShowSummary } from "@/lib/tmdb/client";

export interface ListPreviewItem {
  tmdb_id: number;
  media_type: "movie" | "tv";
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  genre_ids: number[];
}

export interface ListPreview {
  id: string;
  name: string;
  icon: string | null;
  item_count: number;
  items: ListPreviewItem[];
}

const ITEMS_PER_LIST = 20;

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const supabase = createRawAdminClient();

  // Listes dont l'utilisateur est membre
  const { data: memberships } = await supabase
    .from("list_members")
    .select("list_id")
    .eq("user_id", user.id);

  if (!memberships?.length) return NextResponse.json({ lists: [] });

  const listIds = (memberships as { list_id: string }[]).map((m) => m.list_id);

  // Récupère les métadonnées des listes
  const { data: lists } = await supabase
    .from("lists")
    .select("id, name, icon")
    .in("id", listIds);

  if (!lists?.length) return NextResponse.json({ lists: [] });

  // Récupère les items de chaque liste
  const { data: allItems } = await supabase
    .from("list_items")
    .select("list_id, tmdb_id, media_type")
    .in("list_id", listIds)
    .order("added_at", { ascending: false });

  type RawListItem = { list_id: string; tmdb_id: number; media_type: string };

  // Groupe par liste
  const itemsByList = new Map<string, RawListItem[]>();
  for (const item of (allItems ?? []) as RawListItem[]) {
    const arr = itemsByList.get(item.list_id) ?? [];
    if (arr.length < ITEMS_PER_LIST) arr.push(item);
    itemsByList.set(item.list_id, arr);
  }

  // Enrichit les items via TMDB (en parallèle par liste)
  const enrichedLists = await Promise.all(
    (lists as { id: string; name: string; icon: string | null }[]).map(async (list) => {
      const rawItems = itemsByList.get(list.id) ?? [];
      if (!rawItems.length) return null;

      const enriched = await Promise.all(
        rawItems.map(async (item): Promise<ListPreviewItem | null> => {
          try {
            if (item.media_type === "movie") {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const movie = await getMovieSummary(item.tmdb_id) as any;
              return {
                tmdb_id: item.tmdb_id,
                media_type: "movie",
                title: movie.title as string,
                poster_path: (movie.poster_path as string | null) ?? null,
                backdrop_path: (movie.backdrop_path as string | null) ?? null,
                vote_average: (movie.vote_average as number) ?? 0,
                genre_ids: (movie.genre_ids as number[]) ?? [],
              };
            } else {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const show = await getTVShowSummary(item.tmdb_id) as any;
              return {
                tmdb_id: item.tmdb_id,
                media_type: "tv",
                title: show.name as string,
                poster_path: (show.poster_path as string | null) ?? null,
                backdrop_path: (show.backdrop_path as string | null) ?? null,
                vote_average: (show.vote_average as number) ?? 0,
                genre_ids: (show.genre_ids as number[]) ?? [],
              };
            }
          } catch {
            return null;
          }
        })
      );

      const validItems = enriched.filter((i): i is ListPreviewItem => i !== null);
      if (!validItems.length) return null;

      return {
        id: list.id,
        name: list.name,
        icon: list.icon,
        item_count: rawItems.length,
        items: validItems,
      } satisfies ListPreview;
    })
  );

  const result = enrichedLists.filter((l): l is ListPreview => l !== null);
  return NextResponse.json({ lists: result });
}
