"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { MediaCard } from "./MediaCard";
import { ProviderLogo } from "@/components/ui/ProviderLogo";
import type { TMDbMovie, TMDbTVShow } from "@/types/tmdb";

type MediaItem = TMDbMovie | TMDbTVShow;

/** Largeur (base → expanded) + hauteur fixe pour éviter layout shift (la rangée ne grandit pas au hover) */
const ROW_CARD_WIDTH_CLASSES: Record<string, { base: string; expanded: string }> = {
  sm: { base: "w-28 sm:w-32", expanded: "w-36 sm:w-40" },
  md: { base: "w-36 sm:w-44", expanded: "w-48 sm:w-56" },
  lg: { base: "w-44 sm:w-56", expanded: "w-56 sm:w-72" },
};
const ROW_CARD_HEIGHT: Record<string, string> = {
  sm: "h-[10.5rem]",   // 168px
  md: "h-[16.5rem]",   // 264px
  lg: "h-[21rem]",     // 336px
};

interface MediaRowProps {
  title: string;
  items: MediaItem[];
  mediaType: "movie" | "tv";
  onPlay?: (item: MediaItem) => void;
  onMoreInfo?: (item: MediaItem) => void;
  viewAllHref?: string;
  cardSize?: "sm" | "md" | "lg";
  isLoading?: boolean;
  showTopNumber?: boolean;
  /** Badge texte (ex: "Live", "Bientôt"). Ignoré si providerSlug est fourni (le logo remplace le badge). */
  badge?: string;
  /** Slug du provider (netflix, apple-tv, etc.) : affiche le logo à côté du titre. */
  providerSlug?: string;
}

function SkeletonCard() {
  return (
    <div className="w-36 sm:w-44 shrink-0 rounded-2xl overflow-hidden">
      <div className="aspect-2/3 skeleton" />
    </div>
  );
}

export function MediaRow({
  title,
  items,
  mediaType,
  onPlay,
  onMoreInfo,
  viewAllHref,
  cardSize = "md",
  isLoading = false,
  showTopNumber = false,
  badge,
  providerSlug,
}: MediaRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 10);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => ro.disconnect();
  }, [checkScroll, items.length]);

  const scroll = useCallback((direction: "left" | "right", amountMultiplier = 0.75) => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * amountMultiplier;
    el.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
  }, []);

  /** Défilement « gros pas » pour aller plus loin d’un coup */
  const scrollMore = useCallback(() => {
    scroll("right", 2.2);
  }, [scroll]);

  return (
    <section className="relative group/row">
      {/* ─── En-tête ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 sm:px-8 mb-0.5">
        <div className="flex items-center gap-3">
          {providerSlug && (
            <ProviderLogo provider={providerSlug} size="sm" ariaLabel={title} />
          )}
          <h2 className="text-white font-bold text-lg sm:text-xl tracking-tight text-balance">
            {title}
          </h2>
          {badge && !providerSlug && (
            <span className="section-label">{badge}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {canScrollRight && !isLoading && items.length > 0 && (
            <button
              type="button"
              onClick={scrollMore}
              aria-label="Défiler plus vers la droite"
              className={cn(
                "text-xs font-semibold text-white/50 hover:text-white transition-colors",
                "flex items-center gap-1.5",
                "px-3 py-1.5 rounded-full",
                "bg-white/5 hover:bg-white/10 border border-white/8 hover:border-white/16",
                "transition-all duration-200"
              )}
            >
              Défiler plus
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                <path
                  d="M4.5 2.5L7.5 6L4.5 9.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
          {viewAllHref && (
          <a
            href={viewAllHref}
            className={cn(
              "text-xs font-semibold text-white/50 hover:text-white transition-colors",
              "flex items-center gap-1.5",
              "px-3 py-1.5 rounded-full",
              "bg-white/5 hover:bg-white/10 border border-white/8 hover:border-white/16",
              "transition-all duration-200"
            )}
          >
            Voir tout
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M4.5 2.5L7.5 6L4.5 9.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
          )}
        </div>
      </div>

      {/* ─── Conteneur scroll : hauteur fixe pour ne pas pousser les sections en dessous ─── */}
      <div className="relative overflow-visible">
        {/* Bouton gauche */}
        <button
          onClick={() => scroll("left")}
          aria-label="Défiler à gauche"
          className={cn(
            "absolute left-2 top-1/2 -translate-y-1/2 z-(--z-above)",
            "flex items-center justify-center size-10",
            "glass-capsule opacity-0 group-hover/row:opacity-100",
            "transition-all duration-200 hover:bg-white/15",
            !canScrollLeft && "pointer-events-none opacity-0!"
          )}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M10 3L6 8L10 13"
              stroke="white"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* Rangée scrollable : pt/pb pour carte scale(1.14) centre, pas coupée */}
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className={cn(
            "media-row-scroll flex items-center gap-3 sm:gap-4 px-4 sm:px-8 overflow-x-auto",
            "min-h-98 pt-6 pb-10"
          )}
        >
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
            : items.map((item, index) => {
                const isHovered = hoveredIndex === index;
                const widths = ROW_CARD_WIDTH_CLASSES[cardSize] ?? ROW_CARD_WIDTH_CLASSES.md;
                const fixedHeight = ROW_CARD_HEIGHT[cardSize] ?? ROW_CARD_HEIGHT.md;
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "relative shrink-0 transition-[width] duration-300 ease-out flex justify-center overflow-visible",
                      fixedHeight,
                      isHovered ? widths.expanded : widths.base
                    )}
                  >
                    {showTopNumber && index < 10 && (
                      <span
                        className="absolute -left-3 bottom-0 text-7xl font-black text-white/8 select-none leading-none tabular-nums z-0"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {index + 1}
                      </span>
                    )}
                    <MediaCard
                      item={item}
                      mediaType={mediaType}
                      onPlay={onPlay}
                      onMoreInfo={onMoreInfo}
                      size={cardSize}
                      index={index}
                      totalItems={items.length}
                      isHovered={isHovered}
                      onHoverStart={() => setHoveredIndex(index)}
                      onHoverEnd={() => setHoveredIndex(null)}
                    />
                  </div>
                );
              })}
        </div>

        {/* Bouton droit */}
        <button
          onClick={() => scroll("right")}
          aria-label="Défiler à droite"
          className={cn(
            "absolute right-2 top-1/2 -translate-y-1/2 z-(--z-above)",
            "flex items-center justify-center size-10",
            "glass-capsule opacity-0 group-hover/row:opacity-100",
            "transition-all duration-200 hover:bg-white/15",
            !canScrollRight && "pointer-events-none opacity-0!"
          )}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M6 3L10 8L6 13"
              stroke="white"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* Gradients de fondu sur les bords */}
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-12 pointer-events-none transition-opacity duration-300",
            "bg-linear-to-r from-nemo-bg to-transparent",
            canScrollLeft ? "opacity-100" : "opacity-0"
          )}
        />
        <div
          className={cn(
            "absolute right-0 top-0 bottom-0 w-12 pointer-events-none transition-opacity duration-300",
            "bg-linear-to-l from-nemo-bg to-transparent",
            canScrollRight ? "opacity-100" : "opacity-0"
          )}
        />
      </div>
    </section>
  );
}
