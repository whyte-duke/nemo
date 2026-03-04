"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { motion, useMotionValue, useTransform, useAnimation, AnimatePresence } from "motion/react";
import Image from "next/image";
import { Star, Info, X } from "lucide-react";
import { tmdbImage } from "@/lib/tmdb/client";
import { cn } from "@/lib/utils";
import type { SwipeAction } from "@/hooks/use-swipe-session";

// ─── Handle exposé au parent pour déclencher l'animation programmatiquement ──

export interface SwipeCardHandle {
  triggerSwipe: (action: "like" | "dislike" | "list" | "pas_vu") => Promise<void>;
}

interface SwipeCardProps {
  tmdbId: number;
  title: string;
  year: string;
  posterPath: string | null;
  backdropPath: string | null;
  voteAverage: number;
  genreIds: number[];
  overview: string;
  mediaType: "movie" | "tv";
  onSwipe: (action: SwipeAction) => void;
  isTop: boolean;
}

const GENRE_MAP: Record<number, string> = {
  28: "Action", 12: "Aventure", 16: "Animation", 35: "Comédie",
  80: "Crime", 99: "Documentaire", 18: "Drame", 10751: "Famille",
  14: "Fantaisie", 36: "Histoire", 27: "Horreur", 10402: "Musique",
  9648: "Mystère", 10749: "Romance", 878: "Science-Fiction", 53: "Thriller",
  10752: "Guerre", 37: "Western", 10765: "SF & Fantasy", 10759: "Action & Av.",
  10762: "Enfants", 10768: "Guerre & Pol.",
};

