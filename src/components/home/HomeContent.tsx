"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { HeroCinematic } from "@/components/hero/HeroCinematic";
import { MediaRow } from "@/components/media/MediaRow";
import { DetailModal } from "@/components/media/DetailModal";
import { MovieWatchModal } from "@/components/player/MovieWatchModal";
import { StreamModal } from "@/components/player/StreamModal";
import { VideoPlayer } from "@/components/player/VideoPlayer";
import {
  useTrending,
  useNowPlayingMovies,
  usePopularMovies,
  useTopRatedMovies,
  usePopularTV,
  useTopRatedTV,
  useOnAirTV,
  useDiscoverMovies,
  useDiscoverTV,
  useMovieDetail,
  useTVShowDetail,
} from "@/hooks/use-tmdb";
import { useStream } from "@/providers/stream-provider";
import { useProfile } from "@/hooks/use-profile";
import { useQuery } from "@tanstack/react-query";
import { PersonalizedRow } from "@/components/home/PersonalizedRow";
import { UserListRows } from "@/components/home/UserListRows";
import { Play, Loader2, RotateCcw, Eye, EyeOff } from "lucide-react";
import { JellyfinIcon } from "@/components/icons/JellyfinIcon";
import { cn } from "@/lib/utils";
import type { TMDbMovieDetail, TMDbTVShowDetail } from "@/types/tmdb";
import type { JellyfinBaseItem } from "@/types/jellyfin";
import type { ScoredItem } from "@/lib/recommendations/scorer";

type DetailMedia = TMDbMovieDetail | TMDbTVShowDetail;
type MediaItem = { id: number; title?: string; name?: string; imdb_id?: string | null };

// ─── Types ───────────────────────────────────────────────────────────────────

type SectionSource =
  | "trending-all-day"
  | "trending-all-week"
  | "nowplaying"
  | "popular-movies"
  | "toprated-movies"
  | "popular-tv"
  | "toprated-tv"
  | "onair"
  | "discover-movie"
  | "discover-tv";

type SectionConfig = {
  id: string;
  title: string;
  badge?: string;
  showTopNumber?: boolean;
  viewAllHref?: string;
  source: SectionSource;
  params?: Record<string, string | number | boolean>;
};

type RowCallbacks = {
  onPlay: (item: MediaItem, type: "movie" | "tv") => void;
  onMoreInfo: (item: MediaItem, type: "movie" | "tv") => void;
  hideIfSeen?: boolean;
};

// ─── Pool principal ───────────────────────────────────────────────────────────

