import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { createRawAdminClient as createAdminClient } from "@/lib/supabase/admin";
import { getMovieSummary, getTVShowSummary } from "@/lib/tmdb/client";
import type { ListItem } from "@/types/supabase";

const MY_LIST_NAME = "Ma Liste";

export type MyListItem = ListItem & { title: string; poster_path: string | null };

async function enrichItem(item: ListItem): Promise<MyListItem> {
  try {
    if (item.media_type === "movie") {
      const movie = await getMovieSummary(item.tmdb_id);
      return { ...item, title: movie.title, poster_path: movie.poster_path };
    }
    const show = await getTVShowSummary(item.tmdb_id);
    return { ...item, title: show.name, poster_path: show.poster_path };
  } catch {
    return {
      ...item,
      title: item.media_type === "movie" ? `Film #${item.tmdb_id}` : `Série #${item.tmdb_id}`,
      poster_path: null,
    };
  }
}

async function getOrCreateDefaultList(userId: string): Promise<string> {
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("lists")
    .select("id")
    .eq("user_id", userId)
    .eq("name", MY_LIST_NAME)
    .maybeSingle();

  if (existing) return (existing as { id: string }).id;

  const { data: newList, error } = await supabase
    .from("lists")
    .insert({ user_id: userId, name: MY_LIST_NAME, is_default: true, icon: "🎬", is_public: false })
    .select("id")
    .single();

  if (error || !newList) throw new Error(error?.message ?? "Erreur création liste");
  return (newList as { id: string }).id;
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const supabase = createAdminClient();

  const { data: listData } = await supabase
    .from("lists")
    .select("id")
    .eq("user_id", user.id)
    .eq("name", MY_LIST_NAME)
    .maybeSingle();

  if (!listData) return NextResponse.json([] as MyListItem[]);

  const { data: items, error } = await supabase
    .from("list_items")
    .select("*")
    .eq("list_id", (listData as { id: string }).id)
    .order("added_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const enriched = await Promise.all(((items ?? []) as ListItem[]).map(enrichItem));
  return NextResponse.json(enriched);
}

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  let body: { tmdbId: number; mediaType: "movie" | "tv"; action: "add" | "remove" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const { tmdbId, mediaType, action } = body;
  if (typeof tmdbId !== "number" || !mediaType || !action) {
    return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const listId = await getOrCreateDefaultList(user.id);

  if (action === "add") {
    const { error } = await supabase.from("list_items").insert({
      list_id: listId,
      tmdb_id: tmdbId,
      media_type: mediaType,
    });
    if (error && error.code !== "23505") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    const { error } = await supabase
      .from("list_items")
      .delete()
      .eq("list_id", listId)
      .eq("tmdb_id", tmdbId)
      .eq("media_type", mediaType);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
