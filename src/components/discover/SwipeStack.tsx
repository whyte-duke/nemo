"use client";

import { useRef, useState } from "react";
import { motion } from "motion/react";
import { Heart, ThumbsDown, Plus, Eye } from "lucide-react";
import { SwipeCard, type SwipeCardHandle } from "./SwipeCard";
import { cn } from "@/lib/utils";
import type { SwipeAction } from "@/hooks/use-swipe-session";

interface CardData {
  id: number;
  media_type?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  genre_ids: number[];
  vote_average: number;
  overview: string;
}

interface SwipeStackProps {
  cards: CardData[];
  currentIndex: number;
  swipeCount: number;
  target: number;
  level: number;
  onSwipe: (action: SwipeAction) => void;
  className?: string;
}

export function SwipeStack({ cards, currentIndex, swipeCount, target, level, onSwipe, className }: SwipeStackProps) {
  const topCardRef = useRef<SwipeCardHandle>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  // On affiche la carte courante + les 2 suivantes en arrière-plan
  const visibleCards = cards.slice(currentIndex, currentIndex + 3);

  const handleAction = async (action: SwipeAction) => {
    if (isAnimating) return;
    setIsAnimating(true);
    try {
      if (action !== "skip" && topCardRef.current) {
        const dir =
          action === "like" ? "like"
          : action === "dislike" ? "dislike"
          : action === "pas_vu" ? "pas_vu"
          : "list";
        await topCardRef.current.triggerSwipe(dir);
      }
      onSwipe(action);
    } finally {
      setIsAnimating(false);
    }
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* ── Niveau + compteur ──────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between px-6 pt-1 pb-1">
        <span className="text-white/25 text-[10px] font-semibold uppercase tracking-wider">
          Niveau {level}
        </span>
        <span className="text-white/25 text-[10px]">{swipeCount}/{target}</span>
      </div>

      {/* ── Barre de progression — segments variables ──────────────── */}
      <div className="shrink-0 flex gap-1 justify-center pb-2 px-6">
        {Array.from({ length: target }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors duration-300",
              i < swipeCount ? "bg-nemo-accent" : "bg-white/15"
            )}
          />
        ))}
      </div>

      {/* ── Stack de cartes (flex-1) ───────────────────────────────── */}
      <div className="relative flex-1 min-h-0 mx-4">
        {visibleCards.map((card, offset) => {
          const isTop = offset === 0;
          const title = card.title ?? card.name ?? "Sans titre";
          const dateStr = card.release_date ?? card.first_air_date ?? "";
          const year = dateStr ? dateStr.slice(0, 4) : "";

          return (
            <motion.div
              key={card.id}
              className="absolute inset-0"
              animate={{
                scale: 1 - offset * 0.04,
                y: offset * 12,
              }}
              transition={{ type: "spring", stiffness: 220, damping: 24 }}
              style={{ zIndex: 10 - offset }}
            >
              <SwipeCard
                ref={isTop ? topCardRef : undefined}
                tmdbId={card.id}
                title={title}
                year={year}
                posterPath={card.poster_path}
                backdropPath={card.backdrop_path}
                voteAverage={card.vote_average}
                genreIds={card.genre_ids}
                overview={card.overview}
                mediaType={(card.media_type ?? "movie") as "movie" | "tv"}
                onSwipe={onSwipe}
                isTop={isTop}
              />
            </motion.div>
          );
        })}
      </div>

      {/* ── Boutons d'action ──────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-center gap-3 py-3">
        {/* 👎 Pas aimé — swipe gauche */}
        <ActionButton
          icon={<ThumbsDown className="size-5" />}
          label="Non"
          colorClass="bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-500/25 active:bg-red-500/35"
          disabled={isAnimating}
          onClick={() => void handleAction("dislike")}
        />

        {/* 👁 Pas encore vu — swipe haut */}
        <ActionButton
          icon={<Eye className="size-5" />}
          label="Pas vu"
          colorClass="bg-white/8 border-white/15 text-white/45 hover:bg-white/15 active:bg-white/20"
          disabled={isAnimating}
          onClick={() => void handleAction("pas_vu")}
        />

        {/* ➕ Suggestions — swipe bas */}
        <ActionButton
          icon={<Plus className="size-5" />}
          label="Suggestions"
          colorClass="bg-nemo-accent/15 border-nemo-accent/30 text-nemo-accent hover:bg-nemo-accent/25 active:bg-nemo-accent/35"
          disabled={isAnimating}
          onClick={() => void handleAction("list")}
        />

        {/* ❤️ J'aime — swipe droite */}
        <ActionButton
          icon={<Heart className="size-5 fill-current" />}
          label="J'aime"
          colorClass="bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 active:bg-emerald-500/35"
          disabled={isAnimating}
          onClick={() => void handleAction("like")}
        />
      </div>
    </div>
  );
}

// ─── Bouton d'action ─────────────────────────────────────────────────────────

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  colorClass: string;
  disabled: boolean;
  onClick: () => void;
}

function ActionButton({ icon, label, colorClass, disabled, onClick }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "size-12 flex items-center justify-center rounded-full border-2 transition-all duration-150",
        "disabled:opacity-40 disabled:pointer-events-none",
        "active:scale-90",
        colorClass
      )}
    >
      {icon}
    </button>
  );
}
