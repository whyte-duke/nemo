import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { discoverMovies } from "@/lib/tmdb/client";
import type { Profile } from "@/types/supabase";
import type { TMDbMovie } from "@/types/tmdb";

type ProfileJellyfinServer = Pick<Profile, "personal_jellyfin_server_id">;

const DEFAULT_MIN_RATING = 7.5;
const MIN_VOTE_COUNT = 300;
const MAX_PAGES_FETCH = 5;
const DEFAULT_LIMIT = 5;

export type FinderSuggestBody = {
  friendIds?: string[];
  genreIds?: number[];
  minRating?: number;
  onlyJellyfin?: boolean;
  limit?: number;
  excludeMovieIds?: number[];
  /** Année de sortie minimale (inclusive). */
  releaseYearFrom?: number;
  /** Année de sortie maximale (inclusive). */
  releaseYearTo?: number;
};

export type FinderSuggestResult = {
  movies: Array<{
    id: number;
    title: string;
    poster_path: string | null;
    backdrop_path: string | null;
    vote_average: number;
    vote_count: number;
    release_date: string;
    overview: string | null;
    inJellyfin?: boolean;
  }>;
};

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  let body: FinderSuggestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps invalide" }, { status: 400 });
  }

  const {
    friendIds = [],
    genreIds = [],
    minRating = DEFAULT_MIN_RATING,
    onlyJellyfin = false,
    limit = DEFAULT_LIMIT,
    excludeMovieIds = [],
    releaseYearFrom,
    releaseYearTo,
  } = body;

  const supabase = createAdminClient();

  // 1) Vérifier que les friendIds sont bien des amis
  const userIds = [user.id, ...friendIds];
  if (friendIds.length > 0) {
    const { data: friendships } = await supabase
      .from("friendships")
      .select("user_id, friend_id")
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

    const friendSet = new Set<string>();
    (friendships ?? []).forEach((f: { user_id: string; friend_id: string }) => {
      const other = f.user_id === user.id ? f.friend_id : f.user_id;
      friendSet.add(other);
    });
    for (const fid of friendIds) {
      if (!friendSet.has(fid)) {
        return NextResponse.json({ error: "Un ou plusieurs amis invalides" }, { status: 400 });
      }
    }
  }

  // 2) Films déjà vus (progress >= 80) pour user + amis
  const { data: watchedRows } = await supabase
    .from("watch_history")
    .select("tmdb_id")
    .in("user_id", userIds)
    .eq("media_type", "movie")
    .gte("progress", 80);

  const excludedIds = new Set<number>([
    ...(watchedRows ?? []).map((r: { tmdb_id: number }) => r.tmdb_id),
    ...excludeMovieIds,
  ]);

  // 3) Optionnel : films dans la bibliothèque Jellyfin du user
  let jellyfinMovieIds: Set<number> | null = null;
  if (onlyJellyfin) {
    const { data } = await supabase
      .from("profiles")
      .select("personal_jellyfin_server_id")
      .eq("id", user.id)
      .single();

    const profile = data as ProfileJellyfinServer | null;
    if (profile?.personal_jellyfin_server_id) {
      const { data: items } = await supabase
        .from("jellyfin_server_items")
        .select("tmdb_id")
        .eq("server_id", profile.personal_jellyfin_server_id)
        .eq("media_type", "movie");
      jellyfinMovieIds = new Set((items ?? []).map((i: { tmdb_id: string }) => parseInt(i.tmdb_id, 10)));
    }
  }

  // 4) Découverte TMDb : plusieurs pages pour avoir assez de candidats
  const params: Record<string, string | number | boolean> = {
    "vote_average.gte": minRating,
    "vote_count.gte": MIN_VOTE_COUNT,
    sort_by: "popularity.desc",
  };
  if (genreIds.length > 0) {
    params.with_genres = genreIds.join(",");
  }
  if (typeof releaseYearFrom === "number" && releaseYearFrom >= 1900) {
    params["primary_release_date.gte"] = `${releaseYearFrom}-01-01`;
  }
  if (typeof releaseYearTo === "number" && releaseYearTo <= 2100) {
    params["primary_release_date.lte"] = `${releaseYearTo}-12-31`;
  }

  const candidates: TMDbMovie[] = [];
  for (let page = 1; page <= MAX_PAGES_FETCH; page++) {
    const res = await discoverMovies(params, page);
    if (!res.results?.length) break;
    candidates.push(...res.results);
    if (candidates.length >= (limit + excludedIds.size) * 2) break; // assez de marge
  }

  // 5) Filtrer : pas déjà vus, pas dans excludeMovieIds, et si onlyJellyfin alors dans Jellyfin
  const filtered: TMDbMovie[] = [];
  for (const m of candidates) {
    if (excludedIds.has(m.id)) continue;
    if (jellyfinMovieIds !== null && !jellyfinMovieIds.has(m.id)) continue;
    filtered.push(m);
    if (filtered.length >= limit) break;
  }

  // 6) Réponse
  const movies = filtered.slice(0, limit).map((m) => ({
    id: m.id,
    title: m.title,
    poster_path: m.poster_path,
    backdrop_path: m.backdrop_path,
    vote_average: m.vote_average,
    vote_count: m.vote_count,
    release_date: m.release_date ?? "",
    overview: m.overview ?? null,
    inJellyfin: onlyJellyfin ? true : undefined,
  }));

  return NextResponse.json({ movies } satisfies FinderSuggestResult);
}
