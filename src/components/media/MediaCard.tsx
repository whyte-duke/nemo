"use client";

import { useState, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Play, Star, Check, EyeOff, ThumbsUp, ThumbsDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { tmdbImage } from "@/lib/tmdb/client";
import { formatYear } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useIsInMyList } from "@/hooks/use-list";
import { ListSelector } from "@/components/lists/ListSelector";
import { useJellyfinLibrary } from "@/contexts/jellyfin-library-context";
import { JellyfinIcon } from "@/components/icons/JellyfinIcon";
import { useRecommendationLabel } from "@/lib/recommendations/context";
import { useQuickInteraction, useUserInteractions } from "@/lib/recommendations/user-interactions-context";
import type { TMDbMovie, TMDbTVShow } from "@/types/tmdb";

type BadgeInfo = { label: string; icon: string; colorClass: string };

function computeBadgeFromLabel(label: string | null): BadgeInfo | null {
  if (!label) return null;
  if (label.startsWith("Parce que vous aimez") || label === "Vous allez adorer")
    return { label, icon: "✦", colorClass: "text-nemo-accent bg-nemo-accent/15 border-nemo-accent/30" };
  if (label === "Pour vous")
    return { label, icon: "✦", colorClass: "text-nemo-accent/80 bg-nemo-accent/10 border-nemo-accent/20" };
  if (label.startsWith("Similaire à"))
    return { label, icon: "🔗", colorClass: "text-purple-300 bg-purple-500/15 border-purple-500/25" };
  if (label.includes("ami"))
    return { label, icon: "👥", colorClass: "text-blue-300 bg-blue-500/15 border-blue-500/25" };
  if (label === "Hautement noté" || label === "Film très bien noté")
    return { label, icon: "⭐", colorClass: "text-amber-300 bg-amber-500/15 border-amber-500/25" };
  if (label === "Populaire en ce moment")
    return { label, icon: "🔥", colorClass: "text-orange-300 bg-orange-500/15 border-orange-500/25" };
  return null;
}

type MediaItem = (TMDbMovie | TMDbTVShow) & { media_type?: string };

function getItemTitle(item: MediaItem): string {
  if ("title" in item && item.title) return item.title;
  if ("name" in item && (item as TMDbTVShow).name) return (item as TMDbTVShow).name;
  return "";
}

function getItemYear(item: MediaItem): string {
  if ("release_date" in item && item.release_date) return formatYear(item.release_date);
  if ("first_air_date" in item && (item as TMDbTVShow).first_air_date)
    return formatYear((item as TMDbTVShow).first_air_date);
  return "";
}

interface MediaCardProps {
  item: MediaItem;
  mediaType: "movie" | "tv";
  onPlay?: (item: MediaItem) => void;
  onMoreInfo?: (item: MediaItem) => void;
  onNotInterested?: (item: MediaItem) => void;
  size?: "sm" | "md" | "lg";
  showProgress?: boolean;
  progress?: number;
  className?: string;
  index?: number;
  totalItems?: number;
  /** En row: hover contrôlé par le parent pour éviter overflow + z-index propre */
  isHovered?: boolean;
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
  /** Si true et que l'item a une interaction (like/dislike/notInterested), masque la carte */
  hideIfSeen?: boolean;
}

