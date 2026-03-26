"use client";

import { useState, useCallback, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Play,
  Plus,
  Check,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  Tv,
  Clapperboard,
  Info,
  X,
  Star,
  CheckCircle2,
  Download,
  Layers,
  Loader2,
} from "lucide-react";
import { cn, formatYear, formatDate } from "@/lib/utils";
import { tmdbImage, getTrailerKey } from "@/lib/tmdb/client";
import { MediaRow } from "./MediaRow";
import { StreamModal } from "@/components/player/StreamModal";
import { SeasonDownloadModal } from "@/components/download/SeasonDownloadModal";
import { useIsInMyList, useToggleMyList, useInteraction } from "@/hooks/use-list";
import { useAuth } from "@/hooks/use-auth";
import { useJellyfinLibraryCheck } from "@/hooks/use-jellyfin-library";
import { useItemRecommendation } from "@/lib/recommendations/context";
import { useItemProgress, useMarkAsWatched, isEpisodeWatched } from "@/hooks/use-watch-history";
import { useStream } from "@/providers/stream-provider";
import { useTVSeason } from "@/hooks/use-tmdb";
import { motion, AnimatePresence } from "motion/react";
import type { TMDbTVShowDetail, TMDbEpisode } from "@/types/tmdb";

interface Props {
  show: TMDbTVShowDetail;
}

