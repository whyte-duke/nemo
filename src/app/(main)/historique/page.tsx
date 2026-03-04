"use client";

import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  History,
  Clock,
  Film,
  Tv,
  Play,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  MessageSquareQuote,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { tmdbImage } from "@/lib/tmdb/client";
import { ProviderLogo } from "@/components/ui/ProviderLogo";
import type { HistoryItem, HistoryPage } from "@/app/api/historique/route";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  if (hours < 24) return `il y a ${hours}h`;
  if (days === 1) return "hier";
  if (days < 7) return `il y a ${days} jours`;
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: new Date(dateStr).getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (d.toDateString() === yesterday.toDateString()) return "Hier";
  const diffDays = Math.floor((today.getTime() - d.getTime()) / 86_400_000);
  if (diffDays < 7) {
    return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  }
  return d.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
}

const SOURCE_LABELS: Record<string, string> = {
  nemo: "Nemo",
  letterboxd: "Letterboxd",
  netflix_csv: "Netflix",
  trakt: "Trakt.tv",
};

const SOURCE_COLORS: Record<string, string> = {
  nemo: "#6366f1",
  letterboxd: "#00C030",
  netflix_csv: "#E50914",
  trakt: "#ED1C24",
};

/** Retourne le provider key pour ProviderLogo (netflix_csv → netflix) */
function sourceToLogoKey(source: string): string | null {
  if (source === "netflix_csv") return "netflix";
  if (source === "letterboxd") return "letterboxd";
  if (source === "trakt") return "trakt";
  return null;
}

// ─── Composant étoiles ────────────────────────────────────────────────────────

function StarRating({ value, max = 5 }: { value: number; max?: number }) {
  // value est stockée sur 10, on affiche sur max=5
  const normalized = value / 2;
  const full = Math.floor(normalized);
  const half = normalized - full >= 0.25 && normalized - full < 0.75;
  const empty = max - full - (half ? 1 : 0);

  return (
    <div className="flex items-center gap-0.5" aria-label={`${normalized.toFixed(1)} étoiles sur ${max}`}>
      {Array.from({ length: full }).map((_, i) => (
        <svg key={`f${i}`} className="size-3 text-nemo-accent" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25z" />
        </svg>
      ))}
      {half && (
        <svg className="size-3 text-nemo-accent" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347V.25z" />
          <path fillOpacity={0.25} d="M8 .25v12.097l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25z" />
        </svg>
      )}
      {Array.from({ length: empty }).map((_, i) => (
        <svg key={`e${i}`} className="size-3 text-white/20" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25z" />
        </svg>
      ))}
      <span className="ml-1 text-[11px] text-white/40 tabular-nums">{normalized.toFixed(1)}</span>
    </div>
  );
}

// ─── Icône source Nemo ────────────────────────────────────────────────────────

function NemoSourceBadge() {
  return (
    <div
      className="size-5 rounded-md flex items-center justify-center shrink-0"
      style={{ background: "#6366f122", border: "1px solid #6366f144" }}
      aria-label="Logo Nemo"
    >
      <Play className="size-3 text-indigo-400 fill-indigo-400" />
    </div>
  );
}

// ─── Carte historique ─────────────────────────────────────────────────────────