const HOME_POOL: SectionConfig[] = [
  // ── Incontournables ────────────────────────────────────────────────────────
  { id: "tr-day",       source: "trending-all-day",   title: "Tendances aujourd'hui" },
  { id: "tr-week",      source: "trending-all-week",  title: "Tendances cette semaine" },
  { id: "nowplaying",   source: "nowplaying",          title: "En ce moment en salles", badge: "Live" },
  { id: "pop-tv",       source: "popular-tv",          title: "Séries du moment" },
  { id: "top-m",        source: "toprated-movies",     title: "Films les mieux notés", showTopNumber: true },
  { id: "top-tv",       source: "toprated-tv",         title: "Séries les mieux notées", showTopNumber: true },
  { id: "onair",        source: "onair",               title: "Séries actuellement diffusées", badge: "Live" },
  { id: "pop-m",        source: "popular-movies",      title: "Les plus populaires" },

  // ── Genres Films ───────────────────────────────────────────────────────────
  { id: "action",       source: "discover-movie", title: "Action & Aventure",           params: { with_genres: "28",    sort_by: "popularity.desc" } },
  { id: "scifi-m",      source: "discover-movie", title: "Science-Fiction",              params: { with_genres: "878",   sort_by: "popularity.desc" } },
  { id: "thriller",     source: "discover-movie", title: "Thriller & Suspense",          params: { with_genres: "53",    sort_by: "vote_average.desc", "vote_count.gte": 500 } },
  { id: "anim-m",       source: "discover-movie", title: "Mondes animés",                params: { with_genres: "16",    sort_by: "popularity.desc" } },
  { id: "horror",       source: "discover-movie", title: "Horreur & Épouvante",          params: { with_genres: "27",    sort_by: "popularity.desc" } },
  { id: "comedy-m",     source: "discover-movie", title: "Comédies",                     params: { with_genres: "35",    sort_by: "popularity.desc" } },
  { id: "drama-m",      source: "discover-movie", title: "Drames",                       params: { with_genres: "18",    sort_by: "vote_average.desc", "vote_count.gte": 300 } },
  { id: "romance-m",    source: "discover-movie", title: "Romance & Amour",              params: { with_genres: "10749", sort_by: "popularity.desc" } },
  { id: "fantasy-m",    source: "discover-movie", title: "Fantaisie & Magie",            params: { with_genres: "14",    sort_by: "popularity.desc" } },
  { id: "family-m",     source: "discover-movie", title: "En famille",                   params: { with_genres: "10751", sort_by: "popularity.desc" } },
  { id: "doc-m",        source: "discover-movie", title: "Documentaires",                params: { with_genres: "99",    sort_by: "vote_average.desc", "vote_count.gte": 200 } },
  { id: "war-m",        source: "discover-movie", title: "Films de Guerre",              params: { with_genres: "10752", sort_by: "vote_average.desc", "vote_count.gte": 300 } },
  { id: "western-m",    source: "discover-movie", title: "Westerns",                     params: { with_genres: "37",    sort_by: "vote_average.desc", "vote_count.gte": 200 } },
  { id: "history-m",    source: "discover-movie", title: "Films Historiques",            params: { with_genres: "36",    sort_by: "vote_average.desc", "vote_count.gte": 300 } },
  { id: "music-m",      source: "discover-movie", title: "Musique & Concerts",           params: { with_genres: "10402", sort_by: "popularity.desc" } },
  { id: "mystery-m",    source: "discover-movie", title: "Mystère & Enquête",            params: { with_genres: "9648",  sort_by: "popularity.desc" } },
  { id: "superhero-m",  source: "discover-movie", title: "Super-Héros",                  params: { with_keywords: "superhero", sort_by: "popularity.desc" } },

  // ── Décennies Films ────────────────────────────────────────────────────────
  { id: "2020s",        source: "discover-movie", title: "Cinéma 2020s",                 params: { "primary_release_date.gte": "2020-01-01", sort_by: "vote_average.desc", "vote_count.gte": 300 } },
  { id: "2010s",        source: "discover-movie", title: "La décennie 2010",             params: { "primary_release_date.gte": "2010-01-01", "primary_release_date.lte": "2019-12-31", sort_by: "vote_average.desc", "vote_count.gte": 500 } },
  { id: "2000s",        source: "discover-movie", title: "La décennie 2000",             params: { "primary_release_date.gte": "2000-01-01", "primary_release_date.lte": "2009-12-31", sort_by: "vote_average.desc", "vote_count.gte": 500 } },
  { id: "90s",          source: "discover-movie", title: "Classiques des années 90",     params: { "primary_release_date.gte": "1990-01-01", "primary_release_date.lte": "1999-12-31", sort_by: "vote_average.desc", "vote_count.gte": 500 } },
  { id: "80s",          source: "discover-movie", title: "L'esprit des années 80",       params: { "primary_release_date.gte": "1980-01-01", "primary_release_date.lte": "1989-12-31", sort_by: "vote_average.desc", "vote_count.gte": 300 } },
  { id: "70s",          source: "discover-movie", title: "Cinéma des années 70",         params: { "primary_release_date.gte": "1970-01-01", "primary_release_date.lte": "1979-12-31", sort_by: "vote_average.desc", "vote_count.gte": 300 } },
  { id: "master",       source: "discover-movie", title: "Chef-d'œuvres ★8+", showTopNumber: true, params: { "vote_average.gte": 8.0, "vote_count.gte": 2000, sort_by: "vote_average.desc" } },

  // ── Cinémas du Monde ───────────────────────────────────────────────────────
  { id: "french-m",     source: "discover-movie", title: "Cinéma Français",              params: { with_original_language: "fr", sort_by: "popularity.desc" } },
  { id: "korean-m",     source: "discover-movie", title: "Cinéma Coréen",                params: { with_original_language: "ko", sort_by: "popularity.desc" } },
  { id: "japanese-m",   source: "discover-movie", title: "Cinéma Japonais",              params: { with_original_language: "ja", sort_by: "popularity.desc" } },
  { id: "spanish-m",    source: "discover-movie", title: "Cinéma Espagnol & Latino",     params: { with_original_language: "es", sort_by: "popularity.desc" } },
  { id: "italian-m",    source: "discover-movie", title: "Cinéma Italien",               params: { with_original_language: "it", sort_by: "vote_average.desc", "vote_count.gte": 200 } },
  { id: "german-m",     source: "discover-movie", title: "Cinéma Allemand",              params: { with_original_language: "de", sort_by: "popularity.desc" } },
  { id: "british-m",    source: "discover-movie", title: "Cinéma Britannique",           params: { with_original_language: "en", with_origin_country: "GB", sort_by: "popularity.desc" } },
  { id: "hindi-m",      source: "discover-movie", title: "Bollywood",                    params: { with_original_language: "hi", sort_by: "popularity.desc" } },

  // ── Genres Séries ──────────────────────────────────────────────────────────
  { id: "crime-tv",     source: "discover-tv",    title: "Séries Crime & Policier",      params: { with_genres: "80",    sort_by: "popularity.desc" } },
  { id: "drama-tv",     source: "discover-tv",    title: "Grands Drames TV",             params: { with_genres: "18",    sort_by: "vote_average.desc", "vote_count.gte": 500 } },
  { id: "scifi-tv",     source: "discover-tv",    title: "Sci-Fi & Fantasy",             params: { with_genres: "10765", sort_by: "popularity.desc" } },
  { id: "mystery-tv",   source: "discover-tv",    title: "Mystère & Thriller",           params: { with_genres: "9648",  sort_by: "popularity.desc" } },
  { id: "comedy-tv",    source: "discover-tv",    title: "Comédies du moment",           params: { with_genres: "35",    sort_by: "popularity.desc" } },
  { id: "anim-tv",      source: "discover-tv",    title: "Séries Animées",               params: { with_genres: "16",    sort_by: "popularity.desc" } },
  { id: "action-tv",    source: "discover-tv",    title: "Séries Action & Aventure",     params: { with_genres: "10759", sort_by: "popularity.desc" } },
  { id: "doc-tv",       source: "discover-tv",    title: "Documentaires & Reportages",   params: { with_genres: "99",    sort_by: "vote_average.desc", "vote_count.gte": 100 } },
  { id: "family-tv",    source: "discover-tv",    title: "Séries Familiales",            params: { with_genres: "10751", sort_by: "popularity.desc" } },
  { id: "war-tv",       source: "discover-tv",    title: "Guerre & Politique",           params: { with_genres: "10768", sort_by: "vote_average.desc", "vote_count.gte": 200 } },
  { id: "romance-tv",   source: "discover-tv",    title: "Séries Romantiques",           params: { with_genres: "10749", sort_by: "popularity.desc" } },
  { id: "history-tv",   source: "discover-tv",    title: "Séries Historiques",           params: { with_genres: "36",    sort_by: "vote_average.desc", "vote_count.gte": 100 } },
  { id: "western-tv",   source: "discover-tv",    title: "Westerns & Néo-westerns",      params: { with_genres: "37",    sort_by: "popularity.desc" } },
  { id: "kids-tv",      source: "discover-tv",    title: "Pour les enfants",             params: { with_genres: "10762", sort_by: "popularity.desc" } },

  // ── Séries du Monde ────────────────────────────────────────────────────────
  { id: "kdrama",       source: "discover-tv",    title: "K-Drama",                      params: { with_original_language: "ko", sort_by: "popularity.desc" } },
  { id: "anime-tv",     source: "discover-tv",    title: "Anime",                        params: { with_original_language: "ja", with_genres: "16", sort_by: "popularity.desc" } },
  { id: "british-tv",   source: "discover-tv",    title: "Séries Britanniques",          params: { with_original_language: "en", with_origin_country: "GB", sort_by: "popularity.desc" } },
  { id: "spanish-tv",   source: "discover-tv",    title: "Séries Espagnoles",            params: { with_original_language: "es", sort_by: "popularity.desc" } },
  { id: "french-tv",    source: "discover-tv",    title: "Séries Françaises",            params: { with_original_language: "fr", sort_by: "popularity.desc" } },
  { id: "nordic-tv",    source: "discover-tv",    title: "Séries Nordiques",             params: { with_origin_country: "SE,DK,NO,FI", sort_by: "vote_average.desc", "vote_count.gte": 100 } },
  { id: "turkish-tv",   source: "discover-tv",    title: "Séries Turques",               params: { with_original_language: "tr", sort_by: "popularity.desc" } },

  // ── Plateformes ────────────────────────────────────────────────────────────
  { id: "netflix-m",    source: "discover-movie", title: "Netflix — Films",      badge: "N",  params: { with_watch_providers: "8",    watch_region: "FR", sort_by: "popularity.desc" }, viewAllHref: "/hub/netflix" },
  { id: "netflix-tv",   source: "discover-tv",    title: "Netflix — Séries",     badge: "N",  params: { with_watch_providers: "8",    watch_region: "FR", sort_by: "popularity.desc" }, viewAllHref: "/hub/netflix" },
  { id: "disney-m",     source: "discover-movie", title: "Disney+",              badge: "D+", params: { with_watch_providers: "337",  watch_region: "FR", sort_by: "popularity.desc" }, viewAllHref: "/hub/disney+" },
  { id: "hbo-tv",       source: "discover-tv",    title: "Max — HBO",            badge: "M",  params: { with_watch_providers: "1899", watch_region: "FR", sort_by: "popularity.desc" }, viewAllHref: "/hub/max" },
  { id: "canal-tv",     source: "discover-tv",    title: "Canal+",               badge: "C+", params: { with_watch_providers: "381",  watch_region: "FR", sort_by: "popularity.desc" }, viewAllHref: "/hub/canal-plus" },
  { id: "amazon-m",     source: "discover-movie", title: "Amazon Prime Video",   badge: "P",  params: { with_watch_providers: "119",  watch_region: "FR", sort_by: "popularity.desc" } },
  { id: "appletv-tv",   source: "discover-tv",    title: "Apple TV+",            badge: "A",  params: { with_watch_providers: "350",  watch_region: "FR", sort_by: "popularity.desc" }, viewAllHref: "/hub/apple-tv" },
  { id: "param-tv",     source: "discover-tv",    title: "Paramount+",           badge: "P+", params: { with_watch_providers: "531",  watch_region: "FR", sort_by: "popularity.desc" } },
  { id: "crunchyroll",  source: "discover-tv",    title: "Crunchyroll — Anime",  badge: "CR", params: { with_watch_providers: "283",  watch_region: "FR", sort_by: "popularity.desc" } },
];

