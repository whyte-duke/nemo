"use client";

import { useQuery } from "@tanstack/react-query";
import { Play, RotateCcw } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useWatchHistory } from "@/hooks/use-watch-history";
import { getMovieSummary, getTVShowSummary, tmdbImage } from "@/lib/tmdb/client";
import type { WatchHistory } from "@/types/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ContinueItem {
  entry: WatchHistory;
  resumeSeconds: number;
}

interface ContinueWatchingRowProps {
  /** Appelé quand l'utilisateur clique sur un film */
  onPlayMovie: (tmdbId: number, resumeSeconds: number) => void;
  /** Appelé quand l'utilisateur clique sur une série */
  onPlayTV: (tmdbId: number, resumeSeconds: number) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatProgress(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}`;
  return `${m} min`;
}

// ─── Single card ──────────────────────────────────────────────────────────────

function ContinueCard({
  entry,
  resumeSeconds,
  onPlay,
}: {
  entry: WatchHistory;
  resumeSeconds: number;
  onPlay: () => void;
}) {
  const isMovie = entry.media_type === "movie";

  const { data } = useQuery({
    queryKey: ["tmdb-summary", entry.tmdb_id, entry.media_type],
    queryFn: async () => {
      if (isMovie) return getMovieSummary(entry.tmdb_id);
      const tv = await getTVShowSummary(entry.tmdb_id);
      return { id: tv.id, title: tv.name, poster_path: tv.poster_path };
    },
    staleTime: 1000 * 60 * 60, // 1h — poster doesn't change
  });

  const posterUrl = data?.poster_path
    ? tmdbImage.poster(data.poster_path, "w342")
    : null;

  const label = isMovie
    ? data?.title ?? "Film"
    : entry.season_number && entry.episode_number
    ? `${data?.title ?? "Série"} · S${entry.season_number}E${entry.episode_number}`
    : data?.title ?? "Série";

  return (
    <button
      onClick={onPlay}
      className={cn(
        "group shrink-0 relative w-32 sm:w-40 rounded-xl overflow-hidden",
        "border border-white/6 hover:border-white/20 transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nemo-accent"
      )}
      aria-label={`Reprendre : ${label}`}
    >
      {/* Poster */}
      <div className="aspect-[2/3] bg-white/5 relative">
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={label}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 128px, 160px"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-white/5">
            <Play className="size-8 text-white/20" />
          </div>
        )}

        {/* Hover overlay */}
        <div className={cn(
          "absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200",
          "flex items-center justify-center"
        )}>
          <div className={cn(
            "size-10 rounded-full bg-nemo-accent flex items-center justify-center",
            "opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100",
            "transition-all duration-200"
          )}>
            <Play className="size-5 fill-black text-black ml-0.5" />
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/15">
        <div
          className="h-full bg-nemo-accent transition-all"
          style={{ width: `${Math.min(99, entry.progress ?? 0)}%` }}
        />
      </div>

      {/* Title + time remaining */}
      <div className="absolute bottom-1.5 left-2 right-2 text-left pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
        <p className="text-white text-[10px] font-semibold leading-tight line-clamp-2 drop-shadow-lg">
          {label}
        </p>
        {resumeSeconds > 0 && (
          <p className="text-white/60 text-[9px] mt-0.5 drop-shadow">
            {formatProgress(resumeSeconds)} regardés
          </p>
        )}
      </div>
    </button>
  );
}

// ─── ContinueWatchingRow ──────────────────────────────────────────────────────

export function ContinueWatchingRow({
  onPlayMovie,
  onPlayTV,
}: ContinueWatchingRowProps) {
  const { data: history, isLoading } = useWatchHistory();

  // Filter: in-progress items (5% < progress < 95%), sorted by last_watched_at DESC
  const items: ContinueItem[] = (history ?? [])
    .filter((e) => (e.progress ?? 0) > 5 && (e.progress ?? 0) < 95)
    .slice(0, 10)
    .map((entry) => {
      const rawEntry = entry as WatchHistory & { last_position_seconds?: number | null };
      const resumeSeconds =
        rawEntry.last_position_seconds ??
        (entry.progress > 0 && entry.duration
          ? Math.floor((entry.progress / 100) * entry.duration)
          : 0);
      return { entry, resumeSeconds };
    });

  if (isLoading) {
    return (
      <div className="px-4 sm:px-6 space-y-3 animate-pulse">
        <div className="h-5 w-52 rounded-lg bg-white/6" />
        <div className="flex gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="shrink-0 w-32 sm:w-40 aspect-[2/3] rounded-xl bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="px-4 sm:px-6 space-y-3">
      <div className="flex items-center gap-2">
        <RotateCcw className="size-4 text-nemo-accent" />
        <h2 className="text-white font-semibold text-base">Continuer à regarder</h2>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [-webkit-overflow-scrolling:touch]">
        {items.map(({ entry, resumeSeconds }) => (
          <ContinueCard
            key={`${entry.tmdb_id}-${entry.media_type}`}
            entry={entry}
            resumeSeconds={resumeSeconds}
            onPlay={() => {
              if (entry.media_type === "movie") {
                onPlayMovie(entry.tmdb_id, resumeSeconds);
              } else {
                onPlayTV(entry.tmdb_id, resumeSeconds);
              }
            }}
          />
        ))}
      </div>
    </div>
  );
}
