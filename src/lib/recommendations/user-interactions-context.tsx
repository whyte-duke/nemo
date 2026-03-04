"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/hooks/use-auth";

type InteractionType = "like" | "dislike" | "not_interested";

interface UserInteractionsState {
  /** Map<"tmdbId-mediaType", InteractionType> */
  interactionMap: Map<string, InteractionType>;
  loaded: boolean;
  setInteraction: (
    tmdbId: number,
    mediaType: "movie" | "tv",
    type: InteractionType | null
  ) => void;
  getInteraction: (tmdbId: number, mediaType: string) => InteractionType | null;
  isExcluded: (tmdbId: number, mediaType: string) => boolean;
}

const UserInteractionsContext = createContext<UserInteractionsState>({
  interactionMap: new Map(),
  loaded: false,
  setInteraction: () => {},
  getInteraction: () => null,
  isExcluded: () => false,
});

export function UserInteractionsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const [interactionMap, setInteractionMap] = useState<
    Map<string, InteractionType>
  >(new Map());
  const [loaded, setLoaded] = useState(false);
  const fetchedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;
    if (fetchedForRef.current === user.id) return;
    fetchedForRef.current = user.id;

    void fetch("/api/interactions/all")
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (data: { interactions: Record<string, InteractionType> } | null) => {
          if (!data?.interactions) {
            setLoaded(true);
            return;
          }
          const map = new Map<string, InteractionType>(
            Object.entries(data.interactions)
          );
          setInteractionMap(map);
          setLoaded(true);
        }
      )
      .catch(() => setLoaded(true));
  }, [user]);

  const setInteraction = useCallback(
    (
      tmdbId: number,
      mediaType: "movie" | "tv",
      type: InteractionType | null
    ) => {
      const key = `${tmdbId}-${mediaType}`;
      // Mise à jour optimiste
      setInteractionMap((prev) => {
        const next = new Map(prev);
        if (type === null) {
          next.delete(key);
        } else {
          next.set(key, type);
        }
        return next;
      });

      // POST en arrière-plan
      void fetch("/api/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tmdbId,
          mediaType,
          type: type === "not_interested" ? null : type,
          notInterested: type === "not_interested" ? true : undefined,
        }),
      });
    },
    []
  );

  const getInteraction = useCallback(
    (tmdbId: number, mediaType: string): InteractionType | null => {
      return interactionMap.get(`${tmdbId}-${mediaType}`) ?? null;
    },
    [interactionMap]
  );

  const isExcluded = useCallback(
    (tmdbId: number, mediaType: string): boolean => {
      const v = interactionMap.get(`${tmdbId}-${mediaType}`);
      return v === "like" || v === "dislike" || v === "not_interested";
    },
    [interactionMap]
  );

  return (
    <UserInteractionsContext.Provider
      value={{ interactionMap, loaded, setInteraction, getInteraction, isExcluded }}
    >
      {children}
    </UserInteractionsContext.Provider>
  );
}

export function useUserInteractions() {
  return useContext(UserInteractionsContext);
}

export function useQuickInteraction(
  tmdbId: number,
  mediaType: "movie" | "tv"
) {
  const { getInteraction, setInteraction } = useContext(
    UserInteractionsContext
  );
  const current = getInteraction(tmdbId, mediaType);

  const toggle = useCallback(
    (type: "like" | "dislike") => {
      setInteraction(tmdbId, mediaType, current === type ? null : type);
    },
    [tmdbId, mediaType, current, setInteraction]
  );

  return { current, toggle };
}
