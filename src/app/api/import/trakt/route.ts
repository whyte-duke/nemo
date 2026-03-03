import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

const TRAKT_API = "https://api.trakt.tv";
const ITEMS_PER_PAGE = 100;
const CLIENT_ID = process.env.TRAKT_CLIENT_ID ?? "";

interface TraktHistoryItem {
  id: number;
  watched_at: string;
  action: string;
  type: "movie" | "episode";
  movie?: {
    title: string;
    year: number;
    ids: { tmdb?: number; imdb?: string; slug?: string };
  };
  show?: {
    title: string;
    year: number;
    ids: { tmdb?: number; imdb?: string };
  };
  episode?: {
    season: number;
    number: number;
    title: string;
  };
}

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

async function fetchTraktHistory(
  token: string,
  type: "movies" | "shows",
  page: number
): Promise<TraktHistoryItem[]> {
  const res = await fetch(
    `${TRAKT_API}/sync/history/${type}?page=${page}&limit=${ITEMS_PER_PAGE}&extended=full`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "trakt-api-version": "2",
        "trakt-api-key": CLIENT_ID,
        "Content-Type": "application/json",
      },
    }
  );
  if (!res.ok) return [];
  return (await res.json()) as TraktHistoryItem[];
}

export async function POST() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  const { data: profile } = await supabase
    .from("profiles")
    .select("trakt_access_token")
    .eq("id", user.id)
    .single();

  const token = profile?.trakt_access_token as string | null;
  if (!token) return NextResponse.json({ error: "Non connecté à Trakt" }, { status: 400 });

  let totalInserted = 0;

  try {
    // Paginer films + séries séparément
    for (const type of ["movies", "shows"] as const) {
      let page = 1;
      let hasMore = true;
      const seenImdbIds = new Set<string>();

      while (hasMore) {
        const items = await fetchTraktHistory(token, type, page);
        if (!items.length) {
          hasMore = false;
          break;
        }

        const rows: ExternalWatchHistoryRow[] = [];
        for (const item of items) {
          const media = item.movie ?? item.show;
          if (!media) continue;

          const tmdbId = media.ids.tmdb ?? null;
          const imdbId = media.ids.imdb ?? null;
          const mediaType = item.movie ? "movie" : "tv";

          // Dédupliquer par IMDB ID (on ne garde qu'un visionnage par titre)
          if (imdbId) {
            if (seenImdbIds.has(imdbId)) continue;
            seenImdbIds.add(imdbId);
          }

          rows.push({
            user_id: user.id,
            source: "trakt",
            tmdb_id: tmdbId,
            imdb_id: imdbId,
            media_type: mediaType,
            title: media.title,
            watched_at: item.watched_at,
            raw_data: {
              traktId: item.id,
              year: media.year,
              action: item.action,
            },
          });
        }

        if (rows.length) {
          const { error } = await supabase
            .from("external_watch_history")
            .upsert(rows, {
              onConflict: "user_id,source,imdb_id",
              ignoreDuplicates: false,
            });
          if (!error) totalInserted += rows.length;
        }

        page++;
        if (items.length < ITEMS_PER_PAGE) hasMore = false;
      }
    }

    return NextResponse.json({ count: totalInserted });
  } catch (err) {
    console.error("Trakt import error:", err);
    return NextResponse.json({ error: "Erreur lors de l'import" }, { status: 500 });
  }
}
