import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

const LB_API = "https://api.letterboxd.com/api/v0";
const PER_PAGE = 100;

interface LbLogEntry {
  id: string;
  watchedDate?: string;
  rating?: number; // 0.5–5 sur Letterboxd (×2 pour la stocker sur 10)
  review?: { text: string };
  film: {
    id: string;
    name: string;
    releaseYear?: number;
    links?: { url: string; type: string }[];
  };
}

interface LbLogEntriesResponse {
  items: LbLogEntry[];
  next?: string; // cursor pour la page suivante
}

interface TmdbFindResult {
  movie_results?: { id: number }[];
  tv_results?: { id: number }[];
}

function extractImdbId(links: { url: string; type: string }[]): string | null {
  const imdb = links.find((l) => l.type === "imdb");
  if (!imdb) return null;
  const match = /tt\d+/.exec(imdb.url);
  return match ? match[0] : null;
}

function extractTmdbId(links: { url: string; type: string }[]): number | null {
  const tmdb = links.find((l) => l.type === "tmdb");
  if (!tmdb) return null;
  const match = /\/(\d+)$/.exec(tmdb.url);
  return match ? parseInt(match[1]) : null;
}

async function resolveTmdbId(
  imdbId: string | null,
  title: string,
  year?: number
): Promise<{ tmdbId: number | null; mediaType: string }> {
  const TMDB_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY ?? "";
  const TMDB_BASE = process.env.NEXT_PUBLIC_TMDB_BASE_URL ?? "https://api.themoviedb.org/3";

  if (imdbId) {
    const res = await fetch(
      `${TMDB_BASE}/find/${imdbId}?external_source=imdb_id&api_key=${TMDB_KEY}`
    );
    if (res.ok) {
      const data = (await res.json()) as TmdbFindResult;
      if (data.movie_results?.length) {
        return { tmdbId: data.movie_results[0].id, mediaType: "movie" };
      }
      if (data.tv_results?.length) {
        return { tmdbId: data.tv_results[0].id, mediaType: "tv" };
      }
    }
  }

  // Fallback : recherche par titre
  const query = encodeURIComponent(title);
  const yearParam = year ? `&year=${year}` : "";
  const res = await fetch(
    `${TMDB_BASE}/search/multi?query=${query}${yearParam}&api_key=${TMDB_KEY}&language=fr-FR`
  );
  if (res.ok) {
    const data = (await res.json()) as { results?: { id: number; media_type: string }[] };
    const first = data.results?.[0];
    if (first) return { tmdbId: first.id, mediaType: first.media_type };
  }
  return { tmdbId: null, mediaType: "movie" };
}

export async function POST() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createAdminClient() as any;

  // Récupérer le token Letterboxd
  const { data: profile } = await supabase
    .from("profiles")
    .select("letterboxd_access_token, letterboxd_username")
    .eq("id", user.id)
    .single();

  const token = profile?.letterboxd_access_token as string | null;
  if (!token) return NextResponse.json({ error: "Non connecté à Letterboxd" }, { status: 400 });

  let cursor: string | undefined;
  let totalInserted = 0;

  try {
    // Paginer toutes les entrées du journal
    do {
      const url = new URL(`${LB_API}/log-entries`);
      url.searchParams.set("perPage", String(PER_PAGE));
      url.searchParams.set("where", "HasDiaryDate");
      if (cursor) url.searchParams.set("cursor", cursor);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) break;

      const page = (await res.json()) as LbLogEntriesResponse;
      cursor = page.next;

      if (!page.items?.length) break;

      // Préparer les insertions par batch de 10 pour ne pas surcharger TMDB
      const rows = [];
      for (const entry of page.items) {
        const links = entry.film.links ?? [];
        const imdbId = extractImdbId(links);
        let tmdbId = extractTmdbId(links);
        let mediaType = "movie";

        if (!tmdbId) {
          const resolved = await resolveTmdbId(imdbId, entry.film.name, entry.film.releaseYear);
          tmdbId = resolved.tmdbId;
          mediaType = resolved.mediaType;
        }

        rows.push({
          user_id: user.id,
          source: "letterboxd",
          tmdb_id: tmdbId,
          imdb_id: imdbId,
          media_type: mediaType,
          title: entry.film.name,
          watched_at: entry.watchedDate ? new Date(entry.watchedDate).toISOString() : null,
          user_rating: entry.rating !== undefined ? entry.rating * 2 : null, // 0.5–5 → 1–10
          review: entry.review?.text ?? null,
          raw_data: { lbId: entry.id, year: entry.film.releaseYear },
        });
      }

      // Upsert en batch
      const { error } = await supabase
        .from("external_watch_history")
        .upsert(rows, {
          onConflict: "user_id,source,imdb_id",
          ignoreDuplicates: false,
        });

      if (!error) totalInserted += rows.length;
    } while (cursor);

    return NextResponse.json({ count: totalInserted });
  } catch (err) {
    console.error("Letterboxd import error:", err);
    return NextResponse.json({ error: "Erreur lors de l'import" }, { status: 500 });
  }
}
