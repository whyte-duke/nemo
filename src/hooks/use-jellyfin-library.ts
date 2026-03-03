"use client";

import { useJellyfinLibrary } from "@/contexts/jellyfin-library-context";

export interface JellyfinLibraryCheck {
  inLibrary: boolean;
  jellyfinItemId?: string;
  jellyfinItemUrl?: string;
}

/**
 * Vérifie si un item est dans la bibliothèque Jellyfin de l'utilisateur.
 * Utilise le cache Supabase chargé dans le JellyfinLibraryContext — pas d'appel réseau.
 */
export function useJellyfinLibraryCheck(
  tmdbId: number,
  mediaType: "movie" | "tv"
): { data: JellyfinLibraryCheck; isLoading: boolean } {
  const { isInLibrary, getJellyfinItemId, getJellyfinItemUrl, isLoading } = useJellyfinLibrary();

  const inLibrary = isInLibrary(tmdbId, mediaType);
  const jellyfinItemId = getJellyfinItemId(tmdbId, mediaType);
  const jellyfinItemUrl = jellyfinItemId ? getJellyfinItemUrl(jellyfinItemId) : undefined;

  return {
    data: inLibrary
      ? { inLibrary: true, jellyfinItemId, jellyfinItemUrl }
      : { inLibrary: false },
    isLoading,
  };
}

/**
 * Construit l'URL deep-link vers le client web Jellyfin.
 * @deprecated Utiliser getJellyfinItemUrl() depuis useJellyfinLibrary() à la place.
 */
export function getJellyfinItemUrl(jellyfinItemId: string): string {
  const base = process.env.NEXT_PUBLIC_JELLYFIN_URL ?? "";
  return `${base.replace(/\/$/, "")}/web/#/details?id=${jellyfinItemId}`;
}
