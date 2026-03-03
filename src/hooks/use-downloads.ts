"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { DownloadQueueRow } from "@/types/download";

// ─── Fetch liste des téléchargements ─────────────────────────────────────────

async function fetchDownloadQueue(): Promise<DownloadQueueRow[]> {
  const res = await fetch("/api/download/queue");
  if (!res.ok) throw new Error("Impossible de charger la file");
  const data = await res.json();
  return data.downloads as DownloadQueueRow[];
}

export function useDownloadQueue() {
  return useQuery({
    queryKey: ["download-queue"],
    queryFn: fetchDownloadQueue,
    staleTime: 30_000,
  });
}

// ─── Lancer un téléchargement simple ─────────────────────────────────────────

interface StartDownloadPayload {
  url: string;
  selected_indices: number[];
  destination_path: string;
  quality?: string;
  audio_languages?: string[];
  sub_languages?: string[];
  metadata: {
    title: string;
    type: "movie" | "tv";
    user_id: string;
    user_name: string;
    tmdb_id?: number;
    season_number?: number;
    episode_number?: number;
  };
}

async function startDownload(payload: StartDownloadPayload) {
  const res = await fetch("/api/download/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Erreur lors du lancement");
  return data as { status: string; message: string; download_id: string };
}

export function useStartDownload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: startDownload,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["download-queue"] });
    },
  });
}

// ─── Lancer un téléchargement batch (saison complète) ────────────────────────

interface BatchDownloadPayload {
  urls: string[];
  reference_indices: number[];
  destination_dir: string;
  quality?: string;
  audio_languages?: string[];
  sub_languages?: string[];
  metadata: {
    title: string;
    type: "movie" | "tv";
    user_id: string;
    user_name: string;
    tmdb_id?: number;
    season_number?: number;
  };
}

async function startBatchDownload(payload: BatchDownloadPayload) {
  const res = await fetch("/api/download/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Erreur lors du lancement du batch");
  return data as { status: string; message: string; download_id: string };
}

export function useStartBatchDownload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: startBatchDownload,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["download-queue"] });
    },
  });
}