function HistoryCard({ item }: { item: HistoryItem }) {
  const [reviewExpanded, setReviewExpanded] = useState(false);

  const href =
    item.media_type === "movie"
      ? `/film/${item.tmdb_id}`
      : `/serie/${item.tmdb_id}`;

  const logoKey = sourceToLogoKey(item.source);
  const isWatched = item.source === "nemo" && (item.progress ?? 0) >= 95;
  const isInProgress =
    item.source === "nemo" &&
    (item.progress ?? 0) > 0 &&
    (item.progress ?? 0) < 95;

  return (
    <div className="group relative flex gap-3 p-3 rounded-2xl bg-white/4 border border-white/7 hover:bg-white/7 hover:border-white/12 transition-all duration-200">
      {/* Poster */}
      <Link href={item.tmdb_id ? href : "#"} className="shrink-0 relative">
        <div className="relative w-14 aspect-2/3 rounded-xl overflow-hidden bg-[#1a1e28]">
          {item.poster_path ? (
            <Image
              src={tmdbImage.poster(item.poster_path, "w185") ?? ""}
              alt={item.title ?? ""}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              sizes="56px"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              {item.media_type === "movie" ? (
                <Film className="size-5 text-white/15" />
              ) : (
                <Tv className="size-5 text-white/15" />
              )}
            </div>
          )}

          {/* Barre de progression (nemo interne) */}
          {item.source === "nemo" && (item.progress ?? 0) > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-0.75 bg-black/50">
              <div
                className="h-full bg-nemo-accent"
                style={{ width: `${item.progress}%` }}
              />
            </div>
          )}

          {/* Badge "Vu" pour items externes */}
          {item.source !== "nemo" && (
            <div className="absolute bottom-1 right-1 size-4 rounded-full bg-green-500/90 flex items-center justify-center">
              <CheckCircle2 className="size-2.5 text-white" />
            </div>
          )}
        </div>
      </Link>

      {/* Contenu */}
      <div className="flex-1 min-w-0 py-0.5">
        <div className="flex items-start justify-between gap-2">
          {/* Titre + meta */}
          <div className="min-w-0 flex-1">
            <Link href={item.tmdb_id ? href : "#"} className="group/title">
              <h3 className="text-sm font-semibold text-white leading-snug truncate group-hover/title:text-nemo-accent transition-colors">
                {item.title ?? (
                  <span className="text-white/30 italic">Titre inconnu</span>
                )}
              </h3>
            </Link>

            {/* Media type + épisode */}
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
              <span className="flex items-center gap-1 text-[11px] text-white/35 uppercase tracking-wide font-medium">
                {item.media_type === "movie" ? (
                  <Film className="size-3" />
                ) : (
                  <Tv className="size-3" />
                )}
                {item.media_type === "movie" ? "Film" : "Série"}
              </span>

              {item.media_type === "tv" &&
                item.season_number != null &&
                item.episode_number != null && (
                  <span className="text-[11px] text-nemo-accent/80 font-medium">
                    S{String(item.season_number).padStart(2, "0")}E
                    {String(item.episode_number).padStart(2, "0")}
                  </span>
                )}

              {isWatched && (
                <span className="flex items-center gap-1 text-[11px] text-green-400/80 font-medium">
                  <CheckCircle2 className="size-3" />
                  Terminé
                </span>
              )}

              {isInProgress && (
                <span className="text-[11px] text-nemo-accent/70 tabular-nums">
                  {Math.round(item.progress ?? 0)}%
                </span>
              )}
            </div>

            {/* Temps */}
            <p className="text-[11px] text-white/25 mt-1">
              {formatTimeAgo(item.watched_at)}
            </p>
          </div>

          {/* Logo source */}
          <div className="shrink-0 flex flex-col items-end gap-2 pt-0.5">
            {logoKey ? (
              <ProviderLogo provider={logoKey} size="sm" className="size-6! rounded-lg!" />
            ) : (
              <NemoSourceBadge />
            )}
            <span
              className="text-[10px] font-medium leading-none"
              style={{ color: SOURCE_COLORS[item.source] ?? "#fff" }}
            >
              {SOURCE_LABELS[item.source] ?? item.source}
            </span>
          </div>
        </div>

        {/* Note (étoiles) */}
        {item.user_rating != null && item.user_rating > 0 && (
          <div className="mt-2">
            <StarRating value={item.user_rating} />
          </div>
        )}

        {/* Critique */}
        {item.review && (
          <div className="mt-2">
            <button
              onClick={() => setReviewExpanded((v) => !v)}
              className="w-full text-left group/review"
            >
              <div
                className={cn(
                  "flex gap-2 text-[12px] text-white/50 italic leading-relaxed transition-all",
                  !reviewExpanded && "line-clamp-2"
                )}
              >
                <MessageSquareQuote className="size-3.5 shrink-0 mt-0.5 text-white/25" />
                <span className="group-hover/review:text-white/70 transition-colors">
                  {item.review}
                </span>
              </div>
              {item.review.length > 120 && (
                <div className="flex items-center gap-1 mt-1 text-[10px] text-white/25 hover:text-white/50 transition-colors">
                  {reviewExpanded ? (
                    <>
                      <ChevronUp className="size-3" />
                      Réduire
                    </>
                  ) : (
                    <>
                      <ChevronDown className="size-3" />
                      Lire la suite
                    </>
                  )}
                </div>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
      <div className="flex gap-3 p-3 rounded-2xl bg-white/4 border border-white/7 animate-pulse">
      <div className="w-14 aspect-2/3 rounded-xl bg-white/8 shrink-0" />
      <div className="flex-1 py-0.5 space-y-2">
        <div className="h-4 w-2/3 rounded bg-white/8" />
        <div className="h-3 w-1/3 rounded bg-white/5" />
        <div className="h-2.5 w-1/4 rounded bg-white/5" />
      </div>
    </div>
  );
}

// ─── Filtre sources ───────────────────────────────────────────────────────────

type SourceFilter = "all" | "nemo" | "letterboxd" | "netflix_csv" | "trakt";

const FILTER_LABELS: Record<SourceFilter, string> = {
  all: "Tout",
  nemo: "Nemo",
  letterboxd: "Letterboxd",
  netflix_csv: "Netflix",
  trakt: "Trakt.tv",
};

// ─── Page principale ──────────────────────────────────────────────────────────

export default function HistoriquePage() {
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery<HistoryPage>({
    queryKey: ["historique-unified", sourceFilter],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ source: sourceFilter });
      if (pageParam) params.set("cursor", pageParam as string);
      const res = await fetch(`/api/historique?${params}`);
      if (!res.ok) throw new Error("Erreur chargement historique");
      return res.json() as Promise<HistoryPage>;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 1000 * 60 * 5,
  });

  // Sentinel infinite scroll
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node) return;
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      });
      observerRef.current.observe(node);
    },
    [hasNextPage, isFetchingNextPage, fetchNextPage]
  );

  const allItems = data?.pages.flatMap((p) => p.items) ?? [];
  const totalLoaded = allItems.length;

  // Sources disponibles — on récupère les counts depuis la 1ère page de chaque source
  // On utilise une requête séparée pour les counts (léger, sans TMDB)
  const sourceCounts = allItems.reduce<Record<string, number>>((acc, item) => {
    acc[item.source] = (acc[item.source] ?? 0) + 1;
    return acc;
  }, {});

  const availableSources = (
    ["all", "nemo", "letterboxd", "netflix_csv", "trakt"] as SourceFilter[]
  ).filter((s) => s === "all" || (sourceCounts[s] ?? 0) > 0 || sourceFilter === s);

  // Groupage par jour
  const groups: { label: string; items: HistoryItem[] }[] = [];
  let currentLabel = "";
  let currentGroup: HistoryItem[] = [];

  for (const item of allItems) {
    const label = formatDayLabel(item.watched_at);
    if (label !== currentLabel) {
      if (currentGroup.length > 0) groups.push({ label: currentLabel, items: currentGroup });
      currentLabel = label;
      currentGroup = [item];
    } else {
      currentGroup.push(item);
    }
  }
  if (currentGroup.length > 0) groups.push({ label: currentLabel, items: currentGroup });

  return (
    <div className="bg-nemo-bg min-h-dvh">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-8">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-2xl bg-nemo-accent/10 flex items-center justify-center border border-nemo-accent/20">
              <History className="size-5 text-nemo-accent" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white leading-none">Historique</h1>
              {!isLoading && totalLoaded > 0 && (
                <p className="text-xs text-white/35 mt-0.5 tabular-nums">
                  {totalLoaded} entrée{totalLoaded > 1 ? "s" : ""} chargée{totalLoaded > 1 ? "s" : ""}
                  {hasNextPage && " · plus à venir"}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Filtres sources */}
        {!isLoading && availableSources.length > 2 && (
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            {availableSources.map((source) => {
              const isActive = sourceFilter === source;
              return (
                <button
                  key={source}
                  onClick={() => setSourceFilter(source)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border",
                    isActive
                      ? "bg-nemo-accent text-black border-nemo-accent"
                      : "bg-white/5 text-white/50 border-white/8 hover:bg-white/8 hover:text-white/70"
                  )}
                >
                  {source !== "all" && source !== "nemo" && (
                    <ProviderLogo
                      provider={sourceToLogoKey(source) ?? ""}
                      size="sm"
                      className="size-3.5! rounded-sm!"
                    />
                  )}
                  {source === "nemo" && <Play className="size-3 fill-current" />}
                  {FILTER_LABELS[source]}
                </button>
              );
            })}
          </div>
        )}

        {/* Chargement initial */}
        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* Erreur */}
        {isError && (
          <div className="text-center py-20 text-white/40 text-sm">
            Erreur de chargement de l&apos;historique
          </div>
        )}

        {/* Vide */}
        {!isLoading && !isError && allItems.length === 0 && (
          <div className="text-center py-24 space-y-4">
            <Clock className="size-14 text-white/8 mx-auto" />
            <p className="text-white/50 text-base font-semibold">
              {sourceFilter === "all"
                ? "Aucun historique"
                : `Aucune entrée ${FILTER_LABELS[sourceFilter]}`}
            </p>
            <p className="text-white/25 text-sm">
              {sourceFilter === "all"
                ? "Commencez à regarder pour créer votre historique"
                : "Importez vos données depuis les paramètres"}
            </p>
            <Link
              href="/"
              className="inline-block mt-4 bg-nemo-accent hover:bg-[#f0c85a] text-black font-semibold px-6 py-2.5 rounded-xl transition-colors text-sm"
            >
              Explorer le catalogue
            </Link>
          </div>
        )}

        {/* Timeline */}
        {!isLoading && allItems.length > 0 && (
          <div className="space-y-8">
            {groups.map((group) => (
              <div key={group.label}>
                {/* Séparateur de date */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-px flex-1 bg-white/5" />
                  <span className="text-[11px] font-semibold text-white/30 uppercase tracking-widest px-2">
                    {group.label}
                  </span>
                  <div className="h-px flex-1 bg-white/5" />
                </div>

                {/* Cartes */}
                <div className="space-y-2">
                  {group.items.map((item) => (
                    <HistoryCard key={`${item.source}-${item.id}`} item={item} />
                  ))}
                </div>
              </div>
            ))}

            {/* Sentinel + loader */}
            <div ref={sentinelRef} className="flex items-center justify-center py-6 min-h-12">
              {isFetchingNextPage && (
                <div className="flex items-center gap-2 text-white/25 text-xs">
                  <Loader2 className="size-4 animate-spin" />
                  Chargement…
                </div>
              )}
              {!hasNextPage && totalLoaded > 0 && (
                <p className="text-white/15 text-xs">
                  — fin de l&apos;historique —
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