// ─── Génération dynamique de sections supplémentaires ─────────────────────────
// Lorsque l'utilisateur a tout parcouru, on génère de nouvelles rangées
// en variant la page TMDB des catégories "discover" les plus riches.

const INFINITE_TEMPLATES: Array<Omit<SectionConfig, "id"> & { titleSuffix?: string }> = [
  { source: "discover-movie", title: "Action & Adrénaline",       params: { with_genres: "28",    sort_by: "popularity.desc" } },
  { source: "discover-movie", title: "Science-Fiction",            params: { with_genres: "878",   sort_by: "popularity.desc" } },
  { source: "discover-movie", title: "Horreur & Frissons",         params: { with_genres: "27",    sort_by: "popularity.desc" } },
  { source: "discover-movie", title: "Thriller Psychologique",     params: { with_genres: "53",    sort_by: "vote_average.desc", "vote_count.gte": 300 } },
  { source: "discover-movie", title: "Drames Incontournables",     params: { with_genres: "18",    sort_by: "vote_average.desc", "vote_count.gte": 400 } },
  { source: "discover-movie", title: "Comédies",                   params: { with_genres: "35",    sort_by: "popularity.desc" } },
  { source: "discover-movie", title: "Aventure & Exploration",     params: { with_genres: "12",    sort_by: "popularity.desc" } },
  { source: "discover-movie", title: "Fantaisie",                  params: { with_genres: "14",    sort_by: "popularity.desc" } },
  { source: "discover-tv",    title: "Séries Thriller",            params: { with_genres: "9648",  sort_by: "popularity.desc" } },
  { source: "discover-tv",    title: "K-Drama",                    params: { with_original_language: "ko", sort_by: "popularity.desc" } },
  { source: "discover-tv",    title: "Anime",                      params: { with_original_language: "ja", with_genres: "16", sort_by: "popularity.desc" } },
  { source: "discover-tv",    title: "Séries Crime",               params: { with_genres: "80",    sort_by: "popularity.desc" } },
  { source: "discover-tv",    title: "Science-Fiction TV",         params: { with_genres: "10765", sort_by: "popularity.desc" } },
  { source: "discover-tv",    title: "Drames TV",                  params: { with_genres: "18",    sort_by: "vote_average.desc", "vote_count.gte": 300 } },
];

