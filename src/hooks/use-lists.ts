"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import type { ListSummary } from "@/app/api/lists/route";

export type { ListSummary };

export function useMyLists() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["lists", user?.id],
    queryFn: async (): Promise<ListSummary[]> => {
      if (!user) return [];
      const res = await fetch("/api/lists");
      if (!res.ok) throw new Error("Erreur chargement listes");
      return res.json();
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });
}

export function useIsInAnyList(tmdbId: number, mediaType: "movie" | "tv") {
  const { data: lists = [] } = useMyLists();
  // Vérifie si l'item est dans la liste par défaut (pour le bouton Check rapide)
  // Note: cette vérification est simplifiée — on utilise le cache my-list pour ça
  return { lists, tmdbId, mediaType };
}

export function useToggleItemInList() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      listId,
      tmdbId,
      mediaType,
      action,
    }: {
      listId: string;
      tmdbId: number;
      mediaType: "movie" | "tv";
      action: "add" | "remove";
    }) => {
      if (!user) throw new Error("Non connecté");
      if (action === "add") {
        const res = await fetch(`/api/lists/${listId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tmdbId, mediaType }),
        });
        if (!res.ok) throw new Error("Erreur");
      } else {
        const res = await fetch(
          `/api/lists/${listId}/items?tmdbId=${tmdbId}&mediaType=${mediaType}`,
          { method: "DELETE" }
        );
        if (!res.ok) throw new Error("Erreur");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lists", user?.id] });
      void queryClient.invalidateQueries({ queryKey: ["my-list", user?.id] });
    },
  });
}

export function useCreateList() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (body: { name: string; icon?: string; friendIds?: string[] }) => {
      const res = await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error((err as { error?: string }).error ?? "Erreur création");
      }
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lists", user?.id] });
    },
  });
}

export function useUpdateList() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; name?: string; icon?: string; is_public?: boolean }) => {
      const res = await fetch(`/api/lists/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Erreur mise à jour");
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lists", user?.id] });
    },
  });
}

export function useDeleteList() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (listId: string) => {
      const res = await fetch(`/api/lists/${listId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur suppression");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lists", user?.id] });
    },
  });
}

export function useAddListMember() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ listId, userId }: { listId: string; userId: string }) => {
      const res = await fetch(`/api/lists/${listId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error("Erreur");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lists", user?.id] });
    },
  });
}

export function useRemoveListMember() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ listId, userId }: { listId: string; userId: string }) => {
      const res = await fetch(`/api/lists/${listId}/members?userId=${userId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erreur");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["lists", user?.id] });
    },
  });
}
