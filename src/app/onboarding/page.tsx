"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useProfile, type UserRole } from "@/hooks/use-profile";
import OnboardingShell from "@/components/onboarding/OnboardingShell";
import StepServices from "@/components/onboarding/StepServices";
import StepImport from "@/components/onboarding/StepImport";
import StepDiscover from "@/components/onboarding/StepDiscover";
import StepDone from "@/components/onboarding/StepDone";
import StepPremiumWelcome from "@/components/onboarding/StepPremiumWelcome";
import StepVlcStreaming from "@/components/onboarding/StepVlcStreaming";
import StepInviteFriends from "@/components/onboarding/StepInviteFriends";

export interface ImportResults {
  letterboxd?: { count: number };
  trakt?: { count: number };
  netflix?: { count: number };
}

// ── Step configs by role ──────────────────────────────────────────────────────

type StepKey =
  | "premiumWelcome"
  | "vlcStreaming"
  | "inviteFriends"
  | "services"
  | "import"
  | "discover"
  | "done";

const STEPS_VIP: StepKey[] = [
  "premiumWelcome",
  "vlcStreaming",
  "inviteFriends",
  "discover",
  "import",
];

const STEPS_SOURCES: StepKey[] = [
  "premiumWelcome",
  "vlcStreaming",
  "inviteFriends",
  "discover",
  "import",
];

const STEPS_FREE: StepKey[] = ["services", "import", "discover", "done"];

function getStepsForRole(role: UserRole | undefined): StepKey[] {
  if (role === "vip" || role === "admin") return STEPS_VIP;
  if (role === "sources") return STEPS_SOURCES;
  return STEPS_FREE;
}

// ── Main content ──────────────────────────────────────────────────────────────

function OnboardingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: profile, isLoading: profileLoading } = useProfile();

  const stepParam = searchParams.get("step");
  const resetParam = searchParams.get("reset");
  const [step, setStep] = useState(stepParam ? parseInt(stepParam) : 1);
  const [importResults, setImportResults] = useState<ImportResults>({});

  // Clear localStorage when coming from reset-onboarding (?reset=1)
  useEffect(() => {
    if (resetParam === "1" && typeof window !== "undefined") {
      const keysToReset = [
        "nemo_swipe_session",
        "nemo_swipe_pending",
        "nemo_discover_onboarded",
        "nemo_pas_vu",
      ];
      keysToReset.forEach((k) => localStorage.removeItem(k));
      // Remove ?reset=1 from URL without triggering a re-render loop
      const url = new URL(window.location.href);
      url.searchParams.delete("reset");
      router.replace(url.pathname + url.search);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetParam]);

  // Sync step from URL (important pour le retour depuis OAuth)
  useEffect(() => {
    if (stepParam) {
      const parsed = parseInt(stepParam);
      if (!isNaN(parsed) && parsed !== step) setStep(parsed);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepParam]);

  const role = profile?.role;
  const steps = getStepsForRole(role);
  const totalSteps = steps.length;
  const currentStepKey = steps[step - 1] ?? "services";
  const isLastStep = step === totalSteps;

  const goToStep = (n: number) => {
    setStep(n);
    const url = new URL(window.location.href);
    url.searchParams.set("step", String(n));
    url.searchParams.delete("connected");
    url.searchParams.delete("error");
    router.replace(url.pathname + url.search);
  };

  const goNext = () => {
    if (isLastStep) return;
    goToStep(step + 1);
  };

  /** Called by the final step — marks onboarding complete and redirects */
  const completeOnboarding = async () => {
    try {
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboarding_completed: true }),
      });
    } catch {
      // continue anyway
    }
    window.location.href = "/";
  };

  const handleImportNext = (results: ImportResults) => {
    setImportResults(results);
    if (isLastStep) {
      void completeOnboarding();
      return;
    }
    goToStep(step + 1);
  };

  // Loading state while fetching profile role
  if (profileLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#0b0d12]">
        <Loader2 className="size-8 text-nemo-accent animate-spin" />
      </div>
    );
  }

  const effectiveRole: UserRole = role ?? "free";

  return (
    <OnboardingShell step={step} totalSteps={totalSteps}>
      {currentStepKey === "premiumWelcome" && (
        <StepPremiumWelcome role={effectiveRole} onNext={goNext} />
      )}

      {currentStepKey === "vlcStreaming" && (
        <StepVlcStreaming role={effectiveRole} onNext={goNext} />
      )}

      {currentStepKey === "inviteFriends" && (
        <StepInviteFriends role={effectiveRole} onNext={goNext} />
      )}

      {currentStepKey === "services" && (
        <StepServices onNext={goNext} />
      )}

      {currentStepKey === "import" && (
        <StepImport onNext={handleImportNext} initialResults={importResults} role={effectiveRole} />
      )}

      {currentStepKey === "discover" && (
        <StepDiscover onNext={goNext} />
      )}

      {currentStepKey === "done" && (
        <StepDone imports={importResults} />
      )}
    </OnboardingShell>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh flex items-center justify-center bg-[#0b0d12]">
          <Loader2 className="size-8 text-nemo-accent animate-spin" />
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
