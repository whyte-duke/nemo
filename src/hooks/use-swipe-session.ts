"use client";

import { useState, useCallback, useRef } from "react";

export type SwipeAction = "like" | "dislike" | "list" | "skip" | "pas_vu";

interface SwipeEntry {
  tmdbId: number;
  mediaType: "movie" | "tv";
  action: SwipeAction;
}

export interface SwipeCardData {
  id: number;
  media_type?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  genre_ids: number[];
  vote_average: number;
  overview: string;
}

// ── "Pas vu" — mémoriser 7 jours ─────────────────────────────────────────────

const PAS_VU_KEY = "nemo_pas_vu";
const PAS_VU_TTL = 7 * 24 * 3600 * 1000;

function markPasVu(tmdbId: number) {
  if (typeof window === "undefined") return;
  const map: Record<string, number> = JSON.parse(localStorage.getItem(PAS_VU_KEY) ?? "{}") as Record<string, number>;
  map[tmdbId] = Date.now();
  const now = Date.now();
  const cleaned = Object.fromEntries(Object.entries(map).filter(([, ts]) => now - (ts as number) < PAS_VU_TTL));
  localStorage.setItem(PAS_VU_KEY, JSON.stringify(cleaned));
}

function getPasVuSet(): Set<number> {
  if (typeof window === "undefined") return new Set();
  try {
    const map: Record<string, number> = JSON.parse(localStorage.getItem(PAS_VU_KEY) ?? "{}") as Record<string, number>;
    const now = Date.now();
    return new Set(
      Object.entries(map)
        .filter(([, ts]) => now - (ts as number) < PAS_VU_TTL)
        .map(([id]) => Number(id))
    );
  } catch {
    return new Set();
  }
}

// ── Session persistée ─────────────────────────────────────────────────────────

const SESSION_KEY = "nemo_swipe_session";
const SESSION_TTL = 24 * 3600 * 1000;
const PENDING_KEY = "nemo_swipe_pending";

interface SavedSession {
  cards: SwipeCardData[];
  currentIndex: number;
  swipeCount: number;
  level: number;
  likedGenres: number[];
  savedAt: number;
}

function saveSession(s: Omit<SavedSession, "savedAt">) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_KEY, JSON.stringify({ ...s, savedAt: Date.now() }));
}

function restoreSession(): { session: SavedSession | null; expired: boolean } {
  try {
    if (typeof window === "undefined") return { session: null, expired: false };
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return { session: null, expired: false };
    const s = JSON.parse(raw) as SavedSession;
    if (Date.now() - s.savedAt > SESSION_TTL) return { session: null, expired: true };
    if (!s.cards?.length || s.currentIndex >= s.cards.length) return { session: null, expired: false };
    return { session: s, expired: false };
  } catch {
    return { session: null, expired: false };
  }
}

function savePendingToStorage(entries: SwipeEntry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PENDING_KEY, JSON.stringify(entries));
}

function restorePendingFromStorage(): SwipeEntry[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SwipeEntry[];
  } catch {
    return [];
  }
}

function clearPendingStorage() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PENDING_KEY);
}

// Déduit le niveau depuis le count total d'interactions en DB
function levelFromCount(count: number): { level: number; swipeCount: number } {
  // Paliers : L1=0-9, L2=10-14, L3=15-19, L4=20-24, L5=25+
  if (count >= 25) return { level: 5, swipeCount: count - 20 };
  if (count >= 20) return { level: 4, swipeCount: count - 20 };
  if (count >= 15) return { level: 3, swipeCount: count - 15 };
  if (count >= 10) return { level: 2, swipeCount: count - 10 };
  return { level: 1, swipeCount: count };
}

// ── Target par niveau ─────────────────────────────────────────────────────────

function getLevelTarget(level: number) {
  return Math.min(10 + (level - 1) * 5, 25); // 10, 15, 20, 25, 25...
}

