"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { Film } from "lucide-react";
import { HeroCinematic } from "@/components/hero/HeroCinematic";
import { MediaRow } from "@/components/media/MediaRow";
import { DetailModal } from "@/components/media/DetailModal";
import { MovieWatchModal } from "@/components/player/MovieWatchModal";
import { VideoPlayer } from "@/components/player/VideoPlayer";
import {
  useTrending,
  useTopRatedMovies,
  useNowPlayingMovies,
  useUpcomingMovies,
  usePopularMovies,
  useDiscoverMovies,
  useMovieDetail,
} from "@/hooks/use-tmdb";
import type { TMDbMovieDetail } from "@/types/tmdb";

type MediaItem = { id: number; title?: string; name?: string; imdb_id?: string | null };

// ─── Types de sections ───────────────────────────────────────────────────────

type SectionSource =
  | "trending-movie-day"
  | "trending-movie-week"
  | "nowplaying"
  | "upcoming"
  | "popular-movies"
  | "toprated-movies"
  | "discover-movie";

type SectionConfig = {
  id: string;
  title: string;
  badge?: string;
  showTopNumber?: boolean;
  viewAllHref?: string;
  source: SectionSource;
  params?: Record<string, string | number | boolean>;
};

// ─── Pool complet films ──────────────────────────────────────────────────────

