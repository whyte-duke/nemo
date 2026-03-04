"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Play,
  ThumbsUp,
  ThumbsDown,
  Star,
  Clock,
  Calendar,
  ChevronDown,
  Volume2,
  VolumeX,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { cn, formatRuntime, formatYear, truncate } from "@/lib/utils";
import { tmdbImage, getTrailerKey } from "@/lib/tmdb/client";
import { useInteraction } from "@/hooks/use-list";
import { useAuth } from "@/hooks/use-auth";
import { ListSelector } from "@/components/lists/ListSelector";
import { useItemProgress } from "@/hooks/use-watch-history";
import type { TMDbMovieDetail, TMDbTVShowDetail } from "@/types/tmdb";

type DetailMedia = TMDbMovieDetail | TMDbTVShowDetail;

function isMovie(media: DetailMedia): media is TMDbMovieDetail {
  return "title" in media;
}

interface DetailModalProps {
  media: DetailMedia | null;
  open: boolean;
  onClose: () => void;
  onPlay?: (media: DetailMedia) => void;
  mediaType: "movie" | "tv";
}

export function DetailModal({ media, open, onClose, onPlay, mediaType }: DetailModalProps) {
  const { user } = useAuth();
  const { interaction, setInteraction } = useInteraction(media?.id ?? 0, mediaType);
  const watchProgress = useItemProgress(media?.id ?? 0, mediaType);
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [castExpanded, setCastExpanded] = useState(false);
  const [trailerMuted, setTrailerMuted] = useState(true);
  const [showTrailer, setShowTrailer] = useState(false);
  const trailerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state when media changes
  useEffect(() => {
    setSynopsisExpanded(false);
    setCastExpanded(false);
    setShowTrailer(false);
    setTrailerMuted(true);
    if (trailerTimerRef.current) clearTimeout(trailerTimerRef.current);
    if (open && media) {
      // Auto-play trailer after 3s on desktop
      trailerTimerRef.current = setTimeout(() => setShowTrailer(true), 3000);
    }
    return () => {
      if (trailerTimerRef.current) clearTimeout(trailerTimerRef.current);
    };
  }, [media?.id, open]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [open, handleKeyDown]);

  if (!media) return null;

  const title = isMovie(media) ? media.title : media.name;
  const year = isMovie(media) ? formatYear(media.release_date) : formatYear(media.first_air_date);
  const runtime = isMovie(media) ? media.runtime : null;
  const trailerKey = getTrailerKey(media.videos);

  const logoPath = (() => {
    const logos = (media.images as { logos?: Array<{ iso_639_1: string | null; file_path: string }> }).logos ?? [];
    if (!logos.length) return null;
    return (
      logos.find((l) => l.iso_639_1 === "fr") ??
      logos.find((l) => l.iso_639_1 === "en") ??
      logos[0]
    )?.file_path ?? null;
  })();

  const director = isMovie(media)
    ? media.credits.crew.find((c) => c.job === "Director")
    : null;

  const topCast = media.credits.cast.slice(0, 9);

  const directorMobile = isMovie(media)
    ? media.credits.crew.find((c) => c.job === "Director")
    : media.credits.crew.find((c) => ["Creator", "Executive Producer"].includes(c.job));

  const composerMobile = media.credits.crew.find((c) => c.job === "Original Music Composer");
  const recommendations = (
    isMovie(media) ? media.recommendations?.results ?? [] : media.recommendations?.results ?? []
  ).slice(0, 6) as Array<{ id: number; poster_path: string | null; title?: string; name?: string }>;

  const trailerSrc = trailerKey
    ? `https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=${trailerMuted ? 1 : 0}&controls=0&loop=1&playlist=${trailerKey}&playsinline=1&modestbranding=1&rel=0`
    : null;

  const posterPath = media.poster_path;
  const backdropPath = media.backdrop_path;

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            {/* Overlay */}
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="fixed inset-0 z-[calc(var(--z-modal)-1)] bg-black/85 backdrop-blur-md"
                onClick={onClose}
              />
            </Dialog.Overlay>

            {/* ─── MOBILE : Bottom Sheet ──────────────────────────────── */}
            <Dialog.Content asChild aria-describedby="modal-description">
              <motion.div
                initial={{ opacity: 0, y: "100%" }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: "100%" }}
                transition={{ duration: 0.38, ease: [0.32, 0.72, 0, 1] }}
                className={cn(
                  // Mobile: bottom sheet
                  "sm:hidden fixed inset-x-0 bottom-0 z-[var(--z-modal)]",
                  "max-h-[92dvh] overflow-y-auto",
                  "rounded-t-[32px]",
                  "bg-[#10131a]",
                  "shadow-[0_-16px_64px_rgba(0,0,0,0.8),0_-1px_0_rgba(255,255,255,0.08)]",
                  "focus:outline-none"
                )}
                style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1.5rem)" }}
              >
                {/* Drag handle */}
                <div className="flex justify-center pt-3 pb-1 shrink-0">
                  <div className="w-10 h-1 rounded-full bg-white/20" />
                </div>

                {/* Bouton fermer */}
                <Dialog.Close asChild>
                  <button
                    aria-label="Fermer"
                    className="absolute top-5 right-4 z-20 flex items-center justify-center size-8 rounded-full bg-black/50 backdrop-blur-sm border border-white/10"
                  >
                    <X className="size-4 text-white" />
                  </button>
                </Dialog.Close>

                {/* ── Affiche + overlay info ── */}
                <div className="relative mx-2 rounded-2xl overflow-hidden">
                  <div className="relative aspect-[2/3] w-full max-h-[68dvh] overflow-hidden rounded-2xl">
                    {posterPath ? (
                      <Image
                        src={tmdbImage.poster(posterPath, "w500") ?? ""}
                        alt={title}
                        fill
                        priority
                        className="object-cover"
                        sizes="(max-width: 640px) calc(100vw - 1rem)"
                      />
                    ) : backdropPath ? (
                      <Image
                        src={tmdbImage.backdrop(backdropPath, "w780") ?? ""}
                        alt={title}
                        fill
                        priority
                        className="object-cover object-top"
                        sizes="(max-width: 640px) calc(100vw - 1rem)"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-nemo-surface2" />
                    )}

                    {/* Gradient bas */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#10131a] via-[#10131a]/30 to-transparent" />

                    {/* Barre progression */}
                    {watchProgress && watchProgress.progress > 0 && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
                        <div
                          className="h-full bg-nemo-accent"
                          style={{ width: `${watchProgress.progress}%`, boxShadow: "0 0 6px rgba(232,184,75,0.5)" }}
                        />
                      </div>
                    )}

                    {/* Logo ou titre overlayé */}
                    <div className="absolute bottom-3 left-4 right-12">
                      {logoPath ? (
                        <div className="relative h-10 min-[390px]:h-13 w-32 min-[390px]:w-40">
                          <Image
                            src={tmdbImage.logo(logoPath, "w500") ?? ""}
                            alt={title}
                            fill
                            className="object-contain object-bottom-left drop-shadow-2xl"
                            sizes="160px"
                          />
                        </div>
                      ) : (
                        <h2 className="text-white font-black text-base min-[390px]:text-xl leading-tight drop-shadow-2xl">
                          {title}
                        </h2>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Meta compacte ── */}
                <div className="px-4 pt-1.5 pb-0.5 flex items-center gap-3 flex-wrap">
                  {media.vote_average > 0 && (
                    <span className="flex items-center gap-1 text-nemo-accent font-bold text-sm">
                      <Star className="size-3.5 fill-current" />
                      {media.vote_average.toFixed(1)}
                    </span>
                  )}
                  {year && <span className="text-white/50 text-sm">{year}</span>}
                  {runtime && (
                    <span className="text-white/50 text-sm">{formatRuntime(runtime)}</span>
                  )}
                  {!isMovie(media) && (
                    <span className="text-white/50 text-sm">
                      {media.number_of_seasons} saison{media.number_of_seasons > 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                {/* ── Boutons d'action mobile ── */}
                <div className="px-4 pb-1.5 flex items-center gap-2">
                  <button
                    onClick={() => onPlay?.(media)}
                    className="flex-1 flex items-center justify-center gap-2 bg-white hover:bg-white/90 active:scale-95 text-black font-bold py-2.5 rounded-xl transition-all text-sm"
                  >
                    <Play className="size-4 fill-black shrink-0" />
                    {watchProgress && watchProgress.progress > 5 ? "Reprendre" : "Lecture"}
                  </button>

                  {user && (
                    <>
                      <ListSelector tmdbId={media.id} mediaType={mediaType} size="md" />
                      <button
                        onClick={() => setInteraction(interaction === "like" ? null : "like")}
                        aria-label="J'aime"
                        className={cn(
                          "flex items-center justify-center size-10 rounded-xl border transition-all active:scale-95",
                          interaction === "like"
                            ? "bg-nemo-accent/20 border-nemo-accent text-nemo-accent"
                            : "border-white/20 glass text-white/70"
                        )}
                      >
                        <ThumbsUp className="size-4" />
                      </button>
                    </>
                  )}
                </div>

                {/* ── Genres chips ── */}
                {media.genres && media.genres.length > 0 && (
                  <div className="px-4 pb-1 flex gap-2 overflow-x-auto scrollbar-none">
                    {media.genres.slice(0, 5).map((g) => (
                      <span
                        key={g.id}
                        className="shrink-0 px-3 py-1 glass rounded-full text-white/60 text-xs font-medium border border-white/10"
                      >
                        {g.name}
                      </span>
                    ))}
                  </div>
                )}

                {/* ── Réalisateur / Créateur mobile ── */}
                {directorMobile && (
                  <div className="px-4 pb-1 flex gap-2 text-xs">
                    <span className="text-white/35 shrink-0">
                      {isMovie(media) ? "Réal." : "Créateur"}
                    </span>
                    <Link
                      href={`/acteur/${directorMobile.id}`}
                      onClick={onClose}
                      className="text-white/70 hover:text-nemo-accent transition-colors truncate"
                    >
                      {directorMobile.name}
                    </Link>
                  </div>
                )}
                {composerMobile && (
                  <div className="px-4 pb-1 flex gap-2 text-xs">
                    <span className="text-white/35 shrink-0">Musique</span>
                    <span className="text-white/70 truncate">{composerMobile.name}</span>
                  </div>
                )}

                {/* ── Synopsis condensé ── */}
                {media.overview && (
                  <div className="px-4 pb-2">
                    <p className={cn(
                      "text-white/60 text-xs leading-relaxed text-pretty transition-all",
                      !synopsisExpanded && "line-clamp-2"
                    )}>
                      {media.overview}
                    </p>
                    <button
                      onClick={() => setSynopsisExpanded(!synopsisExpanded)}
                      className="text-nemo-accent text-xs font-semibold mt-0.5 flex items-center gap-1"
                    >
                      {synopsisExpanded ? "Moins" : "Voir plus"}
                      <ChevronDown className={cn("size-3 transition-transform", synopsisExpanded && "rotate-180")} />
                    </button>
                  </div>
                )}

                {/* ── Casting mobile (4 cols, expandable) ── */}
                {topCast.length > 0 && (
                  <div className="px-4 pb-3">
                    <h3 className="text-white/40 text-[10px] font-semibold uppercase tracking-widest mb-2">Avec</h3>
                    <div className="grid grid-cols-4 gap-2">
                      {(castExpanded ? topCast : topCast.slice(0, 4)).map((actor) => (
                        <Link
                          key={actor.id}
                          href={`/acteur/${actor.id}`}
                          onClick={onClose}
                          className="group/actor text-center"
                        >
                          <div className="relative size-14 rounded-full overflow-hidden mx-auto mb-1 bg-nemo-surface2 ring-1 ring-white/10">
                            {actor.profile_path ? (
                              <Image
                                src={tmdbImage.profile(actor.profile_path, "w185") ?? ""}
                                alt={actor.name}
                                fill
                                className="object-cover group-hover/actor:scale-110 transition-transform duration-200"
                                sizes="56px"
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-white/20 text-base">{actor.name.charAt(0)}</span>
                              </div>
                            )}
                          </div>
                          <p className="text-white/60 text-[9px] font-medium truncate leading-tight px-0.5">
                            {actor.name.split(" ")[0]}
                          </p>
                        </Link>
                      ))}
                    </div>
                    {topCast.length > 4 && (
                      <button
                        onClick={() => setCastExpanded((v) => !v)}
                        className="mt-2 text-nemo-accent text-xs font-semibold flex items-center gap-1"
                      >
                        {castExpanded ? "Voir moins" : `+ ${topCast.length - 4} acteurs de plus`}
                        <ChevronDown className={cn("size-3 transition-transform", castExpanded && "rotate-180")} />
                      </button>
                    )}
                  </div>
                )}

                {/* ── Recommandations mobile ── */}
                {recommendations.length > 0 && (
                  <div className="px-4 pb-4">
                    <h3 className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-3">Similaires</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {recommendations.slice(0, 6).map((rec) => (
                        <Link
                          key={rec.id}
                          href={mediaType === "movie" ? `/film/${rec.id}` : `/serie/${rec.id}`}
                          onClick={onClose}
                          className="group/rec"
                        >
                          <div className="relative rounded-xl overflow-hidden aspect-[2/3] bg-nemo-surface2">
                            {rec.poster_path && (
                              <Image
                                src={tmdbImage.poster(rec.poster_path, "w185") ?? ""}
                                alt={rec.title ?? rec.name ?? ""}
                                fill
                                className="object-cover group-hover/rec:scale-105 transition-transform duration-200"
                                sizes="120px"
                              />
                            )}
                          </div>
                          <p className="text-white/50 text-[10px] mt-1 truncate">{rec.title ?? rec.name}</p>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            </Dialog.Content>

            {/* ─── DESKTOP : Centered Modal ────────────────────────────── */}
            <Dialog.Content asChild aria-describedby="modal-description-desktop">
              <motion.div
                initial={{ opacity: 0, y: 32, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 32, scale: 0.97 }}
                transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                className={cn(
                  // Desktop only
                  "hidden sm:block",
                  "fixed left-1/2 -translate-x-1/2 top-8 z-[var(--z-modal)]",
                  "w-[720px] max-h-[90dvh] overflow-y-auto",
                  "rounded-2xl bg-[#13161d]",
                  "shadow-[0_32px_80px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.08)]",
                  "focus:outline-none"
                )}
              >
                {/* Bouton fermer */}
                <Dialog.Close asChild>
                  <button
                    aria-label="Fermer"
                    className="absolute top-4 right-4 z-20 flex items-center justify-center size-9 rounded-full bg-black/60 hover:bg-black/80 glass transition-all hover:scale-110 active:scale-95 border border-white/10"
                  >
                    <X className="size-5 text-white" />
                  </button>
                </Dialog.Close>

                {/* Header visuel avec trailer auto */}
                <div className="relative h-72 sm:h-80 bg-[#0b0d12] overflow-hidden rounded-t-2xl">
                  {backdropPath && (
                    <Image
                      src={tmdbImage.backdrop(backdropPath, "w1280") ?? ""}
                      alt=""
                      fill
                      className={cn(
                        "object-cover transition-opacity duration-700",
                        showTrailer && trailerKey ? "opacity-0" : "opacity-100"
                      )}
                      sizes="720px"
                    />
                  )}

                  {/* Trailer auto-play desktop */}
                  {showTrailer && trailerSrc && (
                    <div className="absolute inset-0 overflow-hidden">
                      <iframe
                        src={trailerSrc}
                        title={`Bande-annonce de ${title}`}
                        allow="autoplay; fullscreen"
                        className="absolute inset-[-10%] w-[120%] h-[120%] border-0 pointer-events-none"
                      />
                    </div>
                  )}

                  <div className="absolute inset-0 hero-overlay" />

                  {/* Barre de progression */}
                  {watchProgress && watchProgress.progress > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/15">
                      <div
                        className="h-full bg-nemo-accent transition-all"
                        style={{ width: `${watchProgress.progress}%` }}
                      />
                    </div>
                  )}

                  {/* Logo/titre + actions */}
                  <div className="absolute bottom-5 left-6 right-14 space-y-3">
                    <Dialog.Title>
                      {logoPath ? (
                        <div className="relative h-16 w-48">
                          <Image
                            src={tmdbImage.logo(logoPath, "w500") ?? ""}
                            alt={title}
                            fill
                            className="object-contain object-bottom-left drop-shadow-2xl"
                            sizes="192px"
                          />
                        </div>
                      ) : (
                        <h2 className="hero-title text-white text-2xl">{title}</h2>
                      )}
                    </Dialog.Title>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => onPlay?.(media)}
                        className="flex items-center gap-2 bg-white hover:bg-white/90 active:scale-95 text-black font-bold px-5 py-2.5 rounded-xl transition-all text-sm shadow-lg"
                      >
                        <Play className="size-4 fill-black" />
                        {watchProgress && watchProgress.progress > 5 ? "Reprendre" : "Lecture"}
                      </button>

                      {showTrailer && trailerKey && (
                        <button
                          onClick={() => setTrailerMuted((m) => !m)}
                          aria-label={trailerMuted ? "Activer le son" : "Couper le son"}
                          className="flex items-center justify-center size-10 rounded-xl glass-capsule hover:bg-white/15 transition-all"
                        >
                          {trailerMuted ? <VolumeX className="size-4 text-white" /> : <Volume2 className="size-4 text-white" />}
                        </button>
                      )}

                      {user && (
                        <>
                          <ListSelector tmdbId={media.id} mediaType={mediaType} size="md" />
                          <button
                            onClick={() => setInteraction(interaction === "like" ? null : "like")}
                            aria-label="J'aime"
                            className={cn(
                              "flex items-center justify-center size-10 rounded-full border transition-all active:scale-95",
                              interaction === "like"
                                ? "bg-nemo-accent/20 border-nemo-accent"
                                : "border-white/40 hover:border-white/70 glass"
                            )}
                          >
                            <ThumbsUp className={cn("size-4.5", interaction === "like" ? "text-nemo-accent" : "text-white")} />
                          </button>
                          <button
                            onClick={() => setInteraction(interaction === "dislike" ? null : "dislike")}
                            aria-label="Je n'aime pas"
                            className={cn(
                              "flex items-center justify-center size-10 rounded-full border transition-all active:scale-95",
                              interaction === "dislike" ? "bg-white/10 border-white/60" : "border-white/40 hover:border-white/70 glass"
                            )}
                          >
                            <ThumbsDown className="size-4.5 text-white" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Corps desktop */}
                <div className="p-6 space-y-5">
                  {/* Méta */}
                  <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-sm">
                    {media.vote_average > 0 && (
                      <span className="flex items-center gap-1 text-nemo-accent font-semibold">
                        <Star className="size-4 fill-current" />
                        {media.vote_average.toFixed(1)}
                      </span>
                    )}
                    {year && (
                      <span className="flex items-center gap-1 text-white/60">
                        <Calendar className="size-4" />
                        {year}
                      </span>
                    )}
                    {runtime && (
                      <span className="flex items-center gap-1 text-white/60">
                        <Clock className="size-4" />
                        {formatRuntime(runtime)}
                      </span>
                    )}
                    {!isMovie(media) && (
                      <span className="text-white/60">
                        {media.number_of_seasons} saison{media.number_of_seasons > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  <div id="modal-description-desktop">
                    <p className="text-white/80 text-sm leading-relaxed text-pretty">
                      {media.overview ?? "Aucun synopsis disponible."}
                    </p>
                  </div>

                  {media.genres && media.genres.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {media.genres.map((g) => (
                        <span key={g.id} className="px-3 py-1 glass rounded-full text-white/70 text-xs border border-white/10">
                          {g.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {director && (
                    <p className="text-white/50 text-sm">
                      <span className="text-white/30">Réalisateur : </span>
                      <span className="text-white/70">{director.name}</span>
                    </p>
                  )}

                  {topCast.length > 0 && (
                    <div>
                      <h3 className="text-white font-semibold text-sm mb-3 uppercase tracking-widest text-white/40">Casting</h3>
                      <div className="grid grid-cols-8 gap-3">
                        {topCast.slice(0, 8).map((actor) => (
                          <Link key={actor.id} href={`/acteur/${actor.id}`} onClick={onClose} className="group/actor text-center">
                            <div className="relative size-14 rounded-full overflow-hidden mx-auto mb-1.5 bg-nemo-surface2">
                              {actor.profile_path ? (
                                <Image
                                  src={tmdbImage.profile(actor.profile_path, "w185") ?? ""}
                                  alt={actor.name}
                                  fill
                                  className="object-cover group-hover/actor:scale-110 transition-transform duration-200"
                                  sizes="56px"
                                />
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <span className="text-white/20 text-xl">{actor.name.charAt(0)}</span>
                                </div>
                              )}
                            </div>
                            <p className="text-white/80 text-xs font-medium truncate group-hover/actor:text-white transition-colors">
                              {actor.name}
                            </p>
                            <p className="text-white/40 text-xs truncate">{truncate(actor.character, 14)}</p>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {recommendations.length > 0 && (
                    <div>
                      <h3 className="text-white font-semibold text-sm mb-3 uppercase tracking-widest text-white/40">Titres similaires</h3>
                      <div className="grid grid-cols-6 gap-2">
                        {recommendations.map((rec) => (
                          <Link
                            key={rec.id}
                            href={mediaType === "movie" ? `/film/${rec.id}` : `/serie/${rec.id}`}
                            onClick={onClose}
                            className="group/rec"
                          >
                            <div className="relative rounded-xl overflow-hidden aspect-[2/3] bg-nemo-surface2">
                              {rec.poster_path && (
                                <Image
                                  src={tmdbImage.poster(rec.poster_path, "w185") ?? ""}
                                  alt={rec.title ?? rec.name ?? ""}
                                  fill
                                  className="object-cover group-hover/rec:scale-105 transition-transform duration-200"
                                  sizes="120px"
                                />
                              )}
                            </div>
                            <p className="text-white/60 text-xs mt-1.5 truncate group-hover/rec:text-white transition-colors">
                              {rec.title ?? rec.name}
                            </p>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