/* ─── Sélecteur de saison ──────────────────────────────────────── */
function SeasonSelector({
  show,
  selectedSeason,
  onSelect,
}: {
  show: TMDbTVShowDetail;
  selectedSeason: number;
  onSelect: (n: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const seasons = show.seasons.filter((s) => s.season_number > 0);
  const current = seasons.find((s) => s.season_number === selectedSeason);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/6 hover:bg-white/10 px-4 py-2 text-white font-semibold text-sm transition-all"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {current?.name ?? `Saison ${selectedSeason}`}
        <ChevronDown
          className={cn("size-4 text-white/50 transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="listbox"
            className="absolute top-full mt-2 right-0 sm:left-0 w-60 rounded-xl border border-white/10 bg-nemo-bg/95 backdrop-blur-xl overflow-hidden z-50 shadow-2xl max-h-80 overflow-y-auto"
          >
            {seasons.map((s) => (
              <button
                key={s.season_number}
                role="option"
                aria-selected={s.season_number === selectedSeason}
                onClick={() => { onSelect(s.season_number); setOpen(false); }}
                className={cn(
                  "w-full text-left px-4 py-3 text-sm transition-colors flex items-center justify-between gap-3",
                  s.season_number === selectedSeason
                    ? "text-nemo-accent bg-nemo-accent/10 font-medium"
                    : "text-white/70 hover:bg-white/6 hover:text-white"
                )}
              >
                <span className="truncate">{s.name}</span>
                <span className="text-xs tabular-nums shrink-0 text-white/30">
                  {s.episode_count} ép.
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Carte d'épisode style Netflix (miniature 16:9 + infos) ──── */
function EpisodeCard({
  ep,
  onPlay,
  isWatched,
}: {
  ep: TMDbEpisode;
  onPlay: (epNum: number) => void;
  isWatched?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const showExpand = ep.overview && ep.overview.length > 80;
  const stillUrl = tmdbImage.still(ep.still_path, "w300");
  // Première phrase uniquement pour l'aperçu
  const firstSentence = ep.overview
    ? (ep.overview.match(/^[^.!?]+[.!?]/) ?? [ep.overview.slice(0, 90)])[0] ?? ep.overview.slice(0, 90)
    : "";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onPlay(ep.episode_number)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPlay(ep.episode_number);
        }
      }}
      className={cn(
        "group flex items-start rounded-xl overflow-hidden hover:bg-white/5 transition-colors cursor-pointer",
        isWatched && "opacity-90"
      )}
      aria-label={`Lire l'épisode ${ep.episode_number} : ${ep.name}`}
    >
      {/* Miniature 16:9 — flush gauche, pas de marge */}
      <div className="relative shrink-0 w-32 sm:w-44 aspect-video bg-nemo-surface2">
        {stillUrl ? (
          <Image
            src={stillUrl}
            alt={ep.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 128px, 176px"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-white/5">
            <span className="text-white/20 text-2xl font-bold tabular-nums">
              {ep.episode_number}
            </span>
          </div>
        )}
        {/* Badge vu */}
        <AnimatePresence>
          {isWatched && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute top-2 left-2 flex items-center justify-center size-6 rounded-full bg-nemo-accent/90 text-black shadow-lg"
              aria-hidden
            >
              <CheckCircle2 className="size-3.5 fill-current" />
            </motion.div>
          )}
        </AnimatePresence>
        {/* Overlay play */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-colors duration-200">
          <div className="size-9 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 shadow-lg">
            <Play className="size-3.5 fill-black text-black ml-0.5" />
          </div>
        </div>
      </div>

      {/* Infos */}
      <div className="flex-1 min-w-0 flex flex-col justify-center px-3 py-2">
        {/* Ligne titre + méta droite */}
        <div className="flex items-start gap-2 mb-0.5">
          <div className="flex items-baseline gap-1.5 min-w-0 flex-1">
            <span className="text-white/30 text-xs tabular-nums font-medium shrink-0">
              {ep.episode_number}
            </span>
            <h3 className="text-white font-semibold text-sm leading-snug text-pretty line-clamp-2">
              {ep.name}
            </h3>
          </div>
          {/* Durée + note empilées à droite */}
          <div className="flex flex-col items-end gap-0.5 shrink-0">
            {ep.runtime && (
              <span className="text-white/40 text-xs tabular-nums">
                {ep.runtime} min
              </span>
            )}
            {ep.vote_average > 0 && (
              <span className="flex items-center gap-0.5 text-nemo-accent text-xs font-medium">
                <Star className="size-3 fill-current" />
                {ep.vote_average.toFixed(1)}
              </span>
            )}
          </div>
        </div>

        {/* Description — première phrase + "Voir plus" inline */}
        {ep.overview && (
          <p className="text-white/35 text-[11px] leading-snug text-pretty">
            {expanded ? ep.overview : firstSentence}
            {showExpand && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setExpanded((v) => !v);
                }}
                className="text-white/40 hover:text-white/60 text-[11px] ml-1 transition-colors focus:outline-none"
                aria-expanded={expanded}
              >
                {expanded ? "Réduire" : "Voir plus"}
              </button>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Composant principal ──────────────────────────────────────── */
export function TVDetailContent({ show }: Props) {
  const [watchOpen, setWatchOpen] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(
    show.seasons.find((s) => s.season_number > 0)?.season_number ?? 1
  );
  const [activeEpisode, setActiveEpisode] = useState<number | null>(null);

  // ── Download states ──────────────────────────────────────────────────────
  const [downloadWatchOpen, setDownloadWatchOpen] = useState(false);
  const [downloadEpisode, setDownloadEpisode] = useState<number | null>(null);
  const [seasonDownloadOpen, setSeasonDownloadOpen] = useState(false);

  const { user } = useAuth();
  const { resolveStreams } = useStream();
  const isInList = useIsInMyList(show.id, "tv");
  const { mutate: toggleList } = useToggleMyList();
  const { interaction, setInteraction } = useInteraction(show.id, "tv");
  const { data: jellyfinLibrary } = useJellyfinLibraryCheck(show.id, "tv");
  const recommendation = useItemRecommendation(show.id, "tv");
  const { data: seasonData, isLoading: seasonLoading } = useTVSeason(show.id, selectedSeason);
  const showProgress = useItemProgress(show.id, "tv");
  const { mutateAsync: markAsWatched, isPending: isMarkingWatched } = useMarkAsWatched();
  const [markingEpisode, setMarkingEpisode] = useState<number | null>(null);

  const trailerKey = getTrailerKey(show.videos);
  const topCast = show.credits.cast.slice(0, 12);
  const imdbId = show.external_ids?.imdb_id ?? undefined;

  // Pre-fetch S1E1 in background on load
  useEffect(() => {
    if (imdbId) {
      const stremioId = `${imdbId}:${selectedSeason}:1`;
      void resolveStreams(stremioId, "series");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imdbId, selectedSeason]);

  const handlePlayEpisode = useCallback(
    async (episodeNumber: number) => {
      setActiveEpisode(episodeNumber);
      if (!imdbId) { setWatchOpen(true); return; }
      const stremioId = `${imdbId}:${selectedSeason}:${episodeNumber}`;
      setWatchOpen(true);
      await resolveStreams(stremioId, "series");
    },
    [imdbId, selectedSeason, resolveStreams]
  );

  const handleDownloadEpisode = useCallback(
    async (episodeNumber: number) => {
      setDownloadEpisode(episodeNumber);
      if (imdbId) {
        const stremioId = `${imdbId}:${selectedSeason}:${episodeNumber}`;
        await resolveStreams(stremioId, "series");
      }
      setDownloadWatchOpen(true);
    },
    [imdbId, selectedSeason, resolveStreams]
  );

  const handleMarkEpisodeAsWatched = useCallback(
    async (episodeNumber: number) => {
      setMarkingEpisode(episodeNumber);
      try {
        await markAsWatched({
          tmdbId: show.id,
          mediaType: "tv",
          seasonNumber: selectedSeason,
          episodeNumber,
        });
      } finally {
        setMarkingEpisode(null);
      }
    },
    [show.id, selectedSeason, markAsWatched]
  );

  const handleMarkSeasonAsWatched = useCallback(async () => {
    const lastEp = seasonData?.episodes?.length
      ? seasonData.episodes[seasonData.episodes.length - 1]?.episode_number
      : undefined;
    if (lastEp == null) return;
    setMarkingEpisode(-1);
    try {
      await markAsWatched({
        tmdbId: show.id,
        mediaType: "tv",
        seasonNumber: selectedSeason,
        episodeNumber: lastEp,
      });
    } finally {
      setMarkingEpisode(null);
    }
  }, [show.id, selectedSeason, seasonData?.episodes, markAsWatched]);

  const backdropPath =
    show.images.backdrops.find((b) => !b.iso_639_1)?.file_path ??
    show.images.backdrops[0]?.file_path ??
    show.backdrop_path;

  const logoPath = (
    show.images.logos.find((l) => l.iso_639_1 === "fr") ??
    show.images.logos.find((l) => l.iso_639_1 === "en")
  )?.file_path;

  return (
    <article className="bg-nemo-bg min-h-dvh">
      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="relative h-[70dvh] min-h-125 max-h-200 overflow-hidden">
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
                title={`Bande-annonce — ${show.name}`}
                allow="autoplay; fullscreen"
                className="absolute inset-0 w-full h-full border-0"
              />
              <button
                onClick={() => setShowTrailer(false)}
                aria-label="Fermer la bande-annonce"
                className="absolute top-4 right-4 z-30 flex items-center justify-center size-9 rounded-full bg-black/70 text-white hover:bg-black/90 transition-colors backdrop-blur-sm"
              >
                <X className="size-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="absolute bottom-10 left-6 sm:left-12 lg:left-20 max-w-2xl space-y-4">
          {logoPath ? (
            <div className="relative h-20 sm:h-28 w-56 sm:w-80">
              <Image
                src={tmdbImage.logo(logoPath, "w500") ?? ""}
                alt={show.name}
                fill
                className="object-contain object-bottom-left drop-shadow-2xl"
                sizes="320px"
              />
            </div>
          ) : (
            <h1 className="text-4xl sm:text-5xl font-black text-white text-balance leading-tight">
              {show.name}
            </h1>
          )}

          {/* Méta capsules */}
          <div className="flex items-center flex-wrap gap-2">
            {show.vote_average > 0 && (
              <span className="section-label text-nemo-accent! border-nemo-accent/25!">
                ★ {show.vote_average.toFixed(1)}
              </span>
            )}
            <span className="section-label">
              {formatYear(show.first_air_date)}
            </span>
            <span className="section-label">
              {show.number_of_seasons} saison{show.number_of_seasons > 1 ? "s" : ""}
            </span>
            {show.in_production && (
              <span className="section-label text-green-400! border-green-500/30!">
                En cours
              </span>
            )}
            {show.genres.slice(0, 3).map((g) => (
              <span key={g.id} className="section-label">{g.name}</span>
            ))}
            {user && jellyfinLibrary?.inLibrary && (
              <span className="section-label flex items-center gap-1.5 text-emerald-400 border-emerald-400/30">
                <CheckCircle2 className="size-3.5" />
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

          {/* Synopsis (une seule fois, dans le hero) */}
          <p className="text-white/75 text-sm leading-relaxed line-clamp-3 text-pretty max-w-xl">
            {show.overview}
          </p>

          {/* Actions */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => void handlePlayEpisode(1)}
              className="btn-accent-pill px-7 py-3"
            >
              <Play className="size-4 fill-current shrink-0" />
              S{selectedSeason} · Ép. 1
            </button>

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
              <button
                onClick={() =>
                  toggleList({ tmdbId: show.id, mediaType: "tv", action: isInList ? "remove" : "add" })
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
            )}

            {user && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setInteraction(interaction === "like" ? null : "like")}
                  aria-label="J'aime"
                  className={cn(
                    "flex items-center justify-center size-11 rounded-full border transition-all",
                    interaction === "like"
                      ? "bg-nemo-accent/20 border-nemo-accent text-nemo-accent"
                      : "glass border-white/30 text-white"
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
                      : "glass border-white/30 text-white"
                  )}
                >
                  <ThumbsDown className="size-5" />
                </button>
              </div>
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

      {/* ── Corps ────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 py-10 space-y-12">
        {/* ── Section Épisodes (full-width, style Netflix) ── */}
        <section>
          <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-white font-bold text-2xl">Épisodes</h2>
              {showProgress?.season_number != null && showProgress?.episode_number != null && (
                <span className="section-label text-nemo-accent border-nemo-accent/25 flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 shrink-0" />
                  Vu jusqu&apos;à S{String(showProgress.season_number).padStart(2, "0")}E
                  {String(showProgress.episode_number).padStart(2, "0")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {user && seasonData?.episodes && seasonData.episodes.length > 0 && (
                <button
                  type="button"
                  onClick={handleMarkSeasonAsWatched}
                  disabled={markingEpisode === -1}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/8 border border-white/15 hover:bg-nemo-accent/15 hover:border-nemo-accent/30 text-white/80 hover:text-nemo-accent text-sm font-medium transition-all disabled:opacity-50"
                >
                  <CheckCircle2 className="size-4 shrink-0" />
                  <span className="hidden sm:inline">Marquer la saison comme vue</span>
                  <span className="sm:hidden">Saison vue</span>
                </button>
              )}
              {user && !jellyfinLibrary?.inLibrary && seasonData?.episodes && seasonData.episodes.length > 0 && (
                <button
                  onClick={() => setSeasonDownloadOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00a4dc]/12 border border-[#00a4dc]/25 hover:bg-[#00a4dc]/20 hover:border-[#00a4dc]/40 text-[#00a4dc] text-sm font-medium transition-all"
                >
                  <Layers className="size-4 shrink-0" />
                  <span className="hidden sm:inline">Télécharger la saison</span>
                  <span className="sm:hidden">Saison</span>
                </button>
              )}
              <SeasonSelector show={show} selectedSeason={selectedSeason} onSelect={setSelectedSeason} />
            </div>
          </div>

          {/* Séparateur */}
          <div className="h-px bg-white/8 mb-2" />

          <div className="flex flex-col gap-1">
            {seasonLoading && (
              <>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-4 p-3">
                    <div className="shrink-0 w-36 sm:w-44 aspect-video rounded-lg skeleton" />
                    <div className="flex-1 space-y-2 py-2">
                      <div className="h-4 skeleton rounded w-3/4" />
                      <div className="h-3 skeleton rounded w-1/3" />
                      <div className="h-3 skeleton rounded w-full" />
                      <div className="h-3 skeleton rounded w-2/3" />
                    </div>
                  </div>
                ))}
              </>
            )}
            {!seasonLoading && !seasonData?.episodes?.length && (
              <div className="py-16 text-center">
                <Tv className="size-10 text-white/20 mx-auto mb-3" />
                <p className="text-white/40 text-sm">Aucun épisode disponible</p>
              </div>
            )}
            {seasonData?.episodes?.map((ep) => (
              <EpisodeCard
                key={ep.id}
                ep={ep}
                onPlay={(epNum) => void handlePlayEpisode(epNum)}
                isWatched={isEpisodeWatched(showProgress, selectedSeason, ep.episode_number)}
              />
            ))}
          </div>
        </section>

        {/* ── Panneau info technique (visible via bouton ℹ) ── */}
        <AnimatePresence>
          {showInfo && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
              className="glass-tile rounded-2xl px-6 py-5"
            >
              {show.tagline && (
                <p className="text-nemo-accent italic text-base mb-4">&ldquo;{show.tagline}&rdquo;</p>
              )}
              <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-3 text-sm">
                {show.created_by?.length > 0 && (
                  <>
                    <dt className="text-white/40">Créée par</dt>
                    <dd className="text-white/75 col-span-1 sm:col-span-2">
                      {show.created_by.map((c: { id: number; name: string }) => c.name).join(", ")}
                    </dd>
                  </>
                )}
                {show.networks?.length > 0 && (
                  <>
                    <dt className="text-white/40">Réseau</dt>
                    <dd className="text-white/75 col-span-1 sm:col-span-2">
                      {show.networks.map((n: { id: number; name: string }) => n.name).join(", ")}
                    </dd>
                  </>
                )}
                <dt className="text-white/40">Statut</dt>
                <dd className="text-white/75 col-span-1 sm:col-span-2">{show.status}</dd>
                {show.original_language && (
                  <>
                    <dt className="text-white/40">Langue originale</dt>
                    <dd className="text-white/75 col-span-1 sm:col-span-2">{show.original_language.toUpperCase()}</dd>
                  </>
                )}
                {show.last_air_date && (
                  <>
                    <dt className="text-white/40">Dernière diffusion</dt>
                    <dd className="text-white/75 col-span-1 sm:col-span-2">{formatYear(show.last_air_date)}</dd>
                  </>
                )}
              </dl>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Casting ── */}
        {topCast.length > 0 && (
          <section>
            <h2 className="text-white font-semibold text-lg mb-5 flex items-center gap-3">
              Casting principal
              <span className="section-label">{topCast.length}</span>
            </h2>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-3">
              {topCast.map((actor) => (
                <Link key={actor.id} href={`/acteur/${actor.id}`} className="block text-center group">
                  <div className="relative size-14 sm:size-16 rounded-full overflow-hidden mx-auto mb-2 bg-nemo-surface2 ring-1 ring-white/8">
                    {actor.profile_path ? (
                      <Image
                        src={tmdbImage.profile(actor.profile_path, "w185") ?? ""}
                        alt={actor.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-200"
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
              ))}
            </div>
          </section>
        )}

        {/* ── Recommandations ── */}
        {show.recommendations?.results?.length > 0 && (
          <MediaRow title="Séries recommandées" items={show.recommendations.results} mediaType="tv" />
        )}
      </div>

      {/* ── StreamModal épisode (lecture) ── */}
      <StreamModal
        open={watchOpen}
        onClose={() => setWatchOpen(false)}
        title={
          activeEpisode
            ? `${show.name} — S${String(selectedSeason).padStart(2, "0")}E${String(activeEpisode).padStart(2, "0")}`
            : show.name
        }
        tmdbId={show.id}
        mediaType="tv"
      />

      {/* ── StreamModal dédié au téléchargement d'un épisode (bouton Download) ── */}
      <StreamModal
        open={downloadWatchOpen}
        onClose={() => { setDownloadWatchOpen(false); setDownloadEpisode(null); }}
        title={
          downloadEpisode
            ? `${show.name} — S${String(selectedSeason).padStart(2, "0")}E${String(downloadEpisode).padStart(2, "0")}`
            : show.name
        }
        tmdbId={show.id}
        mediaType="tv"
      />

      {/* ── SeasonDownloadModal ─────────────────────────────────────────────── */}
      {seasonData?.episodes && (
        <SeasonDownloadModal
          open={seasonDownloadOpen}
          onClose={() => setSeasonDownloadOpen(false)}
          showTitle={show.name}
          showTmdbId={show.id}
          imdbId={imdbId ?? null}
          seasonNumber={selectedSeason}
          episodes={seasonData.episodes}
        />
      )}
    </article>
  );
}
