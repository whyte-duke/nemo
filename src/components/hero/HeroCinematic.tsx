"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Play, VolumeX, Volume2, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { tmdbImage, getTrailerKey } from "@/lib/tmdb/client";
import type { TMDbImage } from "@/types/tmdb";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type HeroMedia = any;

function isMovie(media: HeroMedia): boolean {
  return "title" in media;
}

function getBestBackdrop(media: HeroMedia): string | null {
  const images = media.images as { backdrops?: TMDbImage[] } | undefined;
  const backdrops = images?.backdrops ?? [];
  if (backdrops.length === 0) return media.backdrop_path ?? null;
  const noText = backdrops.filter((i) => i.iso_639_1 === null);
  const sorted = (noText.length > 0 ? noText : backdrops).sort(
    (a: TMDbImage, b: TMDbImage) => b.vote_average - a.vote_average
  );
  return sorted[0]?.file_path ?? media.backdrop_path ?? null;
}

function getBestLogo(media: HeroMedia): string | null {
  const images = media.images as { logos?: TMDbImage[] } | undefined;
  const logos = images?.logos ?? [];
  if (logos.length === 0) return null;
  const fr = logos.find((l: TMDbImage) => l.iso_639_1 === "fr");
  const en = logos.find((l: TMDbImage) => l.iso_639_1 === "en");
  return (fr ?? en ?? logos[0])?.file_path ?? null;
}

function getSafeTrailerKey(media: HeroMedia): string | null {
  const videos = media.videos as
    | { results?: Array<{ type: string; site: string; key: string; official: boolean }> }
    | undefined;
  if (!videos?.results?.length) return null;
  return getTrailerKey(
    videos as { results: Array<{ type: string; site: string; key: string; official: boolean }> }
  );
}

interface HeroCinematicProps {
  items: HeroMedia[];
  onPlay?: (media: HeroMedia) => void;
  /** @deprecated Utiliser le clic sur le carrousel pour aller au détail. Conservé pour compat. */
  onMoreInfo?: (media: HeroMedia) => void;
  autoRotate?: boolean;
}

const ROTATION_DURATION = 12_000;

