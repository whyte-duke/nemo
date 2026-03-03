"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import type { ListItem } from "@/types/supabase";
import type { MyListItem } from "@/app/api/my-list/route";

export function useMyList() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["my-list", user?.id],
    queryFn: async (): Promise<MyListItem[]> => {
      if (!user) return [];
      const res = await fetch("/api/my-list");
      if (!res.ok) throw new Error("Erreur chargement liste");
      return res.json();
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });
}

export function useIsInMyList(tmdbId: number, mediaType: "movie" | "tv") {
  const { data: items = [] } = useMyList();
  return items.some((item) => item.tmdb_id === tmdbId && item.media_type === mediaType);
}

export function useToggleMyList() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      tmdbId,
      mediaType,
      action,
    }: {
      tmdbId: number;
      mediaType: "movie" | "tv";
      action: "add" | "remove";
    }) => {
      if (!user) throw new Error("Non connecté");
      const res = await fetch("/api/my-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId, mediaType, action }),
      });
      if (!res.ok) throw new Error("Erreur mise à jour liste");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["my-list", user?.id] });
    },
  });
}

export function useInteraction(tmdbId: number, mediaType: "movie" | "tv") {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: interaction } = useQuery({
    queryKey: ["interaction", user?.id, tmdbId, mediaType],
    queryFn: async (): Promise<"like" | "dislike" | null> => {
      if (!user) return null;
      const res = await fetch(
        `/api/interactions?tmdbId=${tmdbId}&mediaType=${mediaType}`
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data.type ?? null;
    },
    enabled: !!user,
  });

  const { mutate: setInteraction } = useMutation({
    mutationFn: async (type: "like" | "dislike" | null) => {
      if (!user) return;
      const res = await fetch("/api/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId, mediaType, type }),
      });
      if (!res.ok) throw new Error("Erreur");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["interaction", user?.id, tmdbId, mediaType],
      });
    },
  });

  return { interaction, setInteraction };
}