const FILMS_POOL: SectionConfig[] = [
  // Essentielles — dans le pool, pas forcées en tête
  { id: "tr-day",    source: "trending-movie-day",  title: "Tendances aujourd'hui" },
  { id: "tr-week",   source: "trending-movie-week", title: "Tendances cette semaine" },
  { id: "nowplay",   source: "nowplaying",           title: "En ce moment en salles", badge: "Live" },
  { id: "upcoming",  source: "upcoming",             title: "Prochainement au cinéma", badge: "Bientôt" },
  { id: "popular-m", source: "popular-movies",       title: "Les plus populaires" },
  { id: "top-m",     source: "toprated-movies",      title: "Les mieux notés de tous les temps", showTopNumber: true },
  // Genres
  { id: "action",    source: "discover-movie", title: "Action & Aventure",       params: { with_genres: "28",    sort_by: "popularity.desc" } },
  { id: "scifi",     source: "discover-movie", title: "Science-Fiction",          params: { with_genres: "878",   sort_by: "popularity.desc" } },
  { id: "thriller",  source: "discover-movie", title: "Thriller & Suspense",      params: { with_genres: "53",    sort_by: "vote_average.desc", "vote_count.gte": 500 } },
  { id: "horror",    source: "discover-movie", title: "Horreur",                  params: { with_genres: "27",    sort_by: "popularity.desc" } },
  { id: "comedy",    source: "discover-movie", title: "Comédie",                  params: { with_genres: "35",    sort_by: "popularity.desc" } },
  { id: "drama",     source: "discover-movie", title: "Grands Drames",            params: { with_genres: "18",    sort_by: "vote_average.desc", "vote_count.gte": 1000 } },
  { id: "anim",      source: "discover-movie", title: "Animation",                params: { with_genres: "16",    sort_by: "popularity.desc" } },
  { id: "crime",     source: "discover-movie", title: "Crime & Policier",         params: { with_genres: "80",    sort_by: "popularity.desc" } },
  { id: "romance",   source: "discover-movie", title: "Romance",                  params: { with_genres: "10749", sort_by: "popularity.desc" } },
  { id: "fantasy",   source: "discover-movie", title: "Fantastique & Magie",      params: { with_genres: "14",    sort_by: "popularity.desc" } },
  { id: "war",       source: "discover-movie", title: "Guerre & Histoire",        params: { with_genres: "10752,36", sort_by: "vote_average.desc", "vote_count.gte": 300 } },
  { id: "doc",       source: "discover-movie", title: "Documentaires",            params: { with_genres: "99",    sort_by: "vote_average.desc", "vote_count.gte": 100 } },
  // Curatés
  { id: "master",    source: "discover-movie", title: "Chef-d'œuvres ★8+", showTopNumber: true, params: { "vote_average.gte": 8.0, "vote_count.gte": 2000, sort_by: "vote_average.desc" } },
  { id: "gems",      source: "discover-movie", title: "Pépites méconnues",        params: { "vote_average.gte": 7.5, "vote_count.gte": 200, "vote_count.lte": 3000, sort_by: "vote_average.desc" } },
  { id: "french",    source: "discover-movie", title: "Cinéma Français",          params: { with_original_language: "fr", sort_by: "popularity.desc" } },
  { id: "korean",    source: "discover-movie", title: "Cinéma Coréen",            params: { with_original_language: "ko", sort_by: "vote_average.desc", "vote_count.gte": 200 } },
  { id: "japanese",  source: "discover-movie", title: "Cinéma Japonais",          params: { with_original_language: "ja", sort_by: "vote_average.desc", "vote_count.gte": 200 } },
  { id: "2010s",     source: "discover-movie", title: "La décennie 2010",         params: { "primary_release_date.gte": "2010-01-01", "primary_release_date.lte": "2019-12-31", sort_by: "vote_average.desc", "vote_count.gte": 1000 } },
  { id: "2000s",     source: "discover-movie", title: "La décennie 2000",         params: { "primary_release_date.gte": "2000-01-01", "primary_release_date.lte": "2009-12-31", sort_by: "vote_average.desc", "vote_count.gte": 500 } },
  { id: "90s",       source: "discover-movie", title: "Classiques des années 90", params: { "primary_release_date.gte": "1990-01-01", "primary_release_date.lte": "1999-12-31", sort_by: "vote_average.desc", "vote_count.gte": 500 } },
  { id: "80s",       source: "discover-movie", title: "Cultes des années 80",     params: { "primary_release_date.gte": "1980-01-01", "primary_release_date.lte": "1989-12-31", sort_by: "vote_average.desc", "vote_count.gte": 500 } },
  // Plateformes
  { id: "netflix",   source: "discover-movie", title: "Netflix",      badge: "N",  params: { with_watch_providers: "8",    watch_region: "FR", sort_by: "popularity.desc" }, viewAllHref: "/hub/netflix" },
  { id: "disney",    source: "discover-movie", title: "Disney+",      badge: "D+", params: { with_watch_providers: "337",  watch_region: "FR", sort_by: "popularity.desc" }, viewAllHref: "/hub/disney+" },
  { id: "hbo",       source: "discover-movie", title: "Max — HBO",    badge: "M",  params: { with_watch_providers: "1899", watch_region: "FR", sort_by: "popularity.desc" }, viewAllHref: "/hub/max" },
  { id: "amazon",    source: "discover-movie", title: "Amazon Prime", badge: "P",  params: { with_watch_providers: "119",  watch_region: "FR", sort_by: "popularity.desc" } },
  { id: "canal",     source: "discover-movie", title: "Canal+",       badge: "C+", params: { with_watch_providers: "381",  watch_region: "FR", sort_by: "popularity.desc" }, viewAllHref: "/hub/canal-plus" },
  { id: "appletv",   source: "discover-movie", title: "Apple TV+",    badge: "A",  params: { with_watch_providers: "350",  watch_region: "FR", sort_by: "popularity.desc" }, viewAllHref: "/hub/apple-tv" },
  { id: "paramount", source: "discover-movie", title: "Paramount+",   badge: "P+", params: { with_watch_providers: "531",  watch_region: "FR", sort_by: "popularity.desc" } },
];

function pickRandom<T>(arr: T[], count: number): T[] {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, count);
}

// ─── Composants de rangée ────────────────────────────────────────────────────

type RowProps = {
  config: SectionConfig;
  onPlay: (item: MediaItem) => void;
  onMoreInfo: (item: MediaItem) => void;
};

