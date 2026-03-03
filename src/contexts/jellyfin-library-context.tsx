"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useAuth } from "@/hooks/use-auth";

interface LibraryItem {
  tmdb_id: string;
  media_type: "movie" | "tv";
  jellyfin_item_id: string;
}

interface JellyfinLibraryContextValue {
  /** Vérifie si un item est dans la bibliothèque Jellyfin de l'utilisateur. O(1). */
  isInLibrary: (tmdbId: number | string, mediaType: "movie" | "tv") => boolean;
  /** Retourne l'ID Jellyfin d'un item pour construire un deep-link vers le client web. */
  getJellyfinItemId: (tmdbId: number | string, mediaType: "movie" | "tv") => string | undefined;
  /** Construit l'URL deep-link vers le client web Jellyfin. */
  getJellyfinItemUrl: (jellyfinItemId: string) => string;
  /** Recharge le cache depuis Supabase (appelé après une sync). */
  refreshLibrary: () => Promise<void>;
  /** Déclenche une sync manuelle via l'API. */
  syncLibrary: () => Promise<{ synced?: number; error?: string }>;
  isLoading: boolean;
  isSyncing: boolean;
  count: number;
  hasPersonalJellyfin: boolean;
  jellyfinUrl: string | null;
  lastSyncedAt: string | null;
}

const JellyfinLibraryContext = createContext<JellyfinLibraryContextValue>({
  isInLibrary: () => false,
  getJellyfinItemId: () => undefined,
  getJellyfinItemUrl: () => "",
  refreshLibrary: async () => {},
  syncLibrary: async () => ({}),
  isLoading: false,
  isSyncing: false,
  count: 0,
  hasPersonalJellyfin: false,
  jellyfinUrl: null,
  lastSyncedAt: null,
});

export function JellyfinLibraryProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();

  // Set<"tmdbId:mediaType"> pour les lookups O(1) dans les badges de carte
  const [librarySet, setLibrarySet] = useState<Set<string>>(new Set());
  // Map<"tmdbId:mediaType" → jellyfinItemId> pour les deep-links sur les pages de détail
  const [itemMap, setItemMap] = useState<Map<string, string>>(new Map());

  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasPersonalJellyfin, setHasPersonalJellyfin] = useState(false);
  const [jellyfinUrl, setJellyfinUrl] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const loadedUserId = useRef<string | null>(null);
  const loadedAt = useRef<number>(0);
  /** Durée de vie du cache en mémoire : 5 minutes */
  const CACHE_TTL_MS = 5 * 60 * 1000;

  const loadLibrary = useCallback(async () => {
    if (!user) {
      setLibrarySet(new Set());
      setItemMap(new Map());
      setHasPersonalJellyfin(false);
      setJellyfinUrl(null);
      setLastSyncedAt(null);
      loadedUserId.current = null;
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/jellyfin/library/items");
      if (!res.ok) return;

      const data = await res.json() as {
        hasPersonalJellyfin: boolean;
        jellyfinUrl: string | null;
        lastSyncedAt: string | null;
        items: LibraryItem[];
      };

      setHasPersonalJellyfin(data.hasPersonalJellyfin);
      setJellyfinUrl(data.jellyfinUrl);
      setLastSyncedAt(data.lastSyncedAt);

      if (data.hasPersonalJellyfin && data.items.length > 0) {
        const newSet = new Set<string>();
        const newMap = new Map<string, string>();
        for (const item of data.items) {
          const key = `${item.tmdb_id}:${item.media_type}`;
          newSet.add(key);
          newMap.set(key, item.jellyfin_item_id);
        }
        setLibrarySet(newSet);
        setItemMap(newMap);
      } else {
        setLibrarySet(new Set());
        setItemMap(new Map());
      }

      loadedUserId.current = user.id;
      loadedAt.current = Date.now();
    } catch {
      // Silencieux — ne pas casser l'app si le fetch échoue
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    // Ne pas re-fetcher si même utilisateur et cache encore frais
    if (user?.id === loadedUserId.current && Date.now() - loadedAt.current < CACHE_TTL_MS) return;
    void loadLibrary();
  }, [loadLibrary, authLoading, user?.id, CACHE_TTL_MS]);

  const syncLibrary = useCallback(async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/jellyfin/sync", { method: "POST" });
      const data = await res.json() as { ok?: boolean; synced?: number; error?: string };
      if (res.ok) {
        // Recharger le cache après une sync réussie
        await loadLibrary();
        return { synced: data.synced };
      }
      return { error: data.error ?? "Erreur inconnue" };
    } catch {
      return { error: "Impossible de contacter le serveur" };
    } finally {
      setIsSyncing(false);
    }
  }, [loadLibrary]);

  const isInLibrary = useCallback(
    (tmdbId: number | string, mediaType: "movie" | "tv") =>
      librarySet.has(`${tmdbId}:${mediaType}`),
    [librarySet]
  );

  const getJellyfinItemId = useCallback(
    (tmdbId: number | string, mediaType: "movie" | "tv") =>
      itemMap.get(`${tmdbId}:${mediaType}`),
    [itemMap]
  );

  const getJellyfinItemUrl = useCallback(
    (jellyfinItemId: string) => {
      const base = (jellyfinUrl ?? "").replace(/\/$/, "");
      return `${base}/web/#/details?id=${jellyfinItemId}`;
    },
    [jellyfinUrl]
  );

  return (
    <JellyfinLibraryContext.Provider
      value={{
        isInLibrary,
        getJellyfinItemId,
        getJellyfinItemUrl,
        refreshLibrary: loadLibrary,
        syncLibrary,
        isLoading,
        isSyncing,
        count: librarySet.size,
        hasPersonalJellyfin,
        jellyfinUrl,
        lastSyncedAt,
      }}
    >
      {children}
    </JellyfinLibraryContext.Provider>
  );
}

export function useJellyfinLibrary(): JellyfinLibraryContextValue {
  return useContext(JellyfinLibraryContext);
}
