"use client";

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import type { FriendProfile } from "@/app/api/friends/route";
import type { ActivityEvent } from "@/types/supabase";

export type { FriendProfile };

export function useFriends() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["friends", user?.id],
    queryFn: async (): Promise<FriendProfile[]> => {
      if (!user) return [];
      const res = await fetch("/api/friends");
      if (!res.ok) throw new Error("Erreur chargement amis");
      return res.json();
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });
}

export function useFriendRequests() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["friend-requests", user?.id],
    queryFn: async (): Promise<Array<{ id: string; created_at: string; from: { id: string; display_name: string | null; avatar_url: string | null; role: string } }>> => {
      if (!user) return [];
      const res = await fetch("/api/friends/request");
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    enabled: !!user,
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 60,
  });
}

export function useSendFriendRequest() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (toUserId: string) => {
      const res = await fetch("/api/friends/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error((err as { error?: string }).error ?? "Erreur");
      }
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["friend-requests", user?.id] });
    },
  });
}

export function useRespondFriendRequest() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "accepted" | "declined" }) => {
      const res = await fetch(`/api/friends/request/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Erreur");
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["friend-requests", user?.id] });
      void queryClient.invalidateQueries({ queryKey: ["friends", user?.id] });
    },
  });
}

export function useSearchUsers(query: string) {
  return useQuery({
    queryKey: ["users-search", query],
    queryFn: async () => {
      if (query.length < 2) return [];
      const res = await fetch(`/api/friends/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error("Erreur");
      return res.json() as Promise<Array<{
        id: string;
        display_name: string | null;
        avatar_url: string | null;
        role: string;
        is_friend: boolean;
        request_pending: boolean;
      }>>;
    },
    enabled: query.length >= 2,
    staleTime: 1000 * 30,
  });
}

export function useFriendProfile(userId: string | null) {
  return useQuery({
    queryKey: ["friend-profile", userId],
    queryFn: async () => {
      if (!userId) return null;
      const res = await fetch(`/api/friends/${userId}/profile`);
      if (!res.ok) throw new Error("Utilisateur introuvable");
      return res.json() as Promise<{
        id: string;
        display_name: string | null;
        avatar_url: string | null;
        role: string;
        created_at: string;
        is_friend: boolean;
        friends_since: string | null;
        friendship_source: string | null;
        request_pending: boolean;
        request_direction: "sent" | "received" | null;
        request_id: string | null;
      }>;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useFriendStats(userId: string | null) {
  return useQuery({
    queryKey: ["friend-stats", userId],
    queryFn: async () => {
      if (!userId) return null;
      const res = await fetch(`/api/friends/${userId}/stats`);
      if (!res.ok) throw new Error("Erreur");
      return res.json() as Promise<{
        total_watched: number;
        total_likes: number;
        total_dislikes: number;
        total_lists: number;
        top_genres: Array<{ name: string; count: number }>;
        recent_watched: Array<{ tmdb_id: number; media_type: string; last_watched_at: string }>;
      }>;
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useFriendActivity(type?: string) {
  const { user } = useAuth();

  return useInfiniteQuery({
    queryKey: ["friend-activity", user?.id, type],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const params = new URLSearchParams();
      if (type) params.set("type", type);
      if (pageParam) params.set("cursor", pageParam);

      const res = await fetch(`/api/activity?${params}`);
      if (!res.ok) throw new Error("Erreur");
      return res.json() as Promise<{ events: ActivityEvent[]; hasMore: boolean }>;
    },
    getNextPageParam: (lastPage: { events: ActivityEvent[]; hasMore: boolean }) => {
      if (!lastPage.hasMore || lastPage.events.length === 0) return undefined;
      return lastPage.events[lastPage.events.length - 1].timestamp;
    },
    initialPageParam: undefined as string | undefined,
    enabled: !!user,
    staleTime: 1000 * 60,
  });
}