function TrendingMovieDayRow({ config, onPlay, onMoreInfo }: RowProps) {
  const { data, isLoading } = useTrending("movie", "day");
  return <MediaRow title={config.title} items={data?.results ?? []} mediaType="movie" isLoading={isLoading} onPlay={(i) => onPlay(i as MediaItem)} onMoreInfo={(i) => onMoreInfo(i as MediaItem)} />;
}

function TrendingMovieWeekRow({ config, onPlay, onMoreInfo }: RowProps) {
  const { data, isLoading } = useTrending("movie", "week");
  return <MediaRow title={config.title} items={data?.results ?? []} mediaType="movie" isLoading={isLoading} onPlay={(i) => onPlay(i as MediaItem)} onMoreInfo={(i) => onMoreInfo(i as MediaItem)} />;
}

function NowPlayingRow({ config, onPlay, onMoreInfo }: RowProps) {
  const { data, isLoading } = useNowPlayingMovies();
  return <MediaRow title={config.title} badge={config.badge} items={data?.results ?? []} mediaType="movie" isLoading={isLoading} onPlay={(i) => onPlay(i as MediaItem)} onMoreInfo={(i) => onMoreInfo(i as MediaItem)} />;
}

function UpcomingRow({ config, onPlay, onMoreInfo }: RowProps) {
  const { data, isLoading } = useUpcomingMovies();
  return <MediaRow title={config.title} badge={config.badge} items={data?.results ?? []} mediaType="movie" isLoading={isLoading} onPlay={(i) => onPlay(i as MediaItem)} onMoreInfo={(i) => onMoreInfo(i as MediaItem)} />;
}

function PopularMoviesRow({ config, onPlay, onMoreInfo }: RowProps) {
  const { data, isLoading } = usePopularMovies();
  return <MediaRow title={config.title} items={data?.results ?? []} mediaType="movie" isLoading={isLoading} onPlay={(i) => onPlay(i as MediaItem)} onMoreInfo={(i) => onMoreInfo(i as MediaItem)} showTopNumber={config.showTopNumber} />;
}

function TopRatedMoviesRow({ config, onPlay, onMoreInfo }: RowProps) {
  const { data, isLoading } = useTopRatedMovies();
  return <MediaRow title={config.title} items={data?.results ?? []} mediaType="movie" isLoading={isLoading} onPlay={(i) => onPlay(i as MediaItem)} onMoreInfo={(i) => onMoreInfo(i as MediaItem)} showTopNumber={config.showTopNumber} />;
}

