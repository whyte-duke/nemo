"use client";

import { cn } from "@/lib/utils";

interface OnboardingShellProps {
  step: number;
  totalSteps: number;
  children: React.ReactNode;
}

export default function OnboardingShell({ step, totalSteps, children }: OnboardingShellProps) {
  const progress = Math.round((step / totalSteps) * 100);

  return (
    /* Desktop: full-screen backdrop centered around a floating card */
    <div className="min-h-dvh w-full bg-[#0b0d12] flex flex-col md:items-center md:justify-center md:px-4 md:py-8">
      {/* Card (full-screen on mobile, floating card on desktop) */}
      <div
        className={cn(
          "flex flex-col w-full bg-[#0b0d12] overflow-hidden",
          /* Mobile: full viewport height */
          "h-dvh",
          /* Desktop: card style */
          "md:h-auto md:max-h-[90vh] md:w-full md:max-w-lg",
          "md:rounded-3xl md:ring-1 md:ring-white/10 md:shadow-2xl md:bg-[#0f1117]"
        )}
      >
        {/* Header fixe */}
        <header className="shrink-0 px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-3 md:pt-5">
          {/* Logo + step count */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-nemo-accent font-black text-xl tracking-widest">NEMO</span>
            <span className="text-white/30 text-sm tabular-nums">
              {step} / {totalSteps}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-1 w-full rounded-full bg-white/8 overflow-hidden">
            <div
              className="h-full rounded-full bg-nemo-accent transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </header>

        {/* Contenu scrollable */}
        <main
          className={cn(
            "flex-1 overflow-y-auto",
            "px-5 pt-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]",
            "md:pb-6"
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