export function MediaCard({
  item,
  mediaType,
  onPlay,
  // onMoreInfo kept for API compatibility — no longer rendered as a button
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onMoreInfo: _onMoreInfo,
  onNotInterested,
  size = "md",
  showProgress = false,
  progress = 0,
  className,
  index,
  totalItems,
  isHovered: controlledHovered,
  onHoverStart,
  onHoverEnd,
  hideIfSeen = false,
}: MediaCardProps) {
  const [internalHovered, setInternalHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [hidden, setHidden] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  const isControlled = onHoverStart !== undefined;
  const hovered = isControlled ? (controlledHovered ?? false) : internalHovered;
  const setHovered = isControlled
    ? (v: boolean) => { if (v) onHoverStart?.(); else onHoverEnd?.(); }
    : setInternalHovered;

  const resolvedType =
    item.media_type === "movie" || item.media_type === "tv" ? item.media_type : mediaType;

  const { isInLibrary } = useJellyfinLibrary();
  const inJellyfin = isInLibrary(item.id, resolvedType === "movie" ? "movie" : "tv");
  const isInList = useIsInMyList(item.id, resolvedType);
  const recommendationLabel = useRecommendationLabel(item.id, resolvedType);
  const badge = computeBadgeFromLabel(recommendationLabel);
  const { current: currentInteraction, toggle: toggleInteraction } = useQuickInteraction(item.id, resolvedType);
  const { isExcluded } = useUserInteractions();

  const title = getItemTitle(item);
  const year = getItemYear(item);
  const poster = tmdbImage.poster(item.poster_path, "w342");
  const href = resolvedType === "movie" ? `/film/${item.id}` : `/serie/${item.id}`;

  const sizeMap = {
    sm: "w-28 sm:w-32",
    md: "w-36 sm:w-44",
    lg: "w-44 sm:w-56",
  };

  // En row (isControlled) : centre pour éviter que le haut soit coupé et limiter le chevauchement
  const getOrigin = () => {
    if (isControlled) return "center center";
    if (index === 0) return "left center";
    if (totalItems && index === totalItems - 1) return "right center";
    return "center bottom";
  };

  const hoverScale = isControlled ? 1.14 : 1.28;


  const handlePlay = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onPlay?.(item);
    },
    [onPlay, item]
  );

  const handleNotInterested = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setHidden(true);
      onNotInterested?.(item);
    },
    [onNotInterested, item]
  );

  if (hidden) return null;
  if (hideIfSeen && isExcluded(item.id, resolvedType)) return null;

  return (
    <motion.div
      ref={cardRef}
      className={cn(
        "relative shrink-0 cursor-pointer",
        isControlled ? "w-full h-full min-h-0" : sizeMap[size],
        isControlled && "overflow-visible",
        className
      )}
      style={{
        zIndex: hovered ? "var(--z-sticky)" : index !== undefined ? 1 : "auto",
      }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={(e) => {
        // Don't close hover if pointer moved into a Radix portal (ListSelector dropdown)
        const related = (e as MouseEvent).relatedTarget as HTMLElement | null;
        if (related?.closest?.("[data-radix-popper-content-wrapper]")) return;
        setHovered(false);
      }}
      whileTap={{ scale: 0.96 }}
      transition={{ duration: 0.1 }}
    >
      <Link href={href} prefetch={false} tabIndex={-1}>
        {/*
         * En row : scale 1.14 + origin center pour ne pas couper le haut ni trop chevaucher.
         * Hors row : scale 1.28 + origin latéral pour l’effet « boum ».
         */}
        <motion.div
          animate={hovered ? { scale: hoverScale } : { scale: 1 }}
          transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
          style={{ transformOrigin: getOrigin() }}
          className={cn(
            "relative rounded-2xl bg-nemo-surface2",
            "transition-shadow duration-200",
            isControlled ? "h-full w-full" : "overflow-hidden aspect-2/3",
            isControlled && (hovered ? "overflow-visible" : "overflow-hidden"),
            hovered && "shadow-[0_16px_48px_rgba(0,0,0,0.7)] ring-1 ring-white/20"
          )}
        >
          {/* Skeleton chargement */}
          <AnimatePresence>
            {!imageLoaded && (
            <motion.div
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 skeleton rounded-2xl"
            />
            )}
          </AnimatePresence>

          {/* Affiche */}
          {poster ? (
            <Image
              src={poster}
              alt={title}
              fill
              priority={typeof index === "number" && index < 6}
              onLoad={() => setImageLoaded(true)}
              className={cn(
                "object-cover transition-opacity duration-500 rounded-2xl",
                imageLoaded ? "opacity-100" : "opacity-0"
              )}
              sizes="(max-width: 640px) 112px, (max-width: 1024px) 176px, 224px"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-nemo-surface2 p-2 rounded-2xl">
              <span className="text-white/20 text-xs text-center text-balance">{title}</span>
            </div>
          )}

          {/* Badge "Dans Ma Liste" — check doré permanent */}
          {user && isInList && !hovered && (
            <div
              className="absolute top-2 left-2 z-10 size-5 rounded-full flex items-center justify-center shadow-md pointer-events-none"
              style={{ backgroundColor: "rgba(232,184,75,0.95)" }}
              title="Dans Ma Liste"
            >
              <Check className="size-3 text-black" />
            </div>
          )}

          {/* Badge Jellyfin — visible en permanence si l'item est dans la bibliothèque */}
          {inJellyfin && (
            <div
              className="absolute top-2 right-2 z-10 size-5 rounded-full flex items-center justify-center shadow-md pointer-events-none p-0.75"
              style={{ backgroundColor: "#00A4DC" }}
              title="Disponible dans votre Jellyfin"
            >
              <JellyfinIcon className="text-white w-full h-full" />
            </div>
          )}

          {/* Badge recommandation — visible quand non hovéré */}
          {badge && !hovered && (
            <div
              className={cn(
                "absolute bottom-2 left-2 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded-full",
                "border text-[9px] font-semibold backdrop-blur-sm pointer-events-none",
                badge.colorClass
              )}
            >
              <span>{badge.icon}</span>
              <span>{badge.label}</span>
            </div>
          )}

          {/* Overlay dégradé : toujours présent en bas pour le texte, plus fort au hover */}
          <div className={cn(
            "absolute inset-0 transition-opacity duration-200",
            "bg-gradient-to-t from-black/80 via-black/20 to-transparent",
            hovered ? "opacity-100" : "opacity-0"
          )} />
          {/* Ambient glow sur les bords au hover */}
          {hovered && (
            <div className="absolute inset-0 rounded-2xl pointer-events-none"
              style={{ boxShadow: "inset 0 0 40px rgba(0,0,0,0.3)" }} />
          )}

          {/* Barre de progression */}
          {showProgress && progress > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/10 rounded-b-2xl overflow-hidden">
              <div
                className="h-full bg-nemo-accent rounded-full transition-all duration-300"
                style={{ width: `${progress}%`, boxShadow: "0 0 6px rgba(232,184,75,0.5)" }}
              />
            </div>
          )}

          {/* ─── Contenu hover ─────────────────────────────────── */}
          <AnimatePresence>
            {hovered && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                className="absolute inset-x-0 bottom-0 p-3 space-y-2"
              >
                {/* Titre + méta */}
                <div>
                  <p className="text-white font-semibold text-xs leading-tight truncate drop-shadow-lg">
                    {title}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {year && <span className="text-white/50 text-[10px]">{year}</span>}
                    {item.vote_average > 0 && (
                      <span className="flex items-center gap-0.5 text-nemo-accent text-[10px] font-semibold">
                        <Star className="size-2.5 fill-current" />
                        {item.vote_average.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Boutons d'action */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handlePlay}
                    aria-label={`Lire ${title}`}
                    className="flex items-center justify-center size-8 rounded-full bg-white hover:bg-white/85 transition-colors shrink-0 shadow-lg"
                  >
                    <Play className="size-3 text-black fill-black ml-0.5" />
                  </button>

                  {user && (
                    <ListSelector tmdbId={item.id} mediaType={resolvedType} size="sm" />
                  )}

                  {user && (
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleInteraction("like"); }}
                      aria-label="J'aime"
                      title="J'aime"
                      className={cn(
                        "flex items-center justify-center size-8 rounded-full border transition-all shrink-0",
                        currentInteraction === "like"
                          ? "border-nemo-accent bg-nemo-accent/20 text-nemo-accent"
                          : "border-white/20 hover:border-nemo-accent/60 hover:bg-nemo-accent/10 bg-black/30 backdrop-blur-sm text-white/60 hover:text-nemo-accent"
                      )}
                    >
                      <ThumbsUp className="size-3" />
                    </button>
                  )}

                  {user && (
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleInteraction("dislike"); }}
                      aria-label="Je n'aime pas"
                      title="Je n'aime pas"
                      className={cn(
                        "flex items-center justify-center size-8 rounded-full border transition-all shrink-0",
                        currentInteraction === "dislike"
                          ? "border-red-400 bg-red-500/20 text-red-400"
                          : "border-white/20 hover:border-red-400/60 hover:bg-red-500/10 bg-black/30 backdrop-blur-sm text-white/60 hover:text-red-300"
                      )}
                    >
                      <ThumbsDown className="size-3" />
                    </button>
                  )}

                  {onNotInterested && (
                    <button
                      data-test="not-interested-btn"
                      onClick={handleNotInterested}
                      aria-label="Pas intéressé"
                      title="Pas intéressé"
                      className="flex items-center justify-center size-8 rounded-full border border-white/20 hover:border-red-400/60 hover:bg-red-500/15 bg-black/30 backdrop-blur-sm transition-all shrink-0 ml-auto"
                    >
                      <EyeOff className="size-3 text-white/60 hover:text-red-300" />
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Ring + glow externe au hover */}
          <div className={cn(
            "absolute inset-0 rounded-2xl pointer-events-none transition-all duration-200",
            hovered
              ? "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.22),0_20px_60px_rgba(0,0,0,0.80)]"
              : "shadow-none"
          )} />
        </motion.div>
      </Link>
    </motion.div>
  );
}
