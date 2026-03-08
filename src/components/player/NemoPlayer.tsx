"use client";

// ─── Vidstack CSS (loaded once, deduplicated by Next.js bundler) ──────────────
import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";

import { useEffect, useRef, useMemo, useCallback } from "react";
import {
  MediaPlayer,
  MediaProvider,
  Track,
  useMediaState,
  type MediaPlayerInstance,
  type PlayerSrc,
} from "@vidstack/react";
import {
  DefaultVideoLayout,
  defaultLayoutIcons,
} from "@vidstack/react/player/layouts/default";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { NemoMediaStorage } from "@/lib/player/media-storage";
import { useUpdateProgress } from "@/hooks/use-watch-history";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SubtitleTrack {
  src: string;
  label: string;
  language: string;
  default?: boolean;
}

export interface NemoPlayerProps {
  /** URL du flux (MP4 direct ou HLS .m3u8) */
  url: string;
  /** Type MIME explicite. Si omis, détecté depuis l'URL. */
  mimeType?: string;
  tmdbId?: number;
  mediaType?: "movie" | "tv";
  /** Titre affiché dans le player et Media Session API */
  title?: string;
  /** URL du backdrop TMDB (16:9) — utilisé comme poster et Media Session artwork */
  poster?: string;
  /** Position de reprise en secondes (depuis watch_history.last_position_seconds) */
  startTime?: number;
  /** Callback de retour vers la page précédente */
  onBack?: () => void;
  className?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  /** Pistes de sous-titres depuis Jellyfin ou autre source */
  subtitles?: SubtitleTrack[];
  /** Callback déclenché quand l'utilisateur clique "Épisode suivant" ou après le countdown */
  onNextEpisode?: () => void;
  /** Callback pour changer de source (rouvre le StreamModal) */
  onChangeSource?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function detectMimeType(url: string): string {
  if (url.includes(".m3u8")) return "application/x-mpegurl";
  if (url.includes(".mpd")) return "application/dash+xml";
  return "video/mp4";
}

function buildSrc(url: string, mimeType?: string): PlayerSrc {
  // Cast required: Vidstack's PlayerSrc union uses strict MIME literal types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { src: url, type: mimeType ?? detectMimeType(url) } as any;
}

// ─── ProgressSaver — inner component (must be inside <MediaPlayer>) ───────────

interface ProgressSaverProps {
  tmdbId: number;
  mediaType: "movie" | "tv";
  seasonNumber?: number;
  episodeNumber?: number;
}

function ProgressSaver({
  tmdbId,
  mediaType,
  seasonNumber,
  episodeNumber,
}: ProgressSaverProps) {
  const paused = useMediaState("paused");
  const ended = useMediaState("ended");
  const currentTime = useMediaState("currentTime");
  const duration = useMediaState("duration");
  const { mutate: updateProgress } = useUpdateProgress();

  const save = useCallback(
    (time: number, dur: number, done = false) => {
      if (dur <= 0) return;
      const progress = done ? 100 : Math.min(99, Math.round((time / dur) * 100));
      updateProgress({
        tmdbId,
        mediaType,
        progress,
        duration: Math.floor(dur),
        lastPositionSeconds: done ? 0 : Math.floor(time),
        seasonNumber,
        episodeNumber,
      });
    },
    [tmdbId, mediaType, seasonNumber, episodeNumber, updateProgress]
  );

  // Save on pause (if meaningful progress)
  useEffect(() => {
    if (paused && currentTime > 5 && duration > 0) {
      save(currentTime, duration);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  // Save on ended — mark as 100%
  useEffect(() => {
    if (ended && duration > 0) {
      save(0, duration, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ended]);

  // Save every 30s while playing
  useEffect(() => {
    const interval = setInterval(() => {
      if (!paused && !ended && currentTime > 5 && duration > 0) {
        save(currentTime, duration);
      }
    }, 30_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, ended]);

  return null;
}

// ─── NextEpisodeOverlay — inner component ─────────────────────────────────────

interface NextEpisodeOverlayProps {
  onNext: () => void;
}

function NextEpisodeOverlay({ onNext }: NextEpisodeOverlayProps) {
  const currentTime = useMediaState("currentTime");
  const duration = useMediaState("duration");
  const ended = useMediaState("ended");
  const countdownRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissedRef = useRef(false);

  const visible =
    !dismissedRef.current &&
    (ended || (duration > 0 && currentTime > 0 && currentTime / duration >= 0.95));

  // Auto-play next episode after 15s
  useEffect(() => {
    if (!visible) return;
    countdownRef.current = setTimeout(onNext, 15_000);
    return () => {
      if (countdownRef.current) clearTimeout(countdownRef.current);
    };
  }, [visible, onNext]);

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="absolute bottom-20 right-4 z-50 flex gap-2"
      >
        <button
          onClick={() => {
            dismissedRef.current = true;
            if (countdownRef.current) clearTimeout(countdownRef.current);
          }}
          className="px-4 py-2 rounded-xl text-sm font-medium bg-white/10 border border-white/15 text-white/70 hover:bg-white/20 transition-colors backdrop-blur-sm"
        >
          Annuler
        </button>
        <button
          onClick={onNext}
          className="px-5 py-2 rounded-xl text-sm font-semibold bg-nemo-accent text-black hover:bg-nemo-accent/90 transition-colors"
        >
          Épisode suivant →
        </button>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── NemoPlayer ───────────────────────────────────────────────────────────────

export function NemoPlayer({
  url,
  mimeType,
  tmdbId,
  mediaType,
  title,
  poster,
  startTime = 0,
  onBack,
  className,
  seasonNumber,
  episodeNumber,
  subtitles = [],
  onNextEpisode,
  onChangeSource,
}: NemoPlayerProps) {
  const playerRef = useRef<MediaPlayerInstance>(null);

  const storage = useMemo(
    () =>
      tmdbId && mediaType
        ? new NemoMediaStorage(
            `${tmdbId}-${mediaType}${seasonNumber ? `-s${seasonNumber}e${episodeNumber}` : ""}`,
            startTime
          )
        : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tmdbId, mediaType, seasonNumber, episodeNumber]
    // intentionally omitting startTime: storage is created once per media item
  );

  const src = useMemo(() => buildSrc(url, mimeType), [url, mimeType]);

  return (
    <div className={cn("relative w-full h-full bg-black", className)}>
      {/* ── Back button overlay ── */}
      {onBack && (
        <button
          onClick={onBack}
          aria-label="Retour"
          className={cn(
            "absolute top-4 left-4 z-50",
            "flex items-center gap-2 px-3 py-2 rounded-xl",
            "bg-black/50 backdrop-blur-sm border border-white/10",
            "text-white/80 hover:text-white hover:bg-black/70 transition-all",
            "text-sm font-medium",
            // Hide when not hovering the player to not obstruct Vidstack controls
            "opacity-0 hover:opacity-100 focus:opacity-100",
            // Show on touch devices (no hover)
            "[@media(hover:none)]:opacity-100"
          )}
        >
          <ArrowLeft className="size-4" />
          <span className="hidden sm:inline">Retour</span>
        </button>
      )}

      {/* ── Change source button overlay ── */}
      {onChangeSource && (
        <button
          onClick={onChangeSource}
          aria-label="Changer de source"
          className={cn(
            "absolute top-4 right-4 z-50",
            "flex items-center gap-2 px-3 py-2 rounded-xl",
            "bg-black/50 backdrop-blur-sm border border-white/10",
            "text-white/80 hover:text-white hover:bg-black/70 transition-all",
            "text-sm font-medium",
            "opacity-0 hover:opacity-100 focus:opacity-100",
            "[@media(hover:none)]:opacity-100"
          )}
        >
          <RefreshCw className="size-4" />
          <span className="hidden sm:inline">Changer de source</span>
        </button>
      )}

      <MediaPlayer
        ref={playerRef}
        src={src}
        title={title}
        poster={poster}
        storage={storage}
        playsInline
        className="w-full h-full"
        style={{ "--media-brand": "#e8b84b" } as React.CSSProperties & Record<`--${string}`, string>}
      >
        <MediaProvider>
          {subtitles.map((sub, i) => (
            <Track
              key={String(i)}
              src={sub.src}
              kind="subtitles"
              label={sub.label}
              lang={sub.language}
              default={sub.default}
            />
          ))}
        </MediaProvider>

        <DefaultVideoLayout
          icons={defaultLayoutIcons}
          colorScheme="dark"
        />

        {/* Progress saver — only when we have tracking context */}
        {tmdbId && mediaType && (
          <ProgressSaver
            tmdbId={tmdbId}
            mediaType={mediaType}
            seasonNumber={seasonNumber}
            episodeNumber={episodeNumber}
          />
        )}

        {/* Next episode overlay — only for series with a next episode callback */}
        {onNextEpisode && <NextEpisodeOverlay onNext={onNextEpisode} />}
      </MediaPlayer>
    </div>
  );
}
