"use client";

import { useEffect } from "react";
import { motion } from "motion/react";
import { Sparkles, ArrowRight } from "lucide-react";
import { SwipeStack } from "@/components/discover/SwipeStack";
import { useSwipeSession } from "@/hooks/use-swipe-session";

interface StepDiscoverProps {
  onNext: () => void;
}

export default function StepDiscover({ onNext }: StepDiscoverProps) {
  const { cards, currentIndex, swipeCount, levelTarget, level, isLoading, isMilestone, loadCards, swipe } =
    useSwipeSession();

  useEffect(() => {
    void loadCards();
  }, [loadCards]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="space-y-5"
    >
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="size-5 text-nemo-accent" />
          <h2 className="text-white font-bold text-xl">Définis tes goûts</h2>
        </div>
        <p className="text-white/50 text-sm">
          Swipe les films pour que Nemo apprenne ce que tu aimes. Objectif : 20 swipes.
        </p>
      </div>

      {/* Stack de cartes */}
      {!isLoading && cards.length > 0 && !isMilestone && (
        <div className="w-full" style={{ height: 480 }}>
          <SwipeStack
            cards={cards}
            currentIndex={currentIndex}
            swipeCount={swipeCount}
            target={levelTarget}
            level={level}
            onSwipe={(action) => void swipe(action)}
            className="h-full"
          />
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center items-center h-48">
          <div className="size-8 rounded-full border-2 border-nemo-accent/30 border-t-nemo-accent animate-spin" />
        </div>
      )}

      {isMilestone && (
        <div className="text-center py-6 space-y-3">
          <div className="size-14 rounded-full bg-nemo-accent/20 ring-1 ring-nemo-accent/30 flex items-center justify-center mx-auto">
            <Sparkles className="size-7 text-nemo-accent" />
          </div>
          <p className="text-white font-semibold text-lg">{swipeCount} films swipés — parfait !</p>
          <p className="text-white/40 text-sm">Tes recommandations sont prêtes.</p>
        </div>
      )}

      {/* Boutons bas */}
      <div className="flex items-center justify-between pt-2 gap-4">
        <button
          onClick={onNext}
          className="text-white/40 text-sm hover:text-white/70 transition-colors"
        >
          Passer cette étape
        </button>
        <button
          onClick={onNext}
          className="flex items-center gap-2 bg-nemo-accent hover:bg-[#f0c85a] active:scale-95 text-black font-semibold px-6 py-3 rounded-xl transition-all"
        >
          <ArrowRight className="size-4" />
          {isMilestone ? "Terminer" : "Continuer"}
        </button>
      </div>
    </motion.div>
  );
}
