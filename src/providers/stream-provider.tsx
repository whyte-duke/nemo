"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { ParsedStream, StreamFusionConfig } from "@/types/stremio";
import { fetchStreams, parseStreams, buildDefaultConfig } from "@/lib/stremio/resolver";

interface StreamState {
  streams: ParsedStream[];
  isLoading: boolean;
  error: string | null;
  currentImdbId: string | null;
}

interface StreamContextValue {
  state: StreamState;
  resolveStreams: (imdbId: string, mediaType?: "movie" | "series") => Promise<void>;
  clearStreams: () => void;
  config: StreamFusionConfig;
}

const StreamContext = createContext<StreamContextValue | null>(null);

const DEFAULT_CONFIG = buildDefaultConfig();

export function StreamProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StreamState>({
    streams: [],
    isLoading: false,
    error: null,
    currentImdbId: null,
  });

  const resolveStreams = useCallback(
    async (imdbId: string, mediaType: "movie" | "series" = "movie") => {
      setState({ streams: [], isLoading: true, error: null, currentImdbId: imdbId });

      try {
        const response = await fetchStreams(imdbId, DEFAULT_CONFIG, mediaType);
        const parsed = parseStreams(response);
        setState({ streams: parsed, isLoading: false, error: null, currentImdbId: imdbId });
      } catch (err) {
        setState({
          streams: [],
          isLoading: false,
          error: err instanceof Error ? err.message : "Erreur lors de la résolution des flux",
          currentImdbId: imdbId,
        });
      }
    },
    []
  );

  const clearStreams = useCallback(() => {
    setState({ streams: [], isLoading: false, error: null, currentImdbId: null });
  }, []);

  return (
    <StreamContext.Provider value={{ state, resolveStreams, clearStreams, config: DEFAULT_CONFIG }}>
      {children}
    </StreamContext.Provider>
  );
}

export function useStream() {
  const ctx = useContext(StreamContext);
  if (!ctx) throw new Error("useStream doit être utilisé dans StreamProvider");
  return ctx;
}
