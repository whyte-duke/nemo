"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Loader2 } from "lucide-react";
import { SwipeStack } from "@/components/discover/SwipeStack";
import { DiscoverOnboarding } from "@/components/discover/DiscoverOnboarding";
import { useSwipeSession } from "@/hooks/use-swipe-session";

const MILESTONE_MESSAGES = [
  { title: "Bonne base ! 🎯", sub: "On commence à cerner tes goûts." },
  { title: "On te connaît mieux ! 📽️", sub: "Tes recommandations s'affinent." },
  { title: "Tu es incollable ! 🍿", sub: "On affine encore tes suggestions." },
  { title: "Expert·e ciné ! ⭐", sub: "Tes recs sont ultra-personnalisées." },
];

export default function DecouvrirPage() {
  const {
    currentCard, cards, currentIndex, swipeCount, levelTarget, level,
    isMilestone, isLoading, loadCards, swipe, continueNextLevel,
  } = useSwipeSession();

  useEffect(() => {
    void loadCards();
  }, [loadCards]);

  // Auto-continue après 2.5s sur le milestone
  useEffect(() => {
    if (!isMilestone) return;
    const timer = setTimeout(() => void continueNextLevel(), 2500);
    return () => clearTimeout(timer);
  }, [isMilestone, continueNextLevel]);

  const milestoneMsg = MILESTONE_MESSAGES[Math.min(level - 1, MILESTONE_MESSAGES.length - 1)];

  return (
    <>
      <DiscoverOnboarding onComplete={() => undefined} />

      {/* ── Milestone overlay (fixed, plein écran) ──────────────────── */}
      <AnimatePresence>
        {isMilestone && (
          <motion.div
            key="milestone"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="fixed inset-0 z-40 bg-[#080a0f]/95 backdrop-blur-sm flex flex-col items-center justify-center gap-6 px-6 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.1 }}
              className="size-24 rounded-full bg-nemo-accent/20 ring-2 ring-nemo-accent/40 flex items-center justify-center"
            >
              <Sparkles className="size-11 text-nemo-accent" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <h2 className="text-white font-black text-3xl mb-2">{milestoneMsg?.title}</h2>
              <p className="text-white/50 text-base">{milestoneMsg?.sub}</p>
              <p className="text-white/25 text-sm mt-3">Niveau {level + 1} en cours…</p>
            </motion.div>
            <motion.div
              className="flex gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="size-2 rounded-full bg-nemo-accent/60"
                  animate={{ scale: [1, 1.3, 1], opacity: [0.4, 1, 0.4] }}
                  transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                />
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className="overflow-hidden flex flex-col"
        style={{ height: "calc(100dvh - 7rem)" }}
      >
        {/* ── Contenu principal ─────────────────────────────────────── */}
        <div className="flex-1 min-h-0 flex flex-col items-center justify-start">
          <div className="w-full max-w-sm h-full flex flex-col">
            <AnimatePresence mode="wait">
              {isLoading && !currentCard ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 flex flex-col items-center justify-center gap-3"
                >
                  <Loader2 className="size-10 text-nemo-accent animate-spin" />
                  <p className="text-white/40 text-sm">Chargement des films…</p>
                </motion.div>
              ) : cards.length > 0 ? (
                <motion.div
                  key="stack"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex-1 min-h-0 flex flex-col"
                >
                  <SwipeStack
                    cards={cards}
                    currentIndex={currentIndex}
                    swipeCount={swipeCount}
                    target={levelTarget}
                    level={level}
                    onSwipe={(action) => void swipe(action)}
                    className="flex-1 min-h-0"
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </>
  );
}
