"use client";

import { useState, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Play, Info, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { tmdbImage } from "@/lib/tmdb/client";
import { formatYear } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { ListSelector } from "@/components/lists/ListSelector";
import { useJellyfinLibrary } from "@/contexts/jellyfin-library-context";
import { JellyfinIcon } from "@/components/icons/JellyfinIcon";
import type { TMDbMovie, TMDbTVShow } from "@/types/tmdb";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
}

export function MediaCard({
  item,
  mediaType,
  onPlay,
  onMoreInfo,
  size = "md",
  showProgress = false,
  progress = 0,
  className,
  index,
  totalItems,
  isHovered: controlledHovered,
  onHoverStart,
  onHoverEnd,
}: MediaCardProps) {
  const [internalHovered, setInternalHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
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

  const handleMoreInfo = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onMoreInfo?.(item);
    },
    [onMoreInfo, item]
  );

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
      onHoverEnd={() => setHovered(false)}
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

          {/* Overlay dégradé au hover */}
          <AnimatePresence>
            {hovered && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 card-overlay"
              />
            )}
          </AnimatePresence>

          {/* Barre de progression */}
          {showProgress && progress > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/15">
              <div
                className="h-full bg-nemo-accent rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {/* ─── Contenu hover ─────────────────────────────────── */}
          <AnimatePresence>
            {hovered && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
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

                  <button
                    onClick={handleMoreInfo}
                    aria-label="Plus d'informations"
                    className="flex items-center justify-center size-8 rounded-full border border-white/30 hover:border-white/60 bg-black/30 backdrop-blur-sm transition-all ml-auto shrink-0"
                  >
                    <Info className="size-3 text-white" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Lueur interne au hover */}
          <AnimatePresence>
            {hovered && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 rounded-2xl pointer-events-none"
                style={{ boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.18)" }}
              />
            )}
          </AnimatePresence>
        </motion.div>
      </Link>
    </motion.div>
  );
}
