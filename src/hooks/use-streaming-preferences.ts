"use client";

import { useProfile } from "./use-profile";
import type { StreamingOption } from "./use-streaming-availability";

export interface StreamingPreferences {
  /** null = tous les services, sinon liste des IDs sélectionnés */
  services: string[] | null;
  showPaid: boolean;
  isLoading: boolean;
}

export function useStreamingPreferences(): StreamingPreferences {
  const { data: profile, isLoading } = useProfile();

  return {
    services: profile?.streaming_services ?? null,
    showPaid: profile?.show_paid_options ?? true,
    isLoading,
  };
}

/** Filtre un tableau d'options selon les préférences utilisateur */
export function filterStreamingOptions(
  options: StreamingOption[],
  prefs: StreamingPreferences
): StreamingOption[] {
  return options.filter((opt) => {
    // Filtre par service souscrit
    if (prefs.services !== null && prefs.services.length > 0) {
      if (!prefs.services.includes(opt.service.id)) return false;
    }
    // Filtre par type payant
    if (!prefs.showPaid && (opt.type === "rent" || opt.type === "buy")) {
      return false;
    }
    return true;
  });
}
