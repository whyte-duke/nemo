"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Play, Plus, Check, CheckCircle2, Clock, Calendar, ThumbsUp, ThumbsDown, Clapperboard, Info, X, Loader2 } from "lucide-react";
import { JellyfinIcon } from "@/components/icons/JellyfinIcon";
import { motion, AnimatePresence } from "motion/react";
import { cn, formatRuntime, formatYear } from "@/lib/utils";
import { tmdbImage, getTrailerKey } from "@/lib/tmdb/client";
import { MediaRow } from "./MediaRow";
import { StreamModal } from "@/components/player/StreamModal";
import { NemoPlayer } from "@/components/player/NemoPlayer";
import { saveLastStream, getLastStream } from "@/lib/player/last-stream";
import { useIsInMyList, useToggleMyList, useInteraction } from "@/hooks/use-list";
import { useItemProgress, useMarkAsWatched, isMovieWatched } from "@/hooks/use-watch-history";
import { useAuth } from "@/hooks/use-auth";
import { useJellyfinLibraryCheck } from "@/hooks/use-jellyfin-library";
import { useStream } from "@/providers/stream-provider";
import { StreamingServices } from "@/components/media/StreamingServices";
import { useStreamingAvailability } from "@/hooks/use-streaming-availability";
import { useStreamingPreferences, filterStreamingOptions } from "@/hooks/use-streaming-preferences";
import { useItemRecommendation } from "@/lib/recommendations/context";
import type { TMDbMovieDetail } from "@/types/tmdb";

interface Props {
  movie: TMDbMovieDetail;
}