function DiscoverMovieRow({ config, onPlay, onMoreInfo }: RowProps) {
  const [page] = useState(() => Math.floor(Math.random() * 4) + 1);
  const { data, isLoading } = useDiscoverMovies(config.params ?? {}, page);
  const providerSlug = config.viewAllHref?.replace(/^\/hub\//, "");
  return <MediaRow title={config.title} badge={config.badge} viewAllHref={config.viewAllHref} showTopNumber={config.showTopNumber} providerSlug={providerSlug} items={data?.results ?? []} mediaType="movie" isLoading={isLoading} onPlay={(i) => onPlay(i as MediaItem)} onMoreInfo={(i) => onMoreInfo(i as MediaItem)} />;
}

function SectionRow({ config, onPlay, onMoreInfo }: RowProps) {
  const p = { config, onPlay, onMoreInfo };
  switch (config.source) {
    case "trending-movie-day":  return <TrendingMovieDayRow {...p} />;
    case "trending-movie-week": return <TrendingMovieWeekRow {...p} />;
    case "nowplaying":          return <NowPlayingRow {...p} />;
    case "upcoming":            return <UpcomingRow {...p} />;
    case "popular-movies":      return <PopularMoviesRow {...p} />;
    case "toprated-movies":     return <TopRatedMoviesRow {...p} />;
    case "discover-movie":      return <DiscoverMovieRow {...p} />;
  }
}

// ─── Page principale ─────────────────────────────────────────────────────────

export function FilmsContent() {
  const [detailId, setDetailId] = useState<{ id: number } | null>(null);
  const [watchMovieId, setWatchMovieId] = useState<number | null>(null);
  const [activeStream, setActiveStream] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState("");

  // 10 sections aléatoires — tout dans le pool, ordre aléatoire
  const [sections] = useState<SectionConfig[]>(() => pickRandom(FILMS_POOL, 10));

  // Hero — pool combiné de 4 sources → shuffle → 5 items uniques
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [heroItems, setHeroItems] = useState<any[]>([]);
  const heroSet = useRef(false);

  const trendingDay = useTrending("movie", "day");
  const trendingWeek = useTrending("movie", "week");
  const nowPlayingData = useNowPlayingMovies();
  const popularData = usePopularMovies();

  useEffect(() => {
    if (heroSet.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pool: any[] = [
      ...(trendingDay.data?.results ?? []),
      ...(trendingWeek.data?.results ?? []),
      ...(nowPlayingData.data?.results ?? []),
      ...(popularData.data?.results ?? []),
    ];
    if (pool.length < 5) return;
    const seen = new Set<number>();
    const unique = pool.filter((item) => !seen.has(item.id) && seen.add(item.id));
    setHeroItems([...unique].sort(() => Math.random() - 0.5).slice(0, 5));
    heroSet.current = true;
  }, [trendingDay.data, trendingWeek.data, nowPlayingData.data, popularData.data]);

  const movieDetail = useMovieDetail(detailId?.id ?? 0);

  const handlePlay = useCallback((item: MediaItem) => {
    setWatchMovieId(item.id);
  }, []);

  const handleMoreInfo = useCallback((item: MediaItem) => {
    setDetailId({ id: item.id });
  }, []);

  if (activeStream) {
    return (
      <div className="fixed inset-0 z-(--z-overlay) bg-black">
        <VideoPlayer url={activeStream} title={activeTitle} onBack={() => setActiveStream(null)} className="w-full h-full" />
      </div>
    );
  }

  return (
    <div className="bg-nemo-bg min-h-dvh">
      {/* Hero — pool ~80 films, 5 choisis aléatoirement */}
      {heroItems.length > 0 && (
        <div className="px-3 sm:px-4 pt-18 sm:pt-20">
          <HeroCinematic items={heroItems} onPlay={(m) => void handlePlay(m as MediaItem)} onMoreInfo={(m) => handleMoreInfo(m as MediaItem)} />
        </div>
      )}

      {/* En-tête compact */}
      <div className="relative pt-10 pb-8 px-6 sm:px-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-3"
        >
          <div className="flex items-center justify-center size-9 rounded-xl bg-nemo-accent/15 ring-1 ring-nemo-accent/30">
            <Film className="size-4.5 text-nemo-accent" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white leading-tight">Films</h1>
            <p className="text-white/40 text-xs">Catalogue mondial · toutes plateformes</p>
          </div>
        </motion.div>
      </div>

      {/* 10 sections tirées aléatoirement depuis le pool */}
      <div className="pb-16 space-y-10">
        {sections.map((config) => (
          <SectionRow key={config.id} config={config} onPlay={(item) => void handlePlay(item)} onMoreInfo={handleMoreInfo} />
        ))}
      </div>

      {detailId && (
        <DetailModal
          media={(movieDetail.data as TMDbMovieDetail) ?? null}
          open={!!detailId}
          onClose={() => setDetailId(null)}
          mediaType="movie"
          onPlay={(media) => { setDetailId(null); handlePlay(media as MediaItem); }}
        />
      )}

      <MovieWatchModal
        open={watchMovieId !== null}
        onClose={() => setWatchMovieId(null)}
        movieId={watchMovieId ?? 0}
      />
    </div>
  );
}
