"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  Play,
  Loader2,
  Settings,
  Clock,
  Library,
  ArrowLeft,
  AlertCircle,
} from "lucide-react";
import { VideoPlayer } from "@/components/player/VideoPlayer";
import { JellyfinIcon } from "@/components/icons/JellyfinIcon";
import { useProfile } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";
import type { JellyfinBaseItem } from "@/types/jellyfin";

// ─── Types ────────────────────────────────────────────────────────────────────

interface JellyfinResponse {
  Items: JellyfinBaseItem[];
  TotalRecordCount: number;
  serverUrl: string;
}

interface ActiveStream {
  url: string;
  title: string;
  tmdbId?: number;
  mediaType?: "movie" | "tv";
  itemId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatRuntime(ticks?: number): string {
  if (!ticks) return "";
  const minutes = Math.round(ticks / 10_000_000 / 60);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function getProgressPercent(ticks?: number, totalTicks?: number): number {
  if (!ticks || !totalTicks) return 0;
  return Math.min(100, Math.round((ticks / totalTicks) * 100));
}

// ─── JellyfinCard ─────────────────────────────────────────────────────────────

interface JellyfinCardProps {
  item: JellyfinBaseItem;
  serverUrl: string;
  onPlay: (item: JellyfinBaseItem) => void;
  showProgress?: boolean;
  loading?: boolean;
}

function JellyfinCard({ item, serverUrl, onPlay, showProgress, loading }: JellyfinCardProps) {
  const imageUrl = item.ImageTags?.Primary
    ? `${serverUrl}/Items/${item.Id}/Images/Primary?maxWidth=400&quality=90`
    : null;

  const progress = showProgress
    ? getProgressPercent(
        item.UserData?.PlaybackPositionTicks,
        item.RunTimeTicks
      )
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className="group relative cursor-pointer"
      onClick={() => onPlay(item)}
    >
      {/* Poster */}
      <div className="relative aspect-2/3 rounded-xl overflow-hidden bg-white/5">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={item.Name}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <JellyfinIcon className="size-8 text-white/15" />
          </div>
        )}