export const SwipeCard = forwardRef<SwipeCardHandle, SwipeCardProps>(
  function SwipeCard({ title, year, posterPath, backdropPath, voteAverage, genreIds, overview, onSwipe, isTop }, ref) {
    const [infoOpen, setInfoOpen] = useState(false);
    const controls = useAnimation();
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const rotate = useTransform(x, [-220, 0, 220], [-18, 0, 18]);

    // Opacité des labels de swipe
    const likeOpacity = useTransform(x, [30, 100], [0, 1]);
    const dislikeOpacity = useTransform(x, [-100, -30], [1, 0]);
    const listOpacity = useTransform(y, [30, 90], [0, 1]);
    const pasVuOpacity = useTransform(y, [-90, -30], [1, 0]);

    // Méthode exposée pour trigger programmatique depuis les boutons
    useImperativeHandle(ref, () => ({
      triggerSwipe: async (action) => {
        if (action === "like") {
          await controls.start({
            x: 700, rotate: 18, opacity: 0,
            transition: { duration: 0.38, ease: [0.32, 0.72, 0, 1] },
          });
        } else if (action === "dislike") {
          await controls.start({
            x: -700, rotate: -18, opacity: 0,
            transition: { duration: 0.38, ease: [0.32, 0.72, 0, 1] },
          });
        } else if (action === "pas_vu") {
          await controls.start({
            y: -700, opacity: 0,
            transition: { duration: 0.38, ease: [0.32, 0.72, 0, 1] },
          });
        } else {
          await controls.start({
            y: 700, opacity: 0,
            transition: { duration: 0.38, ease: [0.32, 0.72, 0, 1] },
          });
        }
      },
    }));

    const handleDragEnd = async () => {
      const xVal = x.get();
      const yVal = y.get();
      const THRESHOLD = 100;

      if (Math.abs(xVal) > Math.abs(yVal)) {
        if (xVal > THRESHOLD) {
          await controls.start({ x: 700, rotate: 18, opacity: 0, transition: { duration: 0.3 } });
          onSwipe("like");
        } else if (xVal < -THRESHOLD) {
          await controls.start({ x: -700, rotate: -18, opacity: 0, transition: { duration: 0.3 } });
          onSwipe("dislike");
        } else {
          await controls.start({
            x: 0, y: 0, rotate: 0,
            transition: { type: "spring", stiffness: 350, damping: 25 },
          });
        }
      } else {
        if (yVal > THRESHOLD) {
          await controls.start({ y: 700, opacity: 0, transition: { duration: 0.3 } });
          onSwipe("list");
        } else if (yVal < -THRESHOLD) {
          await controls.start({ y: -700, opacity: 0, transition: { duration: 0.3 } });
          onSwipe("pas_vu");
        } else {
          await controls.start({
            x: 0, y: 0, rotate: 0,
            transition: { type: "spring", stiffness: 350, damping: 25 },
          });
        }
      }
    };

    // Poster prioritaire, fallback backdrop
    const imageSrc =
      posterPath
        ? tmdbImage.poster(posterPath, "w500")
        : backdropPath
        ? tmdbImage.backdrop(backdropPath, "w780")
        : null;

    const genres = genreIds.slice(0, 3).map((id) => GENRE_MAP[id]).filter(Boolean);

    const ratingColor =
      voteAverage >= 7 ? "bg-emerald-500/90 text-white" :
      voteAverage >= 5 ? "bg-amber-500/90 text-white" :
      "bg-red-500/90 text-white";

    return (
      <motion.div
        className="absolute inset-0 select-none touch-none"
        style={{ x, y, rotate, cursor: isTop ? "grab" : "default" }}
        drag={isTop && !infoOpen}
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        dragElastic={0.85}
        animate={controls}
        whileTap={isTop ? { scale: 1.01 } : undefined}
        onDragEnd={() => void handleDragEnd()}
      >
        {/* Overlays swipe visibles uniquement sur la carte du dessus */}
        {isTop && (
          <>
            <motion.div
              style={{ opacity: likeOpacity }}
              className="absolute top-5 left-4 z-20 px-4 py-2 rounded-2xl border-2 border-emerald-400/70 bg-emerald-500/90 backdrop-blur-sm text-white font-black text-lg rotate-[-15deg] shadow-xl pointer-events-none"
            >
              J&apos;AIME ❤️
            </motion.div>
            <motion.div
              style={{ opacity: dislikeOpacity }}
              className="absolute top-5 right-4 z-20 px-4 py-2 rounded-2xl border-2 border-red-400/70 bg-red-500/90 backdrop-blur-sm text-white font-black text-lg rotate-[15deg] shadow-xl pointer-events-none"
            >
              NON 👎
            </motion.div>
            <motion.div
              style={{ opacity: listOpacity }}
              className="absolute top-1/3 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-2xl border-2 border-nemo-accent/70 bg-nemo-accent/90 backdrop-blur-sm text-black font-black text-lg shadow-xl pointer-events-none whitespace-nowrap"
            >
              MA LISTE ➕
            </motion.div>
            <motion.div
              style={{ opacity: pasVuOpacity }}
              className="absolute top-1/3 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-2xl border-2 border-white/30 bg-gray-700/90 backdrop-blur-sm text-white font-black text-lg shadow-xl pointer-events-none whitespace-nowrap"
            >
              PAS VU 👁
            </motion.div>
          </>
        )}

        {/* Carte */}
        <div className="w-full h-full rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/10">
          {/* Poster plein format */}
          <div className="relative w-full h-full bg-[#12121e]">
            {imageSrc ? (
              <Image
                src={imageSrc}
                alt={title}
                fill
                className="object-cover"
                sizes="(max-width: 480px) 100vw, 380px"
                priority={isTop}
                draggable={false}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-white/10 text-8xl font-black">{title.charAt(0)}</span>
              </div>
            )}

            {/* Badge note */}
            <div className={cn(
              "absolute top-3 right-3 z-10 flex items-center gap-1 px-2.5 py-1.5 rounded-full text-sm font-bold shadow-lg backdrop-blur-md",
              ratingColor
            )}>
              <Star className="size-3 fill-current" />
              {voteAverage.toFixed(1)}
            </div>

            {/* Bouton info — top-left */}
            {isTop && (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); setInfoOpen((v) => !v); }}
                className="absolute top-3 left-3 z-10 size-8 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 flex items-center justify-center"
              >
                <Info className="size-4 text-white/70" />
              </button>
            )}

            {/* Dégradé bas */}
            <div className="absolute inset-x-0 bottom-0 h-[35%] bg-gradient-to-t from-black/95 via-black/60 to-transparent pointer-events-none" />

            {/* Infos sur le dégradé — année + genres seulement */}
            <div className="absolute bottom-0 left-0 right-0 p-5 space-y-1.5 z-10">
              <p className="text-white/55 text-sm">{year}</p>
              {genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {genres.map((g) => (
                    <span
                      key={g}
                      className="text-[11px] px-2.5 py-0.5 rounded-full bg-white/15 text-white/80 backdrop-blur-sm border border-white/10"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Overlay info — slide depuis le bas */}
            <AnimatePresence>
              {infoOpen && (
                <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", stiffness: 280, damping: 28 }}
                  className="absolute inset-x-0 bottom-0 z-20 bg-black/92 backdrop-blur-md rounded-b-3xl p-5 max-h-[70%] overflow-y-auto"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h2 className="text-white font-bold text-lg leading-tight">{title}</h2>
                      {year && <p className="text-white/40 text-sm">{year}</p>}
                    </div>
                    <button onClick={() => setInfoOpen(false)}>
                      <X className="size-5 text-white/40" />
                    </button>
                  </div>
                  {genres.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {genres.map((g) => (
                        <span key={g} className="text-[11px] px-2.5 py-0.5 rounded-full bg-white/10 text-white/70">
                          {g}
                        </span>
                      ))}
                    </div>
                  )}
                  {overview && (
                    <p className="text-white/65 text-sm leading-relaxed">{overview}</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    );
  }
);
