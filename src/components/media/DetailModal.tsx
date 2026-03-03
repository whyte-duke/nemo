"use client";

import { useEffect, useRef, useCallback } from "react";
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
  const backdropRef = useRef<HTMLDivElement>(null);

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
  const year = isMovie(media)
    ? formatYear(media.release_date)
    : formatYear(media.first_air_date);
  const runtime = isMovie(media) ? media.runtime : null;
  const trailerKey = getTrailerKey(media.videos);

  const director = isMovie(media)
    ? media.credits.crew.find((c) => c.job === "Director")
    : null;

  const topCast = media.credits.cast.slice(0, 8);
  const recommendations = (
    isMovie(media) ? media.recommendations?.results ?? [] : media.recommendations?.results ?? []
  ).slice(0, 6) as Array<{ id: number; poster_path: string | null; title?: string; name?: string }>;

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
                className="fixed inset-0 z-[var(--z-modal)] bg-black/80 backdrop-blur-sm"
                onClick={onClose}
              />
            </Dialog.Overlay>

            {/* Modal */}
            <Dialog.Content asChild aria-describedby="modal-description">
              <motion.div
                initial={{ opacity: 0, y: 40, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 40, scale: 0.97 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="fixed inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 top-4 sm:top-8 bottom-4 sm:bottom-auto z-[var(--z-modal)] w-full sm:w-[720px] max-h-[90dvh] overflow-y-auto rounded-2xl bg-[#13161d] shadow-2xl focus:outline-none"
              >
                {/* Bouton fermer */}
                <Dialog.Close asChild>
                  <button
                    aria-label="Fermer"
                    className="absolute top-4 right-4 z-10 flex items-center justify-center size-9 rounded-full bg-black/60 hover:bg-black/80 glass transition-colors"
                  >
                    <X className="size-5 text-white" />
                  </button>
                </Dialog.Close>

                {/* Header visuel */}
                <div ref={backdropRef} className="relative h-72 sm:h-80 bg-[#0b0d12]">
                  {media.backdrop_path && (
                    <Image
                      src={tmdbImage.backdrop(media.backdrop_path, "w1280") ?? ""}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="720px"
                    />
                  )}
                  <div className="absolute inset-0 hero-overlay" />

                  {/* Barre de progression si en cours */}
                  {watchProgress && watchProgress.progress > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/20">
                      <div
                        className="h-full bg-[#e8b84b]"
                        style={{ width: `${watchProgress.progress}%` }}
                      />
                    </div>
                  )}

                  {/* Titre/logo et actions — même style que le hero carrousel */}
                  <div className="absolute bottom-6 left-6 right-14">
                    <Dialog.Title className="hero-title text-white mb-3">
                      {title}
                    </Dialog.Title>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => onPlay?.(media)}
                        className="flex items-center gap-2 bg-white hover:bg-white/90 text-black font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm"
                      >
                        <Play className="size-4 fill-black" />
                        {watchProgress && watchProgress.progress > 5 ? "Reprendre" : "Lecture"}
                      </button>

                      {user && (
                        <>
                          <ListSelector tmdbId={media.id} mediaType={mediaType} size="md" />

                          <button
                            onClick={() =>
                              setInteraction(interaction === "like" ? null : "like")
                            }
                            aria-label="J'aime"
                            className={cn(
                              "flex items-center justify-center size-10 rounded-full border transition-colors",
                              interaction === "like"
                                ? "bg-[#e8b84b]/20 border-[#e8b84b]"
                                : "border-white/40 hover:border-white/70 glass"
                            )}
                          >
                            <ThumbsUp
                              className={cn(
                                "size-5",
                                interaction === "like" ? "text-[#e8b84b]" : "text-white"
                              )}
                            />
                          </button>

                          <button
                            onClick={() =>
                              setInteraction(interaction === "dislike" ? null : "dislike")
                            }
                            aria-label="Je n'aime pas"
                            className={cn(
                              "flex items-center justify-center size-10 rounded-full border transition-colors",
                              interaction === "dislike"
                                ? "bg-white/10 border-white/60"
                                : "border-white/40 hover:border-white/70 glass"
                            )}
                          >
                            <ThumbsDown className="size-5 text-white" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Corps du modal */}
                <div className="p-6 space-y-6">
                  {/* Métadonnées */}
                  <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-sm">
                    {media.vote_average > 0 && (
                      <span className="flex items-center gap-1 text-[#e8b84b] font-semibold">
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

                  {/* Synopsis */}
                  <div id="modal-description">
                    <p className="text-white/80 text-sm leading-relaxed text-pretty">
                      {media.overview ?? "Aucun synopsis disponible."}
                    </p>
                  </div>

                  {/* Genres */}
                  {media.genres && media.genres.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {media.genres.map((g) => (
                        <span
                          key={g.id}
                          className="px-3 py-1 glass rounded-full text-white/70 text-xs"
                        >
                          {g.name}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Réalisateur */}
                  {director && (
                    <p className="text-white/50 text-sm">
                      <span className="text-white/30">Réalisateur : </span>
                      <span className="text-white/70">{director.name}</span>
                    </p>
                  )}

                  {/* Trailer */}
                  {trailerKey && (
                    <div>
                      <h3 className="text-white font-semibold text-base mb-3">Bande-annonce</h3>
                      <div className="relative rounded-xl overflow-hidden aspect-video bg-black">
                        <iframe
                          src={`https://www.youtube.com/embed/${trailerKey}?rel=0&modestbranding=1`}
                          title={`Bande-annonce de ${title}`}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="absolute inset-0 w-full h-full"
                        />
                      </div>
                    </div>
                  )}

                  {/* Casting */}
                  {topCast.length > 0 && (
                    <div>
                      <h3 className="text-white font-semibold text-base mb-3">Casting</h3>
                      <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
                        {topCast.map((actor) => (
                          <Link
                            key={actor.id}
                            href={`/acteur/${actor.id}`}
                            onClick={onClose}
                            className="group/actor text-center"
                          >
                            <div className="relative size-16 rounded-full overflow-hidden mx-auto mb-1.5 bg-[#1a1e28]">
                              {actor.profile_path ? (
                                <Image
                                  src={tmdbImage.profile(actor.profile_path, "w185") ?? ""}
                                  alt={actor.name}
                                  fill
                                  className="object-cover group-hover/actor:scale-105 transition-transform duration-200"
                                  sizes="64px"
                                />
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <span className="text-white/20 text-xl">
                                    {actor.name.charAt(0)}
                                  </span>
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

                  {/* Recommandations */}
                  {recommendations.length > 0 && (
                    <div>
                      <h3 className="text-white font-semibold text-base mb-3">
                        Titres similaires
                      </h3>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                        {recommendations.map((rec) => (
                          <Link
                            key={rec.id}
                            href={mediaType === "movie" ? `/film/${rec.id}` : `/serie/${rec.id}`}
                            onClick={onClose}
                            className="group/rec"
                          >
                            <div className="relative rounded-lg overflow-hidden aspect-[2/3] bg-[#1a1e28]">
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
