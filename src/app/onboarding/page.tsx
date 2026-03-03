"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import OnboardingShell from "@/components/onboarding/OnboardingShell";
import StepServices from "@/components/onboarding/StepServices";
import StepImport from "@/components/onboarding/StepImport";
import StepDone from "@/components/onboarding/StepDone";

export interface ImportResults {
  letterboxd?: { count: number };
  trakt?: { count: number };
  netflix?: { count: number };
}

function OnboardingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const stepParam = searchParams.get("step");
  const [step, setStep] = useState(stepParam ? parseInt(stepParam) : 1);
  const [importResults, setImportResults] = useState<ImportResults>({});

  // Sync step from URL (important pour le retour depuis OAuth)
  useEffect(() => {
    if (stepParam) {
      const parsed = parseInt(stepParam);
      if (!isNaN(parsed) && parsed !== step) setStep(parsed);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepParam]);

  const goToStep = (n: number) => {
    setStep(n);
    const url = new URL(window.location.href);
    url.searchParams.set("step", String(n));
    // Nettoyer les params OAuth
    url.searchParams.delete("connected");
    url.searchParams.delete("error");
    router.replace(url.pathname + url.search);
  };

  const handleServicesNext = () => goToStep(2);

  const handleImportNext = (results: ImportResults) => {
    setImportResults(results);
    goToStep(3);
  };

  return (
    <OnboardingShell step={step}>
      {step === 1 && (
        <StepServices onNext={handleServicesNext} />
      )}
      {step === 2 && (
        <StepImport
          onNext={handleImportNext}
          initialResults={importResults}
        />
      )}
      {step === 3 && (
        <StepDone imports={importResults} />
      )}
    </OnboardingShell>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center">
          <Loader2 className="size-8 text-nemo-accent animate-spin" />
        </div>
      }
    >
      <OnboardingContent />
    </Suspense>
  );
}
