"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, label: "Mes services" },
  { id: 2, label: "Mon historique" },
  { id: 3, label: "Bienvenue !" },
];

interface OnboardingShellProps {
  step: number;
  children: React.ReactNode;
}

export default function OnboardingShell({ step, children }: OnboardingShellProps) {
  return (
    <div className="w-full max-w-2xl">
      {/* Logo */}
      <div className="text-center mb-8">
        <span className="text-nemo-accent font-black text-3xl tracking-widest">NEMO</span>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-center gap-0 mb-8">
        {STEPS.map((s, i) => {
          const done = step > s.id;
          const active = step === s.id;

          return (
            <div key={s.id} className="flex items-center">
              {/* Dot + label */}
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "size-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300",
                    done
                      ? "bg-nemo-accent text-black"
                      : active
                      ? "bg-nemo-accent/20 border-2 border-nemo-accent text-nemo-accent"
                      : "bg-white/5 border-2 border-white/15 text-white/30"
                  )}
                >
                  {done ? <Check className="size-4" strokeWidth={3} /> : s.id}
                </div>
                <span
                  className={cn(
                    "text-xs font-medium whitespace-nowrap transition-colors",
                    active ? "text-nemo-accent" : done ? "text-white/60" : "text-white/25"
                  )}
                >
                  {s.label}
                </span>
              </div>

              {/* Connecteur */}
              {i < STEPS.length - 1 && (
                <div
                  className={cn(
                    "h-px w-16 sm:w-24 mx-3 mb-5 transition-colors duration-300",
                    step > s.id ? "bg-nemo-accent/50" : "bg-white/10"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Carte principale */}
      <div className="glass-tile p-6 sm:p-8">
        {children}
      </div>
    </div>
  );
}