let _genCounter = 0;

function generateMoreSections(count: number): SectionConfig[] {
  const sections: SectionConfig[] = [];
  for (let i = 0; i < count; i++) {
    const template = INFINITE_TEMPLATES[(_genCounter + i) % INFINITE_TEMPLATES.length];
    const page = Math.floor((_genCounter + i) / INFINITE_TEMPLATES.length) + 2; // page 2, 3, 4...
    _genCounter++;
    sections.push({
      ...template,
      id: `gen-${_genCounter}-${i}`,
      params: { ...(template.params ?? {}), page },
    });
  }
  return sections;
}

function shuffleCopy<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

// ─── Composants de rangée (hooks au niveau composant, inchangés) ──────────────

function TrendingAllDayRow({ config, onPlay, onMoreInfo, hideIfSeen }: { config: SectionConfig } & RowCallbacks) {
  const { data, isLoading } = useTrending("all", "day");
  return (
    <MediaRow title={config.title} badge={config.badge} items={data?.results ?? []} mediaType="movie" isLoading={isLoading} hideIfSeen={hideIfSeen}
      onPlay={(item) => { const m = item as MediaItem & { first_air_date?: string }; onPlay(m, m.first_air_date ? "tv" : "movie"); }}
      onMoreInfo={(item) => { const m = item as MediaItem & { first_air_date?: string }; onMoreInfo(m, m.first_air_date ? "tv" : "movie"); }} />
  );
}

function TrendingAllWeekRow({ config, onPlay, onMoreInfo, hideIfSeen }: { config: SectionConfig } & RowCallbacks) {
  const { data, isLoading } = useTrending("all", "week");
  return (
    <MediaRow title={config.title} badge={config.badge} items={data?.results ?? []} mediaType="movie" isLoading={isLoading} hideIfSeen={hideIfSeen}
      onPlay={(item) => { const m = item as MediaItem & { first_air_date?: string }; onPlay(m, m.first_air_date ? "tv" : "movie"); }}
      onMoreInfo={(item) => { const m = item as MediaItem & { first_air_date?: string }; onMoreInfo(m, m.first_air_date ? "tv" : "movie"); }} />
  );
}

function NowPlayingRow({ config, onPlay, onMoreInfo, hideIfSeen }: { config: SectionConfig } & RowCallbacks) {
  const { data, isLoading } = useNowPlayingMovies();
  return (
    <MediaRow title={config.title} badge={config.badge} items={data?.results ?? []} mediaType="movie" isLoading={isLoading} hideIfSeen={hideIfSeen}
      onPlay={(item) => onPlay(item as MediaItem, "movie")} onMoreInfo={(item) => onMoreInfo(item as MediaItem, "movie")} />
  );
}

function PopularMoviesRow({ config, onPlay, onMoreInfo, hideIfSeen }: { config: SectionConfig } & RowCallbacks) {
  const { data, isLoading } = usePopularMovies();
  return (
    <MediaRow title={config.title} items={data?.results ?? []} mediaType="movie" isLoading={isLoading} hideIfSeen={hideIfSeen}
      onPlay={(item) => onPlay(item as MediaItem, "movie")} onMoreInfo={(item) => onMoreInfo(item as MediaItem, "movie")} showTopNumber={config.showTopNumber} />
  );
}

