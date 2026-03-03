"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./use-auth";

export type UserRole = "free" | "sources" | "vip" | "admin";

export interface ProfileInfo {
  id: string;
  name: string;
  email: string | null;
  avatar_url?: string | null;
  debrid_api_key?: string | null;
  debrid_type?: "alldebrid" | "realdebrid" | null;
  preferred_quality?: string | null;
  preferred_language?: string | null;
  streaming_services?: string[] | null;
  show_paid_options?: boolean;
  phone_number?: string | null;
  personal_jellyfin_url?: string | null;
  personal_jellyfin_api_key?: string | null;
  webhook_token?: string | null;
  last_library_sync_at?: string | null;
  onboarding_completed?: boolean;
  letterboxd_username?: string | null;
  trakt_username?: string | null;
  role?: UserRole;
  jellyfin_user_id?: string | null;
  jellyfin_display_name?: string | null;
}

export function useProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async (): Promise<ProfileInfo | null> => {
      if (!user) return null;
      const res = await fetch("/api/profile");
      const data = await res.json();
      return data.profile ?? null;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 10,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (updates: Partial<ProfileInfo>) => {
      if (!user) throw new Error("Non connecté");
      const payload: Record<string, unknown> = {};
      if ("debrid_api_key" in updates) payload.debrid_api_key = updates.debrid_api_key ?? null;
      if ("debrid_type" in updates) payload.debrid_type = updates.debrid_type ?? null;
      if (updates.preferred_quality !== undefined) payload.preferred_quality = updates.preferred_quality;
      if (updates.preferred_language !== undefined) payload.preferred_language = updates.preferred_language;
      if ("streaming_services" in updates) payload.streaming_services = updates.streaming_services ?? null;
      if ("show_paid_options" in updates) payload.show_paid_options = updates.show_paid_options;
      if ("phone_number" in updates) payload.phone_number = updates.phone_number ?? null;
      if ("personal_jellyfin_url" in updates) payload.personal_jellyfin_url = updates.personal_jellyfin_url ?? null;
      if ("personal_jellyfin_api_key" in updates) payload.personal_jellyfin_api_key = updates.personal_jellyfin_api_key ?? null;
      if ("onboarding_completed" in updates) payload.onboarding_completed = updates.onboarding_completed;
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Erreur mise à jour");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
  });
}
