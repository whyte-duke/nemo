"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { Tv } from "lucide-react";
import { HeroCinematic } from "@/components/hero/HeroCinematic";
import { MediaRow } from "@/components/media/MediaRow";
import { DetailModal } from "@/components/media/DetailModal";
import { StreamModal } from "@/components/player/StreamModal";
import {
  useTrending,
  useTopRatedTV,
  usePopularTV,
  useOnAirTV,
  useDiscoverTV,
  useTVShowDetail,
} from "@/hooks/use-tmdb";
import { useStream } from "@/providers/stream-provider";
import type { TMDbTVShowDetail } from "@/types/tmdb";

type MediaItem = { id: number; title?: string; name?: string; imdb_id?: string | null };

// ─── Types de sections ───────────────────────────────────────────────────────

type SectionSource =
  | "trending-tv-day"
  | "trending-tv-week"
  | "popular-tv"
  | "toprated-tv"
  | "onair"
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

// ─── Pool complet séries ─────────────────────────────────────────────────────

const SERIES_POOL: SectionConfig[] = [
  // Essentielles
  { id: "tr-day",    source: "trending-tv-day",  title: "Tendances aujourd'hui" },
  { id: "tr-week",   source: "trending-tv-week", title: "Tendances cette semaine" },
  { id: "onair",     source: "onair",             title: "Actuellement diffusées", badge: "Live" },
  { id: "popular",   source: "popular-tv",        title: "Les plus populaires" },
  { id: "toprated",  source: "toprated-tv",       title: "Les mieux notées", showTopNumber: true },
  // Genres
  { id: "action-tv",  source: "discover-tv", title: "Action & Aventure",      params: { with_genres: "10759", sort_by: "popularity.desc" } },
  { id: "scifi-tv",   source: "discover-tv", title: "Sci-Fi & Fantasy",        params: { with_genres: "10765", sort_by: "popularity.desc" } },
  { id: "crime-tv",   source: "discover-tv", title: "Crime & Policier",        params: { with_genres: "80",    sort_by: "popularity.desc" } },
  { id: "drama-tv",   source: "discover-tv", title: "Grands Drames",           params: { with_genres: "18",    sort_by: "vote_average.desc", "vote_count.gte": 500 } },
  { id: "comedy-tv",  source: "discover-tv", title: "Comédie",                 params: { with_genres: "35",    sort_by: "popularity.desc" } },
  { id: "mystery-tv", source: "discover-tv", title: "Mystère & Thriller",      params: { with_genres: "9648",  sort_by: "popularity.desc" } },
  { id: "anim-tv",    source: "discover-tv", title: "Animation",               params: { with_genres: "16",    sort_by: "popularity.desc" } },
  { id: "war-tv",     source: "discover-tv", title: "Guerre & Politique",      params: { with_genres: "10768", sort_by: "vote_average.desc", "vote_count.gte": 100 } },
  { id: "doc-tv",     source: "discover-tv", title: "Documentaires",           params: { with_genres: "99",    sort_by: "vote_average.desc", "vote_count.gte": 50 } },
  // Curatés
  { id: "gems-tv",    source: "discover-tv", title: "Séries incontournables ★", showTopNumber: true, params: { "vote_average.gte": 8.0, "vote_count.gte": 500, sort_by: "vote_average.desc" } },
  { id: "french-tv",  source: "discover-tv", title: "Séries Françaises",       params: { with_original_language: "fr", sort_by: "popularity.desc" } },
  { id: "korean-tv",  source: "discover-tv", title: "K-Drama",                 params: { with_original_language: "ko", sort_by: "vote_average.desc", "vote_count.gte": 100 } },
  { id: "british-tv", source: "discover-tv", title: "Séries Britanniques",     params: { with_original_language: "en", origin_country: "GB", sort_by: "vote_average.desc", "vote_count.gte": 200 } },
  { id: "miniseries", source: "discover-tv", title: "Mini-séries",             params: { with_type: "2", sort_by: "vote_average.desc", "vote_count.gte": 100 } },
  { id: "reality-tv", source: "discover-tv", title: "Téléréalité & Jeux",      params: { with_genres: "10764,10767", sort_by: "popularity.desc" } },
  // Plateformes
  { id: "netflix-tv",   source: "discover-tv", title: "Netflix",      badge: "N",  params: { with_watch_providers: "8",    watch_region: "FR", sort_by: "popularity.desc" }, viewAllHref: "/hub/netflix" },
  { id: "disney-tv",    source: "discover-tv", title: "Disney+",      badge: "D+", params: { with_watch_providers: "337",  watch_region: "FR", sort_by: "popularity.desc" }, viewAllHref: "/hub/disney+" },
  { id: "hbo-tv",       source: "discover-tv", title: "Max — HBO",    badge: "M",  params: { with_watch_providers: "1899", watch_region: "FR", sort_by: "popularity.desc" }, viewAllHref: "/hub/max" },
  { id: "amazon-tv",    source: "discover-tv", title: "Amazon Prime", badge: "P",  params: { with_watch_providers: "119",  watch_region: "FR", sort_by: "popularity.desc" } },
  { id: "canal-tv",     source: "discover-tv", title: "Canal+",       badge: "C+", params: { with_watch_providers: "381",  watch_region: "FR", sort_by: "popularity.desc" }, viewAllHref: "/hub/canal-plus" },
  { id: "appletv-tv",   source: "discover-tv", title: "Apple TV+",    badge: "A",  params: { with_watch_providers: "350",  watch_region: "FR", sort_by: "popularity.desc" }, viewAllHref: "/hub/apple-tv" },
  { id: "ocs-tv",       source: "discover-tv", title: "OCS",          badge: "O",  params: { with_watch_providers: "56",   watch_region: "FR", sort_by: "popularity.desc" } },
  { id: "paramount-tv", source: "discover-tv", title: "Paramount+",   badge: "P+", params: { with_watch_providers: "531",  watch_region: "FR", sort_by: "popularity.desc" } },
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

function TrendingTVDayRow({ config, onPlay, onMoreInfo }: RowProps) {
  const { data, isLoading } = useTrending("tv", "day");
  return <MediaRow title={config.title} items={data?.results ?? []} mediaType="tv" isLoading={isLoading} onPlay={(i) => onPlay(i as MediaItem)} onMoreInfo={(i) => onMoreInfo(i as MediaItem)} />;
}

function TrendingTVWeekRow({ config, onPlay, onMoreInfo }: RowProps) {
  const { data, isLoading } = useTrending("tv", "week");
  return <MediaRow title={config.title} items={data?.results ?? []} mediaType="tv" isLoading={isLoading} onPlay={(i) => onPlay(i as MediaItem)} onMoreInfo={(i) => onMoreInfo(i as MediaItem)} />;
}

function PopularTVRow({ config, onPlay, onMoreInfo }: RowProps) {
  const { data, isLoading } = usePopularTV();
  return <MediaRow title={config.title} items={data?.results ?? []} mediaType="tv" isLoading={isLoading} onPlay={(i) => onPlay(i as MediaItem)} onMoreInfo={(i) => onMoreInfo(i as MediaItem)} showTopNumber={config.showTopNumber} />;
}

function TopRatedTVRow({ config, onPlay, onMoreInfo }: RowProps) {
  const { data, isLoading } = useTopRatedTV();
  return <MediaRow title={config.title} items={data?.results ?? []} mediaType="tv" isLoading={isLoading} onPlay={(i) => onPlay(i as MediaItem)} onMoreInfo={(i) => onMoreInfo(i as MediaItem)} showTopNumber={config.showTopNumber} />;
}

function OnAirRow({ config, onPlay, onMoreInfo }: RowProps) {
  const { data, isLoading } = useOnAirTV();
  return <MediaRow title={config.title} badge={config.badge} items={data?.results ?? []} mediaType="tv" isLoading={isLoading} onPlay={(i) => onPlay(i as MediaItem)} onMoreInfo={(i) => onMoreInfo(i as MediaItem)} />;
}

function DiscoverTVRow({ config, onPlay, onMoreInfo }: RowProps) {
  const [page] = useState(() => Math.floor(Math.random() * 4) + 1);
  const { data, isLoading } = useDiscoverTV(config.params ?? {}, page);
  const providerSlug = config.viewAllHref?.replace(/^\/hub\//, "");
  return <MediaRow title={config.title} badge={config.badge} viewAllHref={config.viewAllHref} showTopNumber={config.showTopNumber} providerSlug={providerSlug} items={data?.results ?? []} mediaType="tv" isLoading={isLoading} onPlay={(i) => onPlay(i as MediaItem)} onMoreInfo={(i) => onMoreInfo(i as MediaItem)} />;
}

function SectionRow({ config, onPlay, onMoreInfo }: RowProps) {
  const p = { config, onPlay, onMoreInfo };
  switch (config.source) {
    case "trending-tv-day":  return <TrendingTVDayRow {...p} />;
    case "trending-tv-week": return <TrendingTVWeekRow {...p} />;
    case "popular-tv":       return <PopularTVRow {...p} />;
    case "toprated-tv":      return <TopRatedTVRow {...p} />;
    case "onair":            return <OnAirRow {...p} />;
    case "discover-tv":      return <DiscoverTVRow {...p} />;
  }
}

// ─── Page principale ─────────────────────────────────────────────────────────

export function SeriesContent() {
  const [detailId, setDetailId] = useState<{ id: number } | null>(null);
  const [streamOpen, setStreamOpen] = useState(false);
  const [activeTitle, setActiveTitle] = useState("");

  // 10 sections aléatoires — tout dans le pool, ordre aléatoire
  const [sections] = useState<SectionConfig[]>(() => pickRandom(SERIES_POOL, 10));

  // Hero — pool combiné de 4 sources → shuffle → 5 items uniques
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [heroItems, setHeroItems] = useState<any[]>([]);
  const heroSet = useRef(false);

  const trendingDay = useTrending("tv", "day");
  const trendingWeek = useTrending("tv", "week");
  const onAirData = useOnAirTV();
  const popularData = usePopularTV();

  useEffect(() => {
    if (heroSet.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pool: any[] = [
      ...(trendingDay.data?.results ?? []),
      ...(trendingWeek.data?.results ?? []),
      ...(onAirData.data?.results ?? []),
      ...(popularData.data?.results ?? []),
    ];
    if (pool.length < 5) return;
    const seen = new Set<number>();
    const unique = pool.filter((item) => !seen.has(item.id) && seen.add(item.id));
    setHeroItems([...unique].sort(() => Math.random() - 0.5).slice(0, 5));
    heroSet.current = true;
  }, [trendingDay.data, trendingWeek.data, onAirData.data, popularData.data]);

  const { resolveStreams } = useStream();
  const tvDetail = useTVShowDetail(detailId?.id ?? 0);

  const handlePlay = useCallback(
    async (item: MediaItem) => {
      setActiveTitle(item.title ?? item.name ?? "");
      setStreamOpen(true);
      if (item.imdb_id) await resolveStreams(`${item.imdb_id}:1:1`, "series");
    },
    [resolveStreams]
  );

  const handleMoreInfo = useCallback((item: MediaItem) => {
    setDetailId({ id: item.id });
  }, []);

  return (
    <div className="bg-nemo-bg min-h-dvh">
      {/* Hero — pool ~80 séries, 5 choisies aléatoirement */}
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
          <div className="flex items-center justify-center size-9 rounded-xl bg-indigo-500/15 ring-1 ring-indigo-500/30">
            <Tv className="size-4.5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white leading-tight">Séries</h1>
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
          media={(tvDetail.data as TMDbTVShowDetail) ?? null}
          open={!!detailId}
          onClose={() => setDetailId(null)}
          mediaType="tv"
          onPlay={(media) => { setDetailId(null); void handlePlay(media as MediaItem); }}
        />
      )}

      <StreamModal
        open={streamOpen}
        onClose={() => setStreamOpen(false)}
        title={activeTitle}
      />
    </div>
  );
}