function TopRatedMoviesRow({ config, onPlay, onMoreInfo, hideIfSeen }: { config: SectionConfig } & RowCallbacks) {
  const { data, isLoading } = useTopRatedMovies();
  return (
    <MediaRow title={config.title} items={data?.results ?? []} mediaType="movie" isLoading={isLoading} hideIfSeen={hideIfSeen}
      onPlay={(item) => onPlay(item as MediaItem, "movie")} onMoreInfo={(item) => onMoreInfo(item as MediaItem, "movie")} showTopNumber={config.showTopNumber} />
  );
}

function PopularTVRow({ config, onPlay, onMoreInfo, hideIfSeen }: { config: SectionConfig } & RowCallbacks) {
  const { data, isLoading } = usePopularTV();
  return (
    <MediaRow title={config.title} items={data?.results ?? []} mediaType="tv" isLoading={isLoading} hideIfSeen={hideIfSeen}
      onPlay={(item) => onPlay(item as MediaItem, "tv")} onMoreInfo={(item) => onMoreInfo(item as MediaItem, "tv")} />
  );
}

function TopRatedTVRow({ config, onPlay, onMoreInfo, hideIfSeen }: { config: SectionConfig } & RowCallbacks) {
  const { data, isLoading } = useTopRatedTV();
  return (
    <MediaRow title={config.title} items={data?.results ?? []} mediaType="tv" isLoading={isLoading} hideIfSeen={hideIfSeen}
      onPlay={(item) => onPlay(item as MediaItem, "tv")} onMoreInfo={(item) => onMoreInfo(item as MediaItem, "tv")} showTopNumber={config.showTopNumber} />
  );
}

function OnAirRow({ config, onPlay, onMoreInfo, hideIfSeen }: { config: SectionConfig } & RowCallbacks) {
  const { data, isLoading } = useOnAirTV();
  return (
    <MediaRow title={config.title} badge={config.badge} items={data?.results ?? []} mediaType="tv" isLoading={isLoading} hideIfSeen={hideIfSeen}
      onPlay={(item) => onPlay(item as MediaItem, "tv")} onMoreInfo={(item) => onMoreInfo(item as MediaItem, "tv")} />
  );
}

