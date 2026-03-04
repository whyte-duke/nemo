import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

const TMDB_BASE = process.env.NEXT_PUBLIC_TMDB_BASE_URL ?? "https://api.themoviedb.org/3";
const TMDB_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY ?? "";

interface TMDbMovie {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  first_air_date?: string;
  genre_ids: number[];
  vote_average: number;
  vote_count: number;
  overview: string;
  popularity: number;
  media_type?: string;
}

interface TMDbPage {
  results: TMDbMovie[];
}

type RowRef = { tmdb_id: number | null; media_type: string | null };

async function fetchDiscoverPage(page: number, extraParams: Record<string, string> = {}): Promise<TMDbMovie[]> {
  try {
    const url = new URL(`${TMDB_BASE}/discover/movie`);
    url.searchParams.set("api_key", TMDB_KEY);
    url.searchParams.set("language", "fr-FR");
    url.searchParams.set("sort_by", "popularity.desc");
    url.searchParams.set("vote_count.gte", "100");
    url.searchParams.set("page", String(page));
    for (const [k, v] of Object.entries(extraParams)) {
      url.searchParams.set(k, v);
    }
    const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json() as TMDbPage;
    return (data.results ?? []).map((m) => ({ ...m, media_type: "movie" }));
  } catch {
    return [];
  }
}

async function getExcludedIds(userId: string): Promise<Set<string>> {
  const supabase = createAdminClient();
  const excludedSet = new Set<string>();

  // Films déjà interagis (like, dislike, not_interested)
  const { data: interactions } = await supabase
    .from("interactions")
    .select("tmdb_id, media_type")
    .eq("user_id", userId);

  for (const row of ((interactions as RowRef[] | null) ?? [])) {
    if (row.tmdb_id && row.media_type) {
      excludedSet.add(`${row.tmdb_id}-${row.media_type}`);
    }
  }

  // Films de l'historique de visionnage
  try {
    const { data: watchHistory } = await supabase
      .from("watch_history")
      .select("tmdb_id, media_type")
      .eq("user_id", userId);

    for (const row of ((watchHistory as RowRef[] | null) ?? [])) {
      if (row.tmdb_id && row.media_type) {
        excludedSet.add(`${row.tmdb_id}-${row.media_type}`);
      }
    }
  } catch {
    // La table peut ne pas exister ou avoir une structure différente
  }

  // Imports externes (Letterboxd, Trakt, Netflix)
  try {
    const { data: ext } = await supabase
      .from("external_watch_history")
      .select("tmdb_id, media_type")
      .eq("user_id", userId);

    for (const row of ((ext as RowRef[] | null) ?? [])) {
      if (row.tmdb_id && row.media_type) {
        excludedSet.add(`${row.tmdb_id}-${row.media_type}`);
      }
    }
  } catch {
    // Idem — silencieux
  }

  // Films dans la liste "Suggestions" (swipés ➕) → ne doivent pas réapparaître
  try {
    const { data: suggListItems } = await supabase
      .from("list_items")
      .select("tmdb_id, media_type, list_id, lists!inner(user_id, name)")
      .eq("lists.user_id", userId)
      .eq("lists.name", "Suggestions");

    for (const row of ((suggListItems as RowRef[] | null) ?? [])) {
      if (row.tmdb_id && row.media_type) {
        excludedSet.add(`${row.tmdb_id}-${row.media_type}`);
      }
    }
  } catch {
    // Silencieux — la liste peut ne pas exister encore
  }

  return excludedSet;
}

export async function GET(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const preferredGenres = searchParams
    .get("genres")
    ?.split(",")
    .map(Number)
    .filter((n) => !isNaN(n) && n > 0) ?? [];

  // IDs déjà vus / swipés / dans l'historique → exclus du feed
  const excludedSet = await getExcludedIds(user.id);

  // Construire les paramètres de requête TMDB
  const extraParams: Record<string, string> = {};
  if (preferredGenres.length > 0) {
    // Combiner les genres préférés (films correspondant à AU MOINS UN genre)
    extraParams.with_genres = preferredGenres.slice(0, 3).join("|");
  }

  // Charger 3 pages en parallèle pour avoir suffisamment de candidats
  const pages = await Promise.all([
    fetchDiscoverPage(1, extraParams),
    fetchDiscoverPage(2, extraParams),
    fetchDiscoverPage(3, extraParams),
  ]);

  // Si avec genres on n'a pas assez, compléter avec des films populaires sans filtre
  const candidates = pages.flat().filter((m) => !excludedSet.has(`${m.id}-movie`));

  if (candidates.length < 10) {
    const fallback = await Promise.all([
      fetchDiscoverPage(1),
      fetchDiscoverPage(2),
    ]);
    const fallbackFiltered = fallback.flat().filter((m) => !excludedSet.has(`${m.id}-movie`));
    const seen = new Set(candidates.map((m) => m.id));
    for (const m of fallbackFiltered) {
      if (!seen.has(m.id)) {
        candidates.push(m);
        seen.add(m.id);
      }
    }
  }

  // Prioriser les films du genre préféré, puis par popularité
  if (preferredGenres.length > 0) {
    candidates.sort((a, b) => {
      const aScore = a.genre_ids.filter((g) => preferredGenres.includes(g)).length;
      const bScore = b.genre_ids.filter((g) => preferredGenres.includes(g)).length;
      if (bScore !== aScore) return bScore - aScore;
      return b.popularity - a.popularity;
    });
  }

  // Déduplication finale et limite à 20 cartes
  const seen = new Set<number>();
  const cards = candidates
    .filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    })
    .slice(0, 20);

  return NextResponse.json({ cards });
}