export function MovieDetailContent({ movie }: Props) {
  const [watchOpen, setWatchOpen] = useState(false);
  const [activeStream, setActiveStream] = useState<{ url: string; startTime?: number } | null>(null);
  const [showTrailer, setShowTrailer] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const { user } = useAuth();
  const { resolveStreams } = useStream();
  const isInList = useIsInMyList(movie.id, "movie");
  const { mutate: toggleList } = useToggleMyList();
  const { interaction, setInteraction } = useInteraction(movie.id, "movie");
  const watchProgress = useItemProgress(movie.id, "movie");
  const { mutateAsync: markAsWatched, isPending: isMarkingWatched } = useMarkAsWatched();
  const movieWatched = isMovieWatched(watchProgress);
  const { data: jellyfinLibrary } = useJellyfinLibraryCheck(movie.id, "movie");
  const { data: rawStreamingOptions } = useStreamingAvailability(movie.imdb_id);
  const streamingPrefs = useStreamingPreferences();
  const streamingOptions = rawStreamingOptions
    ? filterStreamingOptions(rawStreamingOptions, streamingPrefs)
    : undefined;

  const recommendation = useItemRecommendation(movie.id, "movie");
  const trailerKey = getTrailerKey(movie.videos);
  const topCast = movie.credits.cast.slice(0, 12);

  // Pre-fetch streams in background as soon as the page loads
  useEffect(() => {
    if (movie.imdb_id) {
      void resolveStreams(movie.imdb_id, "movie");
    }
  }, [movie.imdb_id, resolveStreams]);

  const resumeTime = watchProgress
    ? ((watchProgress as { last_position_seconds?: number | null }).last_position_seconds ??
        (watchProgress.progress > 0 && watchProgress.duration
          ? Math.floor((watchProgress.progress / 100) * watchProgress.duration)
          : 0))
    : 0;

  const handlePlay = useCallback(() => {
    const hasProgress = watchProgress && watchProgress.progress > 5;
    const lastUrl = hasProgress ? getLastStream(movie.id, "movie") : null;
    if (lastUrl) {
      setActiveStream({ url: lastUrl, startTime: resumeTime });
    } else {
      setWatchOpen(true);
    }
  }, [movie.id, watchProgress, resumeTime]);

  const backdropPath =
    movie.images.backdrops.find((b) => !b.iso_639_1)?.file_path ?? movie.backdrop_path;
  const logoPath = (
    movie.images.logos.find((l) => l.iso_639_1 === "fr") ??
    movie.images.logos.find((l) => l.iso_639_1 === "en")
  )?.file_path;

  if (activeStream) {
    return (
      <div className="fixed inset-0 z-(--z-overlay) bg-black">
        <NemoPlayer
          url={activeStream.url}
          tmdbId={movie.id}
          mediaType="movie"
          title={movie.title}
          startTime={activeStream.startTime}
          onBack={() => setActiveStream(null)}
          onChangeSource={() => { setActiveStream(null); setWatchOpen(true); }}
          className="w-full h-full"
        />
      </div>
    );
  }

  return (
    <article className="bg-nemo-bg min-h-dvh">
      {/* ── Hero backdrop ─────────────────────────────────────── */}
      <div className="relative h-[70dvh] min-h-125 max-h-187.5 overflow-hidden">
        {backdropPath && (
          <Image
            src={tmdbImage.backdrop(backdropPath, "original") ?? ""}
            alt=""
            fill
            priority
            className="object-cover object-top"
            sizes="100vw"
          />
        )}
        <div className="absolute inset-0 hero-overlay" />
        <div className="absolute inset-0 hero-overlay-left" />

        {/* ── Overlay bande-annonce sur le hero ── */}
        <AnimatePresence>
          {showTrailer && trailerKey && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 z-20 bg-black"
            >
              <iframe
                src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&rel=0&modestbranding=1`}
                title={`Bande-annonce — ${movie.title}`}
                allow="autoplay; fullscreen"
                className="absolute inset-0 w-full h-full border-0"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bouton fermer au-dessus de l’iframe pour que les clics ne soient pas captés par YouTube */}
        {showTrailer && trailerKey && (
          <div className="absolute inset-0 z-30 pointer-events-none">
            <button
              type="button"
              onClick={() => setShowTrailer(false)}
              aria-label="Fermer la bande-annonce"
              className="absolute top-4 right-4 pointer-events-auto flex items-center justify-center size-9 rounded-full bg-black/70 text-white hover:bg-black/90 transition-colors backdrop-blur-sm"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        <div className="absolute bottom-10 left-6 sm:left-12 lg:left-20 max-w-2xl space-y-4 z-10">
          {logoPath ? (
            <div className="relative h-20 sm:h-28 w-56 sm:w-72">
              <Image
                src={tmdbImage.logo(logoPath, "w500") ?? ""}
                alt={movie.title}
                fill
                className="object-contain object-bottom-left"
                sizes="288px"
              />
            </div>
          ) : (
            <h1 className="text-4xl sm:text-5xl font-black text-white text-balance leading-tight">
              {movie.title}
            </h1>
          )}

          {/* Méta capsules */}
          <div className="flex items-center flex-wrap gap-2">
            {movie.vote_average > 0 && (
              <span className="section-label text-nemo-accent! border-nemo-accent/25!">
                ★ {movie.vote_average.toFixed(1)}
              </span>
            )}
            <span className="section-label flex items-center gap-1">
              <Calendar className="size-3" />
              {formatYear(movie.release_date)}
            </span>
            {movie.runtime && (
              <span className="section-label flex items-center gap-1">
                <Clock className="size-3" />
                {formatRuntime(movie.runtime)}
              </span>
            )}
            {movie.genres.slice(0, 3).map((g) => (
              <span key={g.id} className="section-label">
                {g.name}
              </span>
            ))}
            {user && jellyfinLibrary?.inLibrary && (
              <span
                className="section-label flex items-center gap-1.5 border-[#00A4DC]/40"
                style={{ color: "#00A4DC" }}
              >
                <JellyfinIcon className="size-3.5 shrink-0" />
                Disponible sur Jellyfin
              </span>
            )}
            {recommendation && recommendation.score > 0.65 && (
              <span className={cn(
                "section-label flex items-center gap-1",
                recommendation.reason_type === "taste_match" ? "text-nemo-accent! border-nemo-accent/30!" :
                recommendation.reason_type === "social" ? "text-blue-300! border-blue-400/30!" :
                "text-amber-300! border-amber-400/30!"
              )}>
                {recommendation.reason_type === "taste_match" && recommendation.score > 0.80 ? "✦ Vous allez adorer" :
                 recommendation.reason_type === "taste_match" ? "✦ Pour vous" :
                 recommendation.reason_type === "social" ? "👥 Vos amis ont aimé" :
                 "⭐ Pépite"}
              </span>
            )}
          </div>

          {/* Synopsis court dans le hero */}
          {movie.overview && (
            <p className="text-white/75 text-sm leading-relaxed line-clamp-3 text-pretty max-w-xl">
              {movie.overview}
            </p>
          )}

          {/* Boutons */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={handlePlay}
              className="btn-accent-pill px-7 py-3"
              aria-label={movieWatched ? "Revoir le film" : watchProgress && watchProgress.progress > 5 ? "Reprendre" : "Lecture"}
            >
              {movieWatched ? (
                <CheckCircle2 className="size-4 fill-current shrink-0" />
              ) : (
                <Play className="size-4 fill-current shrink-0" />
              )}
              {movieWatched ? "Vu" : watchProgress && watchProgress.progress > 5 ? "Reprendre" : "Lecture"}
            </button>

            {user && !movieWatched && (
              <button
                type="button"
                onClick={() => markAsWatched({ tmdbId: movie.id, mediaType: "movie" })}
                disabled={isMarkingWatched}
                aria-label="Marquer comme vu"
                className={cn(
                  "flex items-center justify-center size-11 rounded-full border transition-all",
                  "glass border-white/30 hover:border-white/60 text-white disabled:opacity-50"
                )}
              >
                {isMarkingWatched ? (
                  <Loader2 className="size-5 animate-spin" aria-hidden />
                ) : (
                  <CheckCircle2 className="size-5" />
                )}
              </button>
            )}

            {trailerKey && (
              <button
                onClick={() => setShowTrailer(true)}
                aria-label="Bande-annonce"
                className="flex items-center justify-center size-11 rounded-full border border-white/30 hover:border-white/60 glass text-white transition-all"
              >
                <Clapperboard className="size-5" />
              </button>
            )}

            {user && (
              <>
                <button
                  onClick={() =>
                    toggleList({
                      tmdbId: movie.id,
                      mediaType: "movie",
                      action: isInList ? "remove" : "add",
                    })
                  }
                  aria-label={isInList ? "Retirer de Ma Liste" : "Ajouter à Ma Liste"}
                  className={cn(
                    "flex items-center justify-center size-11 rounded-full border transition-all",
                    isInList
                      ? "bg-nemo-accent/20 border-nemo-accent text-nemo-accent"
                      : "glass border-white/30 hover:border-white/60 text-white"
                  )}
                >
                  {isInList ? <Check className="size-5" /> : <Plus className="size-5" />}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setInteraction(interaction === "like" ? null : "like")}
                    aria-label="J'aime"
                    className={cn(
                      "flex items-center justify-center size-11 rounded-full border transition-all",
                      interaction === "like"
                        ? "bg-nemo-accent/20 border-nemo-accent text-nemo-accent"
                        : "glass border-white/30 hover:border-white/60 text-white"
                    )}
                  >
                    <ThumbsUp className="size-5" />
                  </button>
                  <button
                    onClick={() => setInteraction(interaction === "dislike" ? null : "dislike")}
                    aria-label="Je n'aime pas"
                    className={cn(
                      "flex items-center justify-center size-11 rounded-full border transition-all",
                      interaction === "dislike"
                        ? "glass border-white/60 text-white/70"
                        : "glass border-white/30 hover:border-white/60 text-white"
                    )}
                  >
                    <ThumbsDown className="size-5" />
                  </button>
                </div>
              </>
            )}

            {/* Bouton info — affiche les détails techniques */}
            <button
              onClick={() => setShowInfo((o) => !o)}
              aria-label="Informations supplémentaires"
              aria-pressed={showInfo}
              className={cn(
                "flex items-center justify-center size-11 rounded-full border transition-all",
                showInfo
                  ? "bg-white/15 border-white/60 text-white"
                  : "glass border-white/30 hover:border-white/60 text-white/70 hover:text-white"
              )}
            >
              <Info className="size-5" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Corps ─────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-6 sm:px-12 py-10 space-y-12">
        {/* Poster + panneau info (visible seulement si showInfo) */}
        <div className="flex flex-col sm:flex-row gap-8 items-start">

          {/* ── Infos détaillées — visibles uniquement via bouton (i) ── */}
          <AnimatePresence>
            {showInfo && (
              <motion.div
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                className="flex-1 min-w-0 glass-tile rounded-2xl px-6 py-5 space-y-4"
              >
                {movie.tagline && (
                  <p className="text-nemo-accent italic text-base">&ldquo;{movie.tagline}&rdquo;</p>
                )}

                <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
                  {movie.credits.crew.find((c) => c.job === "Director") && (
                    <>
                      <dt className="text-white/40">Réalisateur</dt>
                      <dd>
                        <Link
                          href={`/acteur/${movie.credits.crew.find((c) => c.job === "Director")!.id}`}
                          className="text-white hover:text-nemo-accent transition-colors"
                        >
                          {movie.credits.crew.find((c) => c.job === "Director")!.name}
                        </Link>
                      </dd>
                    </>
                  )}
                  {movie.credits.crew.filter((c) =>
                    ["Writer", "Screenplay"].includes(c.job)
                  ).length > 0 && (
                    <>
                      <dt className="text-white/40">Scénario</dt>
                      <dd className="text-white/75">
                        {movie.credits.crew
                          .filter((c) => ["Writer", "Screenplay"].includes(c.job))
                          .slice(0, 3)
                          .map((w) => w.name)
                          .join(", ")}
                      </dd>
                    </>
                  )}
                  {movie.production_companies?.length > 0 && (
                    <>
                      <dt className="text-white/40">Production</dt>
                      <dd className="text-white/75">
                        {movie.production_companies.slice(0, 2).map((c) => c.name).join(", ")}
                      </dd>
                    </>
                  )}
                  {movie.original_language && (
                    <>
                      <dt className="text-white/40">Langue originale</dt>
                      <dd className="text-white/75">{movie.original_language.toUpperCase()}</dd>
                    </>
                  )}
                  {(movie.budget ?? 0) > 0 && (
                    <>
                      <dt className="text-white/40">Budget</dt>
                      <dd className="text-white/75">{new Intl.NumberFormat("fr-FR", { style: "currency", currency: "USD", notation: "compact" }).format(movie.budget!)}</dd>
                    </>
                  )}
                  {(movie.revenue ?? 0) > 0 && (
                    <>
                      <dt className="text-white/40">Recettes</dt>
                      <dd className="text-white/75">{new Intl.NumberFormat("fr-FR", { style: "currency", currency: "USD", notation: "compact" }).format(movie.revenue!)}</dd>
                    </>
                  )}
                </dl>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Casting ── */}
        {topCast.length > 0 && (
          <section>
            <h2 className="text-white font-semibold text-lg mb-5 flex items-center gap-3">
              Casting principal
              <span className="section-label">{topCast.length}</span>
            </h2>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-3">
              {topCast.map((actor) => (
                <motion.div key={actor.id} whileHover={{ y: -4 }} transition={{ duration: 0.15 }}>
                  <Link href={`/acteur/${actor.id}`} className="block text-center group">
                    <div className="relative size-14 sm:size-16 rounded-full overflow-hidden mx-auto mb-2 bg-nemo-surface2 ring-1 ring-white/8">
                      {actor.profile_path ? (
                        <Image
                          src={tmdbImage.profile(actor.profile_path, "w185") ?? ""}
                          alt={actor.name}
                          fill
                          className="object-cover"
                          sizes="64px"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-white/20 text-xl font-bold">
                          {actor.name.charAt(0)}
                        </div>
                      )}
                    </div>
                    <p className="text-white/75 text-xs font-medium truncate group-hover:text-white transition-colors">
                      {actor.name}
                    </p>
                    <p className="text-white/35 text-xs truncate">{actor.character}</p>
                  </Link>
                </motion.div>
              ))}
            </div>
          </section>
        )}

        {/* ── Où regarder (services de streaming) ── */}
        <StreamingServices imdbId={movie.imdb_id} />

        {/* ── Recommandations ── */}
        {movie.recommendations?.results?.length > 0 && (
          <MediaRow
            title="Recommandés pour vous"
            items={movie.recommendations.results}
            mediaType="movie"
          />
        )}

        {movie.similar?.results?.length > 0 && (
          <MediaRow title="Films similaires" items={movie.similar.results} mediaType="movie" />
        )}
      </div>

      <StreamModal
        open={watchOpen}
        onClose={() => setWatchOpen(false)}
        title={movie.title}
        tmdbId={movie.id}
        mediaType="movie"
        onSelectStream={(stream) => {
          saveLastStream(movie.id, "movie", stream.url);
          setWatchOpen(false);
          setActiveStream({ url: stream.url, startTime: resumeTime });
        }}
      />
    </article>
  );
}