export function useSwipeSession() {
  const [cards, setCards] = useState<SwipeCardData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeCount, setSwipeCount] = useState(0);
  const [level, setLevel] = useState(1);
  const [isMilestone, setIsMilestone] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const pendingRef = useRef<SwipeEntry[]>([]);
  const likedGenresRef = useRef<number[]>([]);
  const isLoadingRef = useRef(false);

  // ── Sauvegarde en batch des interactions ──────────────────────────────────

  const savePending = useCallback(async (entries: SwipeEntry[]) => {
    const actionable = entries.filter((e) => e.action !== "skip" && e.action !== "pas_vu");
    if (actionable.length === 0) return;

    await Promise.allSettled(
      actionable.map(async (entry) => {
        try {
          if (entry.action === "list") {
            await fetch("/api/suggestions-list", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                tmdbId: entry.tmdbId,
                mediaType: entry.mediaType,
                action: "add",
              }),
            });
          } else {
            const type = entry.action === "like" ? "like" : "dislike";
            await fetch("/api/interactions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                tmdbId: entry.tmdbId,
                mediaType: entry.mediaType,
                type,
              }),
            });
          }

          void fetch("/api/media-features/fetch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              tmdbId: entry.tmdbId,
              mediaType: entry.mediaType,
            }),
          });
        } catch {
          // Silently ignore network errors on individual saves
        }
      })
    );

    const hasSignal = actionable.some((e) => e.action === "like" || e.action === "dislike");
    if (hasSignal) {
      void fetch("/api/taste-profile", { method: "POST" });
    }

    // Nettoyer le pending localStorage après envoi réussi
    clearPendingStorage();
  }, []);

  // ── Chargement des cartes ─────────────────────────────────────────────────

  const initLevelFromDB = useCallback(async () => {
    try {
      const res = await fetch("/api/interactions/count");
      if (!res.ok) return;
      const data = await res.json() as { count: number };
      const { level: dbLevel, swipeCount: dbSwipeCount } = levelFromCount(data.count);
      setLevel(dbLevel);
      setSwipeCount(dbSwipeCount);
    } catch {
      // Silencieux — on garde les valeurs par défaut
    }
  }, []);

  const loadCards = useCallback(async (forceReload = false) => {
    if (isLoadingRef.current) return;

    // Tenter restauration depuis localStorage si pas de force reload
    if (!forceReload) {
      const { session: saved, expired } = restoreSession();
      if (saved) {
        const pasVu = getPasVuSet();
        const filteredCards = saved.cards.filter((c) => !pasVu.has(c.id));
        if (filteredCards.length > saved.currentIndex) {
          setCards(filteredCards);
          setCurrentIndex(saved.currentIndex);
          setSwipeCount(saved.swipeCount);
          setLevel(saved.level);
          likedGenresRef.current = saved.likedGenres;
          // Restaurer le batch pending non encore envoyé
          const pendingRestored = restorePendingFromStorage();
          if (pendingRestored.length > 0) {
            pendingRef.current = pendingRestored;
          }
          return;
        }
      }
      // Session expirée ou absente → restaurer le niveau depuis la DB
      if (expired || !saved) {
        void initLevelFromDB();
      }
    }

    isLoadingRef.current = true;
    setIsLoading(true);
    try {
      const genres = [...new Set(likedGenresRef.current)].slice(0, 6).join(",");
      const url = `/api/discover/cards${genres ? `?genres=${encodeURIComponent(genres)}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json() as { cards: SwipeCardData[] };
      if (data.cards.length > 0) {
        const pasVu = getPasVuSet();
        const filteredCards = data.cards.filter((c: SwipeCardData) => !pasVu.has(c.id));
        setCards(filteredCards);
        setCurrentIndex(0);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [initLevelFromDB]);

  // ── Swipe ─────────────────────────────────────────────────────────────────

  const swipe = useCallback(
    async (action: SwipeAction) => {
      const card = cards[currentIndex];
      if (!card) return;

      const entry: SwipeEntry = {
        tmdbId: card.id,
        mediaType: (card.media_type ?? "movie") as "movie" | "tv",
        action,
      };

      // Marquer "pas vu" dans localStorage
      if (action === "pas_vu") markPasVu(card.id);

      // Mémoriser les genres likés pour adapter la sélection
      if (action === "like") {
        likedGenresRef.current = [...likedGenresRef.current, ...card.genre_ids];
      }

      // Accumuler les interactions (sauf skip et pas_vu)
      if (action !== "skip" && action !== "pas_vu") {
        pendingRef.current.push(entry);
        // Persister immédiatement pour survivre à un refresh avant le batch
        savePendingToStorage(pendingRef.current);
      }

      // skip ne compte pas dans l'objectif
      const newCount = swipeCount + (action === "skip" ? 0 : 1);
      setSwipeCount(newCount);

      const nextIndex = currentIndex + 1;

      // Sauvegarder par batch de 5
      if (pendingRef.current.length >= 5) {
        const toSave = [...pendingRef.current];
        pendingRef.current = [];
        void savePending(toSave);
      }

      const levelTarget = getLevelTarget(level);

      // Vérifier milestone atteint
      if (newCount >= levelTarget) {
        if (pendingRef.current.length > 0) {
          const toSave = [...pendingRef.current];
          pendingRef.current = [];
          void savePending(toSave);
        }
        setIsMilestone(true);
        return;
      }

      // Sauvegarder la progression
      saveSession({
        cards,
        currentIndex: nextIndex,
        swipeCount: newCount,
        level,
        likedGenres: likedGenresRef.current,
      });

      if (nextIndex >= cards.length) {
        await loadCards(true);
      } else {
        setCurrentIndex(nextIndex);
      }
    },
    [cards, currentIndex, swipeCount, level, savePending, loadCards]
  );

  // ── Continuer au niveau suivant ───────────────────────────────────────────

  const continueNextLevel = useCallback(async () => {
    setIsMilestone(false);
    setSwipeCount(0);
    setLevel((l) => l + 1);
    await loadCards(true);
  }, [loadCards]);

  return {
    cards,
    currentIndex,
    currentCard: cards[currentIndex] ?? null,
    swipeCount,
    levelTarget: getLevelTarget(level),
    level,
    isMilestone,
    isLoading,
    loadCards,
    swipe,
    continueNextLevel,
  };
}
