import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { createRawAdminClient as createAdminClient } from "@/lib/supabase/admin";
import { getMovieSummary, getTVShowSummary } from "@/lib/tmdb/client";
import type { ActivityEvent } from "@/types/supabase";

type MediaInfo = { tmdb_id: number; title: string; poster_path: string | null; media_type: "movie" | "tv" };

async function fetchMediaInfo(tmdbId: number, mediaType: "movie" | "tv"): Promise<MediaInfo> {
  try {
    if (mediaType === "movie") {
      const m = await getMovieSummary(tmdbId);
      return { tmdb_id: tmdbId, title: m.title, poster_path: m.poster_path, media_type: "movie" };
    }
    const t = await getTVShowSummary(tmdbId);
    return { tmdb_id: tmdbId, title: t.name, poster_path: t.poster_path, media_type: "tv" };
  } catch {
    return { tmdb_id: tmdbId, title: `#${tmdbId}`, poster_path: null, media_type: mediaType };
  }
}

export async function GET(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type"); // "watched" | "liked" | "added_to_list" | null (all)
  const cursor = searchParams.get("cursor"); // ISO date for pagination
  const limit = 30;

  const supabase = createAdminClient();

  // Récupère les IDs des amis
  const { data: friendships } = await supabase
    .from("friendships")
    .select("user_id, friend_id")
    .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

  const friendIds = (friendships ?? []).map((f) =>
    f.user_id === user.id ? f.friend_id : f.user_id
  );

  if (friendIds.length === 0) return NextResponse.json({ events: [], hasMore: false });

  // Profils des amis
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, role")
    .in("id", friendIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const cursorDate = cursor ? new Date(cursor) : new Date();
  const rawEvents: Array<{ type: ActivityEvent["type"]; user_id: string; tmdb_id?: number; media_type?: string; list_id?: string; timestamp: string }> = [];

  // Historique de visionnage (progress >= 80%)
  if (!type || type === "watched") {
    const { data: watchHistory } = await supabase
      .from("watch_history")
      .select("user_id, tmdb_id, media_type, last_watched_at")
      .in("user_id", friendIds)
      .gte("progress", 80)
      .lt("last_watched_at", cursorDate.toISOString())
      .order("last_watched_at", { ascending: false })
      .limit(limit);

    (watchHistory ?? []).forEach((w: { user_id: string; tmdb_id: number; media_type: string; last_watched_at: string }) => {
      rawEvents.push({ type: "watched", user_id: w.user_id, tmdb_id: w.tmdb_id, media_type: w.media_type, timestamp: w.last_watched_at });
    });
  }

  // Likes et dislikes
  if (!type || type === "liked") {
    const { data: interactions } = await supabase
      .from("interactions")
      .select("user_id, tmdb_id, media_type, type, created_at")
      .in("user_id", friendIds)
      .lt("created_at", cursorDate.toISOString())
      .order("created_at", { ascending: false })
      .limit(limit);

    (interactions ?? []).forEach((i: { user_id: string; tmdb_id: number; media_type: string; type: string; created_at: string }) => {
      rawEvents.push({
        type: i.type === "like" ? "liked" : "disliked",
        user_id: i.user_id,
        tmdb_id: i.tmdb_id,
        media_type: i.media_type,
        timestamp: i.created_at,
      });
    });
  }

  // Ajouts à une liste
  if (!type || type === "added_to_list") {
    const { data: listItems } = await supabase
      .from("list_items")
      .select("list_id, tmdb_id, media_type, added_at, list:lists(user_id, name, icon)")
      .in("lists.user_id", friendIds)
      .lt("added_at", cursorDate.toISOString())
      .order("added_at", { ascending: false })
      .limit(limit);

    type ListItemRow = { list_id: string; tmdb_id: number; media_type: string; added_at: string; list: { user_id: string; name: string; icon: string | null } | Array<{ user_id: string; name: string; icon: string | null }> | null };
    ((listItems ?? []) as unknown as ListItemRow[]).forEach((li) => {
      const listObj = Array.isArray(li.list) ? li.list[0] : li.list;
      if (listObj?.user_id && friendIds.includes(listObj.user_id)) {
        rawEvents.push({
          type: "added_to_list",
          user_id: listObj.user_id,
          tmdb_id: li.tmdb_id,
          media_type: li.media_type,
          list_id: li.list_id,
          timestamp: li.added_at,
        });
      }
    });
  }

  // Tri global par timestamp
  rawEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const page = rawEvents.slice(0, limit);
  const hasMore = rawEvents.length > limit;

  // Enrichit avec les données TMDB (en parallèle, avec cache implicite Next.js)
  const mediaCache = new Map<string, MediaInfo>();
  await Promise.allSettled(
    page
      .filter((e) => e.tmdb_id && e.media_type)
      .map(async (e) => {
        const key = `${e.tmdb_id}-${e.media_type}`;
        if (!mediaCache.has(key)) {
          const info = await fetchMediaInfo(e.tmdb_id!, e.media_type as "movie" | "tv");
          mediaCache.set(key, info);
        }
      })
  );

  // Données des listes pour les événements added_to_list
  const listIds = page.filter((e) => e.list_id).map((e) => e.list_id!);
  const listInfoMap = new Map<string, { id: string; name: string; icon: string | null }>();
  if (listIds.length > 0) {
    const { data: listsData } = await supabase
      .from("lists")
      .select("id, name, icon")
      .in("id", listIds);
    (listsData ?? []).forEach((l: { id: string; name: string; icon: string | null }) => {
      listInfoMap.set(l.id, l);
    });
  }

  const events: ActivityEvent[] = page.map((e) => {
    const profile = profileMap.get(e.user_id);
    const media = e.tmdb_id ? mediaCache.get(`${e.tmdb_id}-${e.media_type}`) : undefined;
    const list = e.list_id ? listInfoMap.get(e.list_id) : undefined;

    return {
      type: e.type,
      user: {
        id: e.user_id,
        display_name: profile?.display_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
        role: profile?.role ?? "free",
      },
      media,
      list,
      timestamp: e.timestamp,
    };
  });

  return NextResponse.json({ events, hasMore });
}