        {/* Overlay au hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors duration-200 flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center size-12 rounded-full bg-white/90">
            {loading ? (
              <Loader2 className="size-5 text-black animate-spin" />
            ) : (
              <Play className="size-5 text-black fill-black ml-0.5" />
            )}
          </div>
        </div>

        {/* Barre de progression */}
        {showProgress && progress > 0 && progress < 100 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
            <div
              className="h-full bg-[#00A4DC] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Badge type */}
        {item.Type === "Series" && (
          <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-black/60 text-white/80 text-[10px] font-semibold">
            SÉRIE
          </div>
        )}
      </div>

      {/* Infos */}
      <div className="mt-2 px-0.5">
        <p className="text-white/85 text-xs font-medium line-clamp-2 leading-tight">{item.Name}</p>
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {item.ProductionYear && (
            <span className="text-white/35 text-[11px]">{item.ProductionYear}</span>
          )}
          {item.RunTimeTicks && (
            <span className="text-white/25 text-[11px]">{formatRuntime(item.RunTimeTicks)}</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({
  title,
  icon,
  count,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2.5">
        {icon}
        <h2 className="text-white font-bold text-lg">{title}</h2>
        {count !== undefined && count > 0 && (
          <span className="text-white/35 text-sm font-normal">({count})</span>
        )}
      </div>
      {children}
    </section>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function JellyfinHubContent() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const [activeStream, setActiveStream] = useState<ActiveStream | null>(null);
  const [streamLoading, setStreamLoading] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);

  const isJellyfinConnected = !!profile?.jellyfin_user_id;

  // Fetch continue watching
  const { data: resumeData, isLoading: resumeLoading } = useQuery<JellyfinResponse>({
    queryKey: ["jellyfin-resume"],
    queryFn: async () => {
      const res = await fetch("/api/jellyfin/user/resume");
      if (!res.ok) throw new Error("Erreur");
      return res.json() as Promise<JellyfinResponse>;
    },
    enabled: isJellyfinConnected,
    staleTime: 1000 * 60 * 2,
  });

  // Fetch full library
  const { data: libraryData, isLoading: libraryLoading } = useQuery<JellyfinResponse>({
    queryKey: ["jellyfin-user-library"],
    queryFn: async () => {
      const res = await fetch("/api/jellyfin/user/library");
      if (!res.ok) throw new Error("Erreur");
      return res.json() as Promise<JellyfinResponse>;
    },
    enabled: isJellyfinConnected,
    staleTime: 1000 * 60 * 5,
  });

  const handlePlay = useCallback(async (item: JellyfinBaseItem) => {
    setStreamError(null);
    setStreamLoading(item.Id);
    try {
      const res = await fetch(`/api/jellyfin/user/stream/${item.Id}`);
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? "Flux indisponible");

      const tmdbId = item.ProviderIds?.Tmdb ? parseInt(item.ProviderIds.Tmdb, 10) : undefined;
      const mediaType = item.Type === "Movie" ? "movie" as const : "tv" as const;

      setActiveStream({
        url: data.url,
        title: item.Name,
        tmdbId,
        mediaType,
        itemId: item.Id,
      });
    } catch (err) {
      setStreamError(err instanceof Error ? err.message : "Erreur de lecture");
    } finally {
      setStreamLoading(null);
    }
  }, []);

  // ── Player fullscreen ──────────────────────────────────────────────────────
  if (activeStream) {
    return (
      <div className="fixed inset-0 z-(--z-overlay) bg-black">
        <VideoPlayer
          url={activeStream.url}
          title={activeStream.title}
          tmdbId={activeStream.tmdbId}
          mediaType={activeStream.mediaType}
          onBack={() => setActiveStream(null)}
          className="w-full h-full"
        />
      </div>
    );
  }

  // ── Not connected ──────────────────────────────────────────────────────────
  if (!profileLoading && !isJellyfinConnected) {
    return (
      <div className="bg-[#0b0d12] min-h-dvh pt-20 flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="flex items-center justify-center size-16 rounded-2xl bg-[#00A4DC]/15 mx-auto mb-5">
            <JellyfinIcon className="size-8" style={{ color: "#00A4DC" }} />
          </div>
          <h1 className="text-white font-bold text-xl mb-2">Compte Jellyfin non connecté</h1>
          <p className="text-white/50 text-sm mb-6 leading-relaxed">
            Connectez votre compte utilisateur Jellyfin dans les paramètres pour accéder
            à votre bibliothèque et reprendre vos visionnages.
          </p>
          <Link
            href="/profil/parametres"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#00A4DC]/20 border border-[#00A4DC]/35 text-[#00A4DC] font-semibold text-sm hover:bg-[#00A4DC]/30 transition-all"
          >
            <Settings className="size-4" />
            Aller dans les paramètres
          </Link>
        </div>
      </div>
    );
  }

  const resumeItems = resumeData?.Items ?? [];
  const serverUrl = resumeData?.serverUrl ?? libraryData?.serverUrl ?? "";
  const libraryItems = libraryData?.Items ?? [];
  const movies = libraryItems.filter((i) => i.Type === "Movie");
  const series = libraryItems.filter((i) => i.Type === "Series");

  return (
    <div className="bg-[#0b0d12] min-h-dvh pt-20">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="relative py-14 px-6 sm:px-12 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,164,220,0.08)_0%,transparent_70%)]" />
        <div className="relative flex flex-col sm:flex-row items-center gap-4 max-w-screen-2xl mx-auto">
          <div className="flex items-center justify-center size-16 rounded-2xl bg-[#00A4DC]/20 shrink-0">
            <JellyfinIcon className="size-9" style={{ color: "#00A4DC" }} />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-white">
              Ma bibliothèque Jellyfin
            </h1>
            {profile?.jellyfin_display_name && (
              <p className="text-white/50 mt-1 text-sm">
                Connecté en tant que{" "}
                <span className="text-[#00A4DC] font-medium">{profile.jellyfin_display_name}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Erreur lecture ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {streamError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mx-6 sm:mx-12 max-w-screen-2xl mb-4 flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm"
          >
            <AlertCircle className="size-4 shrink-0" />
            {streamError}
            <button
              onClick={() => setStreamError(null)}
              className="ml-auto text-red-400/60 hover:text-red-400 transition-colors"
              aria-label="Fermer"
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-screen-2xl mx-auto px-6 sm:px-12 pb-16 space-y-12">

        {/* ── Continue Watching ──────────────────────────────────────────────── */}
        {(resumeLoading || resumeItems.length > 0) && (
          <Section
            title="Continuer à regarder"
            icon={<Clock className="size-5 text-[#00A4DC]" />}
            count={resumeItems.length}
          >
            {resumeLoading ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="aspect-2/3 skeleton rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
                {resumeItems.map((item) => (
                  <JellyfinCard
                    key={item.Id}
                    item={item}
                    serverUrl={serverUrl}
                    onPlay={handlePlay}
                    showProgress
                    loading={streamLoading === item.Id}
                  />
                ))}
              </div>
            )}
          </Section>
        )}

        {/* ── Films ─────────────────────────────────────────────────────────── */}
        <Section
          title="Films"
          icon={<Library className="size-5 text-white/50" />}
          count={libraryLoading ? undefined : movies.length}
        >
          {libraryLoading ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-3">
              {Array.from({ length: 16 }).map((_, i) => (
                <div key={i} className="aspect-2/3 skeleton rounded-xl" />
              ))}
            </div>
          ) : movies.length === 0 ? (
            <p className="text-white/30 text-sm py-4">Aucun film dans votre bibliothèque.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-3">
              {movies.map((item) => (
                <JellyfinCard
                  key={item.Id}
                  item={item}
                  serverUrl={serverUrl}
                  onPlay={handlePlay}
                  loading={streamLoading === item.Id}
                />
              ))}
            </div>
          )}
        </Section>

        {/* ── Séries ────────────────────────────────────────────────────────── */}
        {(libraryLoading || series.length > 0) && (
          <Section
            title="Séries"
            icon={<Library className="size-5 text-white/50" />}
            count={libraryLoading ? undefined : series.length}
          >
            {libraryLoading ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="aspect-2/3 skeleton rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-3">
                {series.map((item) => (
                  <JellyfinCard
                    key={item.Id}
                    item={item}
                    serverUrl={serverUrl}
                    onPlay={handlePlay}
                    loading={streamLoading === item.Id}
                  />
                ))}
              </div>
            )}
          </Section>
        )}

        {/* ── Empty state ────────────────────────────────────────────────────── */}
        {!libraryLoading && libraryItems.length === 0 && (
          <div className="text-center py-16">
            <JellyfinIcon className="size-12 mx-auto mb-4 text-white/15" />
            <p className="text-white/40 text-sm">
              Votre bibliothèque Jellyfin est vide ou inaccessible.
            </p>
            <Link
              href="/profil/parametres"
              className="inline-flex items-center gap-2 mt-4 text-[#00A4DC]/70 hover:text-[#00A4DC] text-sm transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              Vérifier la configuration
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