export function HeroCinematic({
  items,
  onPlay,
  autoRotate = true,
}: HeroCinematicProps) {
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [showVideo, setShowVideo] = useState(false);
  const [progressKey, setProgressKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const active = items[activeIndex];
  const detailHref = active
    ? isMovie(active)
      ? `/film/${active.id}`
      : `/serie/${active.id}`
    : null;
  if (!active) return null;

  const title = isMovie(active) ? (active.title ?? active.name) : (active.name ?? active.title);
  const overview = active.overview ?? "";
  const backdropPath = getBestBackdrop(active);
  const logoPath = getBestLogo(active);
  const trailerKey = getSafeTrailerKey(active);

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (videoTimerRef.current) clearTimeout(videoTimerRef.current);
  }, []);

  useEffect(() => {
    if (!autoRotate || items.length <= 1) return;
    timerRef.current = setTimeout(() => {
      setActiveIndex((i) => (i + 1) % items.length);
    }, ROTATION_DURATION);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [activeIndex, autoRotate, items.length]);

  useEffect(() => {
    setProgressKey((k) => k + 1);
  }, [activeIndex]);

  useEffect(() => {
    setShowVideo(false);
    if (!trailerKey) return;
    videoTimerRef.current = setTimeout(() => setShowVideo(true), 4_000);
    return () => {
      if (videoTimerRef.current) clearTimeout(videoTimerRef.current);
    };
  }, [activeIndex, trailerKey]);

  const navigate = useCallback(
    (direction: "prev" | "next") => {
      clearTimers();
      setActiveIndex((i) =>
        direction === "next" ? (i + 1) % items.length : (i - 1 + items.length) % items.length
      );
    },
    [items.length, clearTimers]
  );

  const goTo = useCallback(
    (index: number) => {
      clearTimers();
      setActiveIndex(index);
    },
    [clearTimers]
  );

  const trailerSrc = trailerKey
    ? `https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=${muted ? 1 : 0}&controls=0&loop=1&playlist=${trailerKey}&playsinline=1&modestbranding=1&rel=0`
    : null;

  const certification = isMovie(active)
    ? active.release_dates?.results
        ?.find((r: { iso_3166_1: string }) => r.iso_3166_1 === "FR")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ?.release_dates?.find((d: any) => d.certification)?.certification
    : active.content_ratings?.results?.find(
        (r: { iso_3166_1: string }) => r.iso_3166_1 === "FR"
      )?.rating;

  const handleCarouselClick = useCallback(
    (e: React.MouseEvent) => {
      if (detailHref) router.push(detailHref);
    },
    [detailHref, router]
  );

  const handlePlayClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onPlay?.(active);
    },
    [active, onPlay]
  );

  const handleNavClick = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);
  const handleDotsClick = useCallback((e: React.MouseEvent) => e.stopPropagation(), []);

  return (
    /* ─── Container arrondi — floating stage ───────────────────── */
    <div className="relative w-full min-h-150 max-h-[88dvh] overflow-hidden rounded-[44px] bg-nemo-bg">
      {/* ─── Zone cliquable : tout le carrousel → détail film/série ── */}
      <button
        type="button"
        onClick={handleCarouselClick}
        className="absolute inset-0 z-10 cursor-pointer"
        aria-label={`Voir les détails de ${title}`}
      />

      {/* ─── Précharge backdrops + logos du suivant / précédent ─── */}
      {items.length > 1 && (
        <div className="absolute inset-0 pointer-events-none invisible" aria-hidden="true">
          {[1, -1].map((delta) => {
            const idx = (activeIndex + delta + items.length) % items.length;
            const item = items[idx];
            if (!item) return null;
            const bp = getBestBackdrop(item);
            const lp = getBestLogo(item);
            return (
              <div key={`preload-${idx}`} className="absolute inset-0">
                {bp && (
                  <Image
                    src={tmdbImage.backdrop(bp, "original") ?? ""}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="100vw"
                    priority={delta === 1}
                  />
                )}
                {lp && (
                  <Image
                    src={tmdbImage.logo(lp, "w500") ?? ""}
                    alt=""
                    width={320}
                    height={128}
                    className="object-contain"
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Fond backdrop + trailer ──────────────────────────── */}
      <AnimatePresence initial={false} mode="sync">
        <motion.div
          key={active.id}
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.99 }}
          transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          className="absolute inset-0 pointer-events-none"
        >
          {backdropPath && (
            <Image
              src={tmdbImage.backdrop(backdropPath, "original") ?? ""}
              alt=""
              fill
              priority
              className={cn(
                "object-cover object-top transition-opacity duration-700",
                showVideo && trailerKey ? "opacity-0" : "opacity-100"
              )}
              sizes="100vw"
            />
          )}

          {showVideo && trailerSrc && (
            <div className="absolute inset-0 overflow-hidden">
              <iframe
                ref={iframeRef}
                src={trailerSrc}
                title={`Bande-annonce de ${title}`}
                allow="autoplay; fullscreen"
                className="absolute inset-[-10%] w-[120%] h-[120%] border-0 pointer-events-none"
              />
            </div>
          )}

          <div className="absolute inset-0 hero-overlay" />
          <div className="absolute inset-0 hero-overlay-left" />
        </motion.div>
      </AnimatePresence>

      {/* ─── Boutons de navigation gauche / droite ─────────────── */}
      {items.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              handleNavClick(e);
              navigate("prev");
            }}
            aria-label="Précédent"
            className={cn(
              "absolute left-4 top-1/2 -translate-y-1/2 z-30",
              "flex items-center justify-center size-12",
              "glass-capsule hover:bg-white/20 transition-all duration-200",
              "opacity-60 hover:opacity-100"
            )}
          >
            <ChevronLeft className="size-6 text-white" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              handleNavClick(e);
              navigate("next");
            }}
            aria-label="Suivant"
            className={cn(
              "absolute right-4 top-1/2 -translate-y-1/2 z-30",
              "flex items-center justify-center size-12",
              "glass-capsule hover:bg-white/20 transition-all duration-200",
              "opacity-60 hover:opacity-100"
            )}
          >
            <ChevronRight className="size-6 text-white" />
          </button>
        </>
      )}

      {/* ─── Contenu : position statique en bas à gauche ────────── */}
      <div className="absolute bottom-0 left-0 right-0 z-(--z-above) pb-6 sm:pb-8 px-6 sm:px-14 lg:px-20 pt-24 pointer-events-none">
        <div className="pointer-events-auto max-w-2xl">
          <AnimatePresence initial={false} mode="sync">
            <motion.div
              key={`content-${active.id}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
              className="space-y-4"
            >
              {logoPath ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.02, duration: 0.2 }}
                  className="relative h-24 sm:h-32 w-64 sm:w-80"
                >
                  <Image
                    src={tmdbImage.logo(logoPath, "w500") ?? ""}
                    alt={title}
                    fill
                    className="object-contain object-bottom-left drop-shadow-2xl"
                    sizes="320px"
                  />
                </motion.div>
              ) : (
                <h1 className="hero-title text-white">
                  {title}
                </h1>
              )}

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.04, duration: 0.2 }}
                className="flex items-center gap-2 flex-wrap"
              >
                {certification && <span className="section-label">{certification}</span>}
                {active.vote_average > 0 && (
                  <span className="section-label text-nemo-accent! border-nemo-accent/25!">
                    ★ {active.vote_average.toFixed(1)}
                  </span>
                )}
                {active.genres?.slice(0, 3).map((g: { id: number; name: string }) => (
                  <span key={g.id} className="section-label">
                    {g.name}
                  </span>
                ))}
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.06, duration: 0.2 }}
                className="text-white/75 text-sm sm:text-base leading-relaxed line-clamp-3 text-pretty max-w-xl"
              >
                {overview}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08, duration: 0.2 }}
                className="flex items-center gap-3 flex-wrap"
              >
                <button
                  type="button"
                  onClick={handlePlayClick}
                  className="btn-accent-pill text-sm sm:text-base px-7 py-3"
                >
                  <Play className="size-4 fill-current shrink-0" />
                  Lecture
                </button>

                {showVideo && trailerKey && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMuted((m) => !m);
                    }}
                    aria-label={muted ? "Activer le son" : "Couper le son"}
                    className="flex items-center justify-center size-11 rounded-full glass-capsule hover:bg-white/15 transition-all"
                  >
                    {muted ? <VolumeX className="size-5 text-white" /> : <Volume2 className="size-5 text-white" />}
                  </button>
                )}
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ─── Indicateurs à points : position statique en bas ─────── */}
      {items.length > 1 && (
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center gap-2 pointer-events-auto"
          onClick={handleDotsClick}
          onKeyDown={(e) => e.stopPropagation()}
          role="group"
          aria-label="Position dans le carrousel"
        >
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goTo(i);
              }}
              aria-label={`Aller au contenu ${i + 1}`}
              aria-current={i === activeIndex ? "true" : undefined}
              className={cn(
                "relative h-1 rounded-full overflow-hidden transition-all duration-400",
                i === activeIndex ? "w-12 bg-white/20" : "w-4 bg-white/25 hover:bg-white/40 hover:w-6"
              )}
            >
              {i === activeIndex && autoRotate && (
                <motion.div
                  key={`progress-${progressKey}`}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: ROTATION_DURATION / 1000, ease: "linear" }}
                  style={{ transformOrigin: "left center" }}
                  className="absolute inset-0 bg-white rounded-full"
                />
              )}
              {i === activeIndex && !autoRotate && (
                <div className="absolute inset-0 bg-white rounded-full" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
