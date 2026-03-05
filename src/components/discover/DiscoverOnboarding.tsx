"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, useAnimationControls, AnimatePresence } from "motion/react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface GestureStep {
  label: string;
  labelPosition: string;
  cardAnimate: { x?: number; y?: number; rotate?: number };
  text: string;
  subtext: string;
}

const GESTURE_STEPS: GestureStep[] = [
  {
    label: "J'AIME ❤️",
    labelPosition: "top-5 left-3 -rotate-12 border-emerald-400/70 bg-emerald-500/90 text-white",
    cardAnimate: { x: 90, rotate: 14 },
    text: "Swipe à droite",
    subtext: "Tu as aimé ce film ou cette série",
  },
  {
    label: "NON 👎",
    labelPosition: "top-5 right-3 rotate-12 border-red-400/70 bg-red-500/90 text-white",
    cardAnimate: { x: -90, rotate: -14 },
    text: "Swipe à gauche",
    subtext: "Ce n'était pas pour toi",
  },
  {
    label: "PAS VU 👁",
    labelPosition: "top-1/3 left-1/2 -translate-x-1/2 border-white/30 bg-gray-700/90 text-white",
    cardAnimate: { y: -80 },
    text: "Swipe vers le haut",
    subtext: "Tu ne l'as pas encore vu",
  },
  {
    label: "MA LISTE ➕",
    labelPosition: "top-1/3 left-1/2 -translate-x-1/2 border-nemo-accent/70 bg-nemo-accent/90 text-black",
    cardAnimate: { y: 80 },
    text: "Swipe vers le bas",
    subtext: "Ajouter à ta liste à regarder",
  },
];

interface DiscoverOnboardingProps {
  onComplete: () => void;
  /** When true, renders inline (no fixed overlay) for use inside onboarding shell */
  embedded?: boolean;
}

export function DiscoverOnboarding({ onComplete, embedded = false }: DiscoverOnboardingProps) {
  const [show, setShow] = useState(embedded);
  const [phase, setPhase] = useState<"intro" | "gestures" | "done">("intro");
  const [gestureStep, setGestureStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const controls = useAnimationControls();

  useEffect(() => {
    if (embedded) return;
    if (typeof window !== "undefined" && !localStorage.getItem("nemo_discover_onboarded")) {
      setShow(true);
    }
  }, [embedded]);

  const runGestureAnimation = useCallback(
    async (step: GestureStep) => {
      setIsAnimating(true);
      // Reset
      await controls.start({
        x: 0, y: 0, rotate: 0, opacity: 1,
        transition: { duration: 0.25, ease: "easeOut" },
      });
      // Pause before animating
      await new Promise((r) => setTimeout(r, 700));
      // Animate toward swipe direction
      await controls.start({
        ...step.cardAnimate,
        opacity: 0.6,
        transition: { duration: 0.5, ease: [0.32, 0.72, 0, 1] },
      });
      // Hold
      await new Promise((r) => setTimeout(r, 300));
      setIsAnimating(false);
    },
    [controls]
  );

  useEffect(() => {
    if (phase !== "gestures") return;
    const step = GESTURE_STEPS[gestureStep];
    if (step) void runGestureAnimation(step);
  }, [phase, gestureStep, runGestureAnimation]);

  const handleNext = () => {
    if (phase === "intro") {
      setPhase("gestures");
    } else if (phase === "gestures") {
      if (gestureStep < GESTURE_STEPS.length - 1) {
        setGestureStep((s) => s + 1);
      } else {
        setPhase("done");
      }
    } else {
      handleDismiss();
    }
  };

  const handleDismiss = () => {
    localStorage.setItem("nemo_discover_onboarded", "1");
    setShow(false);
    onComplete();
  };

  if (!show) return null;

  const currentGesture = GESTURE_STEPS[gestureStep];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={cn(
        "flex flex-col",
        embedded
          ? "relative min-h-[500px]"
          : "fixed inset-0 z-50 bg-[#080a0f]"
      )}
    >
      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8">
        <AnimatePresence mode="wait">
          {phase === "intro" && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="text-center space-y-5 max-w-xs mx-auto"
            >
              <div className="size-20 rounded-full bg-nemo-accent/15 ring-1 ring-nemo-accent/30 flex items-center justify-center mx-auto">
                <Sparkles className="size-9 text-nemo-accent" />
              </div>
              <div className="space-y-2">
                <h1 className="text-white font-black text-2xl">Définissons tes goûts</h1>
                <p className="text-white/50 text-sm leading-relaxed">
                  Pour te proposer les meilleurs films et séries, on a besoin d&apos;en savoir plus sur toi.
                </p>
                <p className="text-white text-sm font-semibold">
                  C&apos;est simple&nbsp;: swipe !
                </p>
              </div>
            </motion.div>
          )}

          {phase === "gestures" && currentGesture && (
            <motion.div
              key={`gesture-${gestureStep}`}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center gap-6 w-full"
            >
              {/* Instruction (above card so downward animations don't cover it) */}
              <div className="text-center space-y-1">
                <p className="text-white font-bold text-xl">{currentGesture.text}</p>
                <p className="text-white/50 text-sm">{currentGesture.subtext}</p>
              </div>

              {/* Fake card */}
              <div className="relative w-52 h-72">
                <motion.div
                  className="absolute inset-0 rounded-3xl shadow-2xl ring-1 ring-white/10"
                  animate={controls}
                  initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
                >
                  {/* Background */}
                  <div className="absolute inset-0 rounded-3xl overflow-hidden bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460]">
                    {/* Fake gradient overlay */}
                    <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/90 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <p className="text-white font-bold text-sm leading-tight">Votre prochain</p>
                      <p className="text-white font-bold text-sm">film préféré ✨</p>
                    </div>
                  </div>
                  {/* Swipe label */}
                  <div
                    className={cn(
                      "absolute z-10 px-3 py-1.5 rounded-xl border-2 font-black text-sm shadow-xl pointer-events-none whitespace-nowrap",
                      currentGesture.labelPosition
                    )}
                  >
                    {currentGesture.label}
                  </div>
                </motion.div>
              </div>

              {/* Step dots */}
              <div className="flex gap-2">
                {GESTURE_STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-300",
                      i === gestureStep ? "w-6 bg-nemo-accent" : "w-1.5 bg-white/20"
                    )}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {phase === "done" && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="text-center space-y-4 max-w-xs mx-auto"
            >
              <div className="text-5xl">🎬</div>
              <h2 className="text-white font-black text-2xl">C&apos;est parti !</h2>
              <p className="text-white/50 text-sm leading-relaxed">
                Swipe pour découvrir des films et séries, et tes recommandations s&apos;affineront au fil du temps.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom action */}
      <div className={cn("shrink-0 px-6 space-y-2", embedded ? "pb-4" : "pb-12")}>
        <button
          onClick={handleNext}
          className="w-full py-4 bg-nemo-accent hover:bg-[#f0c85a] active:scale-95 text-black font-bold rounded-2xl transition-all text-base"
        >
          {phase === "intro"
            ? "Voir comment ça marche →"
            : phase === "gestures" && gestureStep < GESTURE_STEPS.length - 1
            ? "Suivant →"
            : phase === "gestures"
            ? "Terminer →"
            : "Découvrir les films 🎬"}
        </button>
        {phase !== "intro" && (
          <button
            onClick={handleDismiss}
            className="w-full py-3 text-white/30 text-sm font-medium"
          >
            Passer
          </button>
        )}
      </div>
    </motion.div>
  );
}