function DiscoverMovieRow({ config, onPlay, onMoreInfo, hideIfSeen }: { config: SectionConfig } & RowCallbacks) {
  const [page] = useState(() => (config.params?.page as number | undefined) ?? Math.floor(Math.random() * 4) + 1);
  const params = { ...config.params };
  delete params.page;
  const { data, isLoading } = useDiscoverMovies(params ?? {}, page);
  const providerSlug = config.viewAllHref?.replace(/^\/hub\//, "");
  return (
    <MediaRow title={config.title} badge={config.badge} viewAllHref={config.viewAllHref} showTopNumber={config.showTopNumber} providerSlug={providerSlug}
      items={data?.results ?? []} mediaType="movie" isLoading={isLoading} hideIfSeen={hideIfSeen}
      onPlay={(item) => onPlay(item as MediaItem, "movie")} onMoreInfo={(item) => onMoreInfo(item as MediaItem, "movie")} />
  );
}

function DiscoverTVRow({ config, onPlay, onMoreInfo, hideIfSeen }: { config: SectionConfig } & RowCallbacks) {
  const [page] = useState(() => (config.params?.page as number | undefined) ?? Math.floor(Math.random() * 4) + 1);
  const params = { ...config.params };
  delete params.page;
  const { data, isLoading } = useDiscoverTV(params ?? {}, page);
  const providerSlug = config.viewAllHref?.replace(/^\/hub\//, "");
  return (
    <MediaRow title={config.title} badge={config.badge} viewAllHref={config.viewAllHref} showTopNumber={config.showTopNumber} providerSlug={providerSlug}
      items={data?.results ?? []} mediaType="tv" isLoading={isLoading} hideIfSeen={hideIfSeen}
      onPlay={(item) => onPlay(item as MediaItem, "tv")} onMoreInfo={(item) => onMoreInfo(item as MediaItem, "tv")} />
  );
}

function SectionRow({ config, onPlay, onMoreInfo, hideIfSeen }: { config: SectionConfig } & RowCallbacks) {
  const props = { config, onPlay, onMoreInfo, hideIfSeen };
  switch (config.source) {
    case "trending-all-day":   return <TrendingAllDayRow {...props} />;
    case "trending-all-week":  return <TrendingAllWeekRow {...props} />;
    case "nowplaying":         return <NowPlayingRow {...props} />;
    case "popular-movies":     return <PopularMoviesRow {...props} />;
    case "toprated-movies":    return <TopRatedMoviesRow {...props} />;
    case "popular-tv":         return <PopularTVRow {...props} />;
    case "toprated-tv":        return <TopRatedTVRow {...props} />;
    case "onair":              return <OnAirRow {...props} />;
    case "discover-movie":     return <DiscoverMovieRow {...props} />;
    case "discover-tv":        return <DiscoverTVRow {...props} />;
  }
}

// ─── Jellyfin — Continue Watching ────────────────────────────────────────────

interface JellyfinResumeData {
  Items: JellyfinBaseItem[];
  serverUrl: string;
}

function JellyfinCard({
  item,
  serverUrl,
  isPlaying,
  onClick,
}: {
  item: JellyfinBaseItem;
  serverUrl: string;
  isPlaying: boolean;
  onClick: () => void;
}) {
  const progress =
    item.UserData?.PlayedPercentage ??
    (item.UserData?.PlaybackPositionTicks && item.RunTimeTicks
      ? (item.UserData.PlaybackPositionTicks / item.RunTimeTicks) * 100
      : 0);

  // Image : Primary sur l'item, sinon backdrop de la série parente
  const imgId = item.ImageTags?.Primary
    ? item.Id
    : item.ParentThumbItemId ?? item.SeriesId ?? item.Id;
  const imgTag = item.ImageTags?.Primary
    ? item.ImageTags.Primary
    : item.ParentThumbImageTag ?? undefined;
  const imgUrl = imgTag
    ? `${serverUrl}/Items/${imgId}/Images/${item.ImageTags?.Primary ? "Primary" : "Thumb"}?fillWidth=400&quality=90&tag=${imgTag}`
    : `${serverUrl}/Items/${imgId}/Images/Primary?fillWidth=400&quality=90`;

  const isEpisode = item.Type === "Episode";
  const label = isEpisode
    ? `${item.SeriesName ?? ""} — S${item.ParentIndexNumber ?? 1}:E${item.IndexNumber ?? 1}`
    : item.Name;

  return (
    <button
      onClick={onClick}
      className="group relative shrink-0 w-44 sm:w-52 rounded-xl overflow-hidden bg-white/5 border border-white/8 hover:border-white/20 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00a4dc]"
    >
      {/* Image */}
      <div className="relative aspect-video w-full overflow-hidden">
        <img
          src={imgUrl}
          alt={item.Name}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        {/* Overlay foncé */}
        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent" />

        {/* Bouton play centré */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center justify-center size-11 rounded-full bg-white/20 backdrop-blur-sm border border-white/30">
            {isPlaying ? (
              <Loader2 className="size-5 text-white animate-spin" />
            ) : (
              <Play className="size-5 fill-white text-white" />
            )}
          </div>
        </div>
      </div>

      {/* Barre de progression */}
      {progress > 0 && (
        <div className="absolute bottom-7 left-0 right-0 h-0.5 bg-white/20">
          <div
            className="h-full bg-[#00a4dc] transition-all"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}

      {/* Titre */}
      <div className="px-2.5 py-2 text-left">
        <p className="text-white text-xs font-medium leading-tight truncate">{item.Name}</p>
        {isEpisode && (
          <p className="text-white/40 text-[11px] truncate mt-0.5">{label}</p>
        )}
      </div>
    </button>
  );
}

function JellyfinContinueRow({
  onPlay,
}: {
  onPlay: (url: string, title: string) => void;
}) {
  const { data: profile } = useProfile();
  const [playingId, setPlayingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<JellyfinResumeData>({
    queryKey: ["jellyfin-resume"],
    queryFn: async () => {
      const res = await fetch("/api/jellyfin/user/resume");
      if (!res.ok) throw new Error("Erreur chargement");
      return res.json() as Promise<JellyfinResumeData>;
    },
    enabled: !!profile?.jellyfin_user_id,
    staleTime: 3 * 60 * 1000,
  });

  const handlePlay = useCallback(
    async (item: JellyfinBaseItem) => {
      if (playingId) return;
      setPlayingId(item.Id);
      try {
        const res = await fetch(`/api/jellyfin/user/stream/${item.Id}`);
        const json = await res.json() as { url?: string; error?: string };
        if (json.url) onPlay(json.url, item.SeriesName ?? item.Name);
      } finally {
        setPlayingId(null);
      }
    },
    [playingId, onPlay]
  );

  if (!profile?.jellyfin_user_id) return null;
  if (isLoading) return (
    <div className="px-4 sm:px-6 space-y-3 animate-pulse">
      <div className="h-5 w-48 rounded-lg bg-white/6" />
      <div className="flex gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="shrink-0 w-44 sm:w-52 aspect-video rounded-xl bg-white/5" />
        ))}
      </div>
    </div>
  );
  if (!data?.Items?.length) return null;

  return (
    <div className="px-4 sm:px-6 space-y-3">
      <div className="flex items-center gap-2">
        <RotateCcw className="size-4 text-[#00a4dc]" />
        <h2 className="text-white font-semibold text-base">Reprendre la lecture</h2>
        <JellyfinIcon className="size-4 text-[#00a4dc] ml-1 opacity-70" />
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
        {data.Items.map((item) => (
          <JellyfinCard
            key={item.Id}
            item={item}
            serverUrl={data.serverUrl}
            isPlaying={playingId === item.Id}
            onClick={() => void handlePlay(item)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Skeleton de rangée ───────────────────────────────────────────────────────

function RowSkeleton() {
  return (
    <div className="px-4 sm:px-6 space-y-3 animate-pulse">
      <div className="h-5 w-40 rounded-lg bg-white/6" />
      <div className="flex gap-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="shrink-0 w-32 aspect-2/3 rounded-xl bg-white/5" />
        ))}
      </div>
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

const INITIAL_BATCH = 6;
const BATCH_SIZE = 5;

interface RecommendationsResponse {
  items: ScoredItem[];
  hasProfile: boolean;
}

export function HomeContent() {
  const [detailId, setDetailId] = useState<{ id: number; type: "movie" | "tv" } | null>(null);
  const [watchMovieId, setWatchMovieId] = useState<number | null>(null);
  const [streamOpen, setStreamOpen] = useState(false);
  const [activeStream, setActiveStream] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState("");

  // Toggle "Masquer les films vus" (persisté en localStorage)
  const [hideSeenItems, setHideSeenItems] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("nemo-hide-seen") === "true";
  });
  const toggleHideSeen = useCallback(() => {
    setHideSeenItems((prev) => {
      const next = !prev;
      localStorage.setItem("nemo-hide-seen", String(next));
      return next;
    });
  }, []);

  // Recommandations — pour le héro personnalisé
  const { data: recommendationsData } = useQuery<RecommendationsResponse>({
    queryKey: ["recommendations"],
    queryFn: async () => {
      const res = await fetch("/api/recommendations?limit=50");
      if (!res.ok) throw new Error("Erreur");
      return res.json() as Promise<RecommendationsResponse>;
    },
    staleTime: 15 * 60 * 1000,
    retry: 1,
  });

  // Taste profile — pour prioriser les genres aimés
  const { data: tasteProfileData } = useQuery<{ profile: { genre_scores: Record<string, number> } | null }>({
    queryKey: ["taste-profile-home"],
    queryFn: async () => {
      const res = await fetch("/api/taste-profile");
      if (!res.ok) return { profile: null };
      return res.json() as Promise<{ profile: { genre_scores: Record<string, number> } | null }>;
    },
    staleTime: 10 * 60 * 1000,
  });

  // Pool shufflé une seule fois au montage, reordonné si profil disponible
  const [allSections, setAllSections] = useState<SectionConfig[]>(() =>
    shuffleCopy(HOME_POOL)
  );

  // Reordonner les sections quand le profil de goût est chargé
  useEffect(() => {
    const genreScores = tasteProfileData?.profile?.genre_scores;
    if (!genreScores) return;

    // Top 3 genres avec score positif
    const topGenres = Object.entries(genreScores)
      .filter(([, score]) => score > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => id);

    if (topGenres.length === 0) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAllSections((prev) => {
      const preferred: SectionConfig[] = [];
      const rest: SectionConfig[] = [];

      for (const section of prev) {
        const sectionGenre = section.params?.with_genres;
        const matches =
          sectionGenre !== undefined &&
          topGenres.some((g) => String(sectionGenre).split(",").includes(g) || String(sectionGenre).split("|").includes(g));

        if (matches) preferred.push(section);
        else rest.push(section);
      }

      // Préférés en tête, rest suit dans l'ordre existant (déjà shufflé)
      return [...preferred, ...rest];
    });
  }, [tasteProfileData]);
  const [visibleCount, setVisibleCount] = useState(INITIAL_BATCH);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const visibleSections = allSections.slice(0, visibleCount);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [heroItems, setHeroItems] = useState<any[]>([]);
  const heroSet = useRef(false);

  const trendingDay = useTrending("all", "day");
  const trendingWeek = useTrending("all", "week");
  const nowPlayingData = useNowPlayingMovies();
  const popularTVData = usePopularTV();

  useEffect(() => {
    if (heroSet.current) return;

    // Héro personnalisé : top 5 recommandations si profil disponible
    const recs = recommendationsData?.items;
    if (recs && recs.length >= 3 && recommendationsData.hasProfile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHeroItems(
        recs.slice(0, 5).map((item) => ({
          id: item.tmdb_id,
          title: item.title,
          name: item.name,
          backdrop_path: item.backdrop_path,
          poster_path: item.poster_path,
          overview: item.overview,
          vote_average: item.vote_average,
          media_type: item.media_type,
          // Champs nécessaires pour détection movie/tv par first_air_date
          ...(item.media_type === "tv" ? { first_air_date: item.first_air_date ?? "" } : {}),
        }))
      );
      heroSet.current = true;
      return;
    }

    // Fallback : trending mix
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pool: any[] = [
      ...(trendingDay.data?.results ?? []),
      ...(trendingWeek.data?.results ?? []),
      ...(nowPlayingData.data?.results ?? []),
      ...(popularTVData.data?.results ?? []),
    ];
    if (pool.length < 5) return;
    const seen = new Set<number>();
    const unique = pool.filter((item) => !seen.has(item.id) && seen.add(item.id));
    setHeroItems([...unique].sort(() => Math.random() - 0.5).slice(0, 5));
    heroSet.current = true;
  }, [recommendationsData, trendingDay.data, trendingWeek.data, nowPlayingData.data, popularTVData.data]);

  // ── Infinite scroll ────────────────────────────────────────────────────────
  const observerRef = useRef<IntersectionObserver | null>(null);

  const loadMore = useCallback(() => {
    setIsLoadingMore(true);
    // Petit délai visuel pour que le skeleton apparaisse
    setTimeout(() => {
      setAllSections((prev) => {
        const remaining = prev.length - visibleCount;
        if (remaining <= 0) {
          // Plus rien dans le pool statique → générer de nouvelles sections
          const generated = generateMoreSections(BATCH_SIZE);
          return [...prev, ...generated];
        }
        return prev;
      });
      setVisibleCount((c) => c + BATCH_SIZE);
      setIsLoadingMore(false);
    }, 300);
  }, [visibleCount]);

  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node) return;
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && !isLoadingMore) {
            loadMore();
          }
        },
        { rootMargin: "400px" } // déclenche 400px avant le bas
      );
      observerRef.current.observe(node);
    },
    [isLoadingMore, loadMore]
  );

  const { resolveStreams } = useStream();

  const movieDetail = useMovieDetail(detailId?.type === "movie" ? (detailId?.id ?? 0) : 0);
  const tvDetail = useTVShowDetail(detailId?.type === "tv" ? (detailId?.id ?? 0) : 0);
  const activeDetail = detailId?.type === "movie" ? movieDetail.data : tvDetail.data;

  const handleMoreInfo = useCallback((item: MediaItem, type: "movie" | "tv") => {
    setDetailId({ id: item.id, type });
  }, []);

  const handlePlay = useCallback(
    async (item: MediaItem, type: "movie" | "tv") => {
      if (type === "movie") {
        setWatchMovieId(item.id);
        return;
      }
      setActiveTitle(item.title ?? item.name ?? "");
      setStreamOpen(true);
      if (item.imdb_id) await resolveStreams(item.imdb_id, "series");
    },
    [resolveStreams]
  );

  if (activeStream) {
    return (
      <div className="fixed inset-0 z-(--z-overlay) bg-black">
        <VideoPlayer url={activeStream} title={activeTitle} onBack={() => setActiveStream(null)} className="w-full h-full" />
      </div>
    );
  }

  return (
    <div className="bg-nemo-bg">
      {/* Hero */}
      {heroItems.length > 0 && (
        <div className="px-2 sm:px-4">
          <HeroCinematic
            items={heroItems}
            onPlay={(media) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const m = media as any;
              const type: "movie" | "tv" = (m as { first_air_date?: string }).first_air_date ? "tv" : "movie";
              void handlePlay(m as MediaItem, type);
            }}
            onMoreInfo={(media) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const m = media as any;
              const type: "movie" | "tv" = (m as { first_air_date?: string }).first_air_date ? "tv" : "movie";
              handleMoreInfo(m as MediaItem, type);
            }}
          />
        </div>
      )}

      {/* ── Reprendre (Jellyfin Continue Watching) ─────────────────── */}
      <div className="relative z-(--z-above) pt-6">
        <JellyfinContinueRow
          onPlay={(url, title) => {
            setActiveTitle(title);
            setActiveStream(url);
          }}
        />
      </div>

      {/* Pour vous — rangée personnalisée + toggle */}
      <div className="relative z-(--z-above) pt-8">
        {/* Toggle masquer les vus */}
        <div className="flex justify-end px-4 sm:px-8 mb-3">
          <button
            onClick={toggleHideSeen}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all",
              hideSeenItems
                ? "bg-nemo-accent/20 text-nemo-accent border border-nemo-accent/40"
                : "bg-white/6 text-white/50 border border-white/10 hover:bg-white/10 hover:text-white/70"
            )}
          >
            {hideSeenItems ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
            {hideSeenItems ? "Nouveau pour moi" : "Tout afficher"}
          </button>
        </div>

        <PersonalizedRow
          onPlay={(item, type) => void handlePlay({ id: item.tmdb_id, title: item.title, name: item.name }, type)}
          onMoreInfo={(item, type) => handleMoreInfo({ id: item.tmdb_id, title: item.title, name: item.name }, type)}
        />
      </div>

      {/* Listes utilisateur */}
      <div className="relative z-(--z-above) pt-8 space-y-12 sm:space-y-14">
        <UserListRows
          onPlay={(item, type) => void handlePlay(item, type)}
          onMoreInfo={(item, type) => handleMoreInfo(item, type)}
          hideIfSeen={hideSeenItems}
        />
      </div>

      {/* Sections avec infinite scroll */}
      <div className="relative z-(--z-above) pt-8 pb-4 space-y-12 sm:space-y-14">
        {visibleSections.map((config) => (
          <SectionRow key={config.id} config={config} onPlay={handlePlay} onMoreInfo={handleMoreInfo} hideIfSeen={hideSeenItems} />
        ))}

        {/* Skeletons pendant le chargement */}
        {isLoadingMore && (
          <div className="space-y-10">
            {Array.from({ length: 3 }).map((_, i) => (
              <RowSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Sentinel invisible — déclenche loadMore */}
        <div ref={sentinelRef} className="h-1 w-full" aria-hidden />
      </div>

      {detailId && (
        <DetailModal
          media={(activeDetail as DetailMedia) ?? null}
          open={!!detailId}
          onClose={() => setDetailId(null)}
          mediaType={detailId.type}
          onPlay={(media) => {
            setDetailId(null);
            void handlePlay(media as MediaItem, detailId.type);
          }}
        />
      )}

      <MovieWatchModal
        open={watchMovieId !== null}
        onClose={() => setWatchMovieId(null)}
        movieId={watchMovieId ?? 0}
      />

      <StreamModal
        open={streamOpen}
        onClose={() => setStreamOpen(false)}
        onSelectStream={(s) => { setActiveStream(s.url); setStreamOpen(false); }}
        title={activeTitle}
      />
    </div>
  );
}
