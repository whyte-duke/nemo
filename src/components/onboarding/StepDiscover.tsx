"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Sparkles, ArrowRight } from "lucide-react";
import { SwipeStack } from "@/components/discover/SwipeStack";
import { DiscoverOnboarding } from "@/components/discover/DiscoverOnboarding";
import { useSwipeSession, type SwipeAction } from "@/hooks/use-swipe-session";

const ALL_SWIPE_TYPES: SwipeAction[] = ["like", "dislike", "list", "pas_vu"];

interface StepDiscoverProps {
  onNext: () => void;
}

export default function StepDiscover({ onNext }: StepDiscoverProps) {
  const { cards, currentIndex, swipeCount, levelTarget, level, isLoading, isMilestone, loadCards, swipe } =
    useSwipeSession();

  const seenActionsRef = useRef(new Set<SwipeAction>());
  const [navigating, setNavigating] = useState(false);
  const [showTutorial, setShowTutorial] = useState(true);

  useEffect(() => {
    void loadCards();
  }, [loadCards]);

  const handleTutorialComplete = () => {
    localStorage.setItem("nemo_discover_onboarded", "1");
    setShowTutorial(false);
  };

  const handleSwipe = async (action: SwipeAction) => {
    await swipe(action);

    seenActionsRef.current.add(action);

    if (ALL_SWIPE_TYPES.every((t) => seenActionsRef.current.has(t)) && !navigating) {
      setNavigating(true);
      onNext();
    }
  };

  if (showTutorial) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <DiscoverOnboarding embedded onComplete={handleTutorialComplete} />
      </motion.div>
    );
  }

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
          Essaie chaque bouton pour découvrir comment swiper, puis Nemo t&apos;emmène directement sur l&apos;app.
        </p>
      </div>

      {/* Stack de cartes */}
      {!isLoading && cards.length > 0 && !isMilestone && !navigating && (
        <div className="w-full h-[480px] md:h-[560px] lg:h-[620px]">
          <SwipeStack
            cards={cards}
            currentIndex={currentIndex}
            swipeCount={swipeCount}
            target={levelTarget}
            level={level}
            onSwipe={(action) => void handleSwipe(action)}
            className="h-full"
          />
        </div>
      )}

      {(isLoading || navigating) && (
        <div className="flex justify-center items-center h-48">
          <div className="size-8 rounded-full border-2 border-nemo-accent/30 border-t-nemo-accent animate-spin" />
        </div>
      )}

      {isMilestone && !navigating && (
        <div className="text-center py-6 space-y-3">
          <div className="size-14 rounded-full bg-nemo-accent/20 ring-1 ring-nemo-accent/30 flex items-center justify-center mx-auto">
            <Sparkles className="size-7 text-nemo-accent" />
          </div>
          <p className="text-white font-semibold text-lg">{swipeCount} films swipés — parfait !</p>
          <p className="text-white/40 text-sm">Tes recommandations sont prêtes.</p>
        </div>
      )}

      {/* Boutons bas */}
      {!navigating && (
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
      )}
    </motion.div>
  );
}
