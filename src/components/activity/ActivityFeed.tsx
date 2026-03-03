"use client";

import { useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Film, Tv, ThumbsUp, ThumbsDown, BookMarked, Eye, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { tmdbImage } from "@/lib/tmdb/client";
import { useFriendActivity } from "@/hooks/use-friends";
import type { ActivityEvent } from "@/types/supabase";

function formatRelativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  if (hours < 24) return `il y a ${hours}h`;
  if (days === 1) return "hier";
  if (days < 7) return `il y a ${days} jours`;
  return new Date(timestamp).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function formatDayLabel(timestamp: string): string {
  const d = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (d.toDateString() === yesterday.toDateString()) return "Hier";
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

function ActivityDescription({ event }: { event: ActivityEvent }) {
  const mediaLabel = event.media?.media_type === "movie" ? "film" : "série";

  switch (event.type) {
    case "watched":
      return (
        <span className="text-white/60">
          a regardé{" "}
          {event.media && (
            <Link
              href={`/${event.media.media_type === "movie" ? "film" : "serie"}/${event.media.tmdb_id}`}
              className="text-white font-medium hover:text-nemo-accent transition-colors"
            >
              {event.media.title}
            </Link>
          )}
        </span>
      );
    case "liked":
      return (
        <span className="text-white/60">
          a aimé{" "}
          {event.media && (
            <Link
              href={`/${event.media.media_type === "movie" ? "film" : "serie"}/${event.media.tmdb_id}`}
              className="text-white font-medium hover:text-nemo-accent transition-colors"
            >
              {event.media.title}
            </Link>
          )}
        </span>
      );
    case "disliked":
      return (
        <span className="text-white/60">
          n&apos;a pas aimé le {mediaLabel}{" "}
          {event.media && (
            <Link
              href={`/${event.media.media_type === "movie" ? "film" : "serie"}/${event.media.tmdb_id}`}
              className="text-white font-medium hover:text-nemo-accent transition-colors"
            >
              {event.media.title}
            </Link>
          )}
        </span>
      );
    case "added_to_list":
      return (
        <span className="text-white/60">
          a ajouté{" "}
          {event.media && (
            <Link
              href={`/${event.media.media_type === "movie" ? "film" : "serie"}/${event.media.tmdb_id}`}
              className="text-white font-medium hover:text-nemo-accent transition-colors"
            >
              {event.media.title}
            </Link>
          )}{" "}
          à{" "}
          {event.list ? (
            <span className="text-white font-medium">
              {event.list.icon ?? "🎬"} {event.list.name}
            </span>
          ) : "une liste"}
        </span>
      );
  }
}

function ActivityIcon({ type }: { type: ActivityEvent["type"] }) {
  switch (type) {
    case "watched": return <Eye className="size-3" />;
    case "liked": return <ThumbsUp className="size-3" />;
    case "disliked": return <ThumbsDown className="size-3" />;
    case "added_to_list": return <BookMarked className="size-3" />;
  }
}

function ActivityIconColor(type: ActivityEvent["type"]): string {
  switch (type) {
    case "watched": return "bg-blue-500/20 text-blue-400";
    case "liked": return "bg-nemo-accent/20 text-nemo-accent";
    case "disliked": return "bg-red-500/20 text-red-400";
    case "added_to_list": return "bg-violet-500/20 text-violet-400";
  }
}

function ActivityItem({ event }: { event: ActivityEvent }) {
  return (
    <div className="flex items-start gap-4">
      {/* Avatar ami */}
      <Link href={`/profil/${event.user.id}`} className="shrink-0">
        <div className="relative size-9 rounded-full overflow-hidden bg-white/10 ring-1 ring-white/10 hover:ring-white/25 transition-all">
          {event.user.avatar_url ? (
            <Image src={event.user.avatar_url} alt="" fill className="object-cover" sizes="36px" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white/50">
              {(event.user.display_name ?? "?").charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </Link>

      {/* Contenu */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm leading-snug">
            <Link href={`/profil/${event.user.id}`} className="text-white font-semibold hover:text-nemo-accent transition-colors">
              {event.user.display_name ?? "Ami"}
            </Link>{" "}
            <ActivityDescription event={event} />
          </p>
          <span className="text-xs text-white/25 shrink-0 mt-0.5">{formatRelativeTime(event.timestamp)}</span>
        </div>

        {/* Aperçu du média */}
        {event.media?.poster_path && (
          <Link
            href={`/${event.media.media_type === "movie" ? "film" : "serie"}/${event.media.tmdb_id}`}
            className="inline-flex items-center gap-2.5 mt-2.5 group"
          >
            <div className="relative w-10 aspect-2/3 rounded-lg overflow-hidden bg-white/8 shrink-0">
              <Image
                src={tmdbImage.poster(event.media.poster_path, "w185") ?? ""}
                alt={event.media.title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-200"
                sizes="40px"
              />
              <div className={cn(
                "absolute bottom-0.5 right-0.5 flex items-center justify-center size-4 rounded-full",
                ActivityIconColor(event.type)
              )}>
                <ActivityIcon type={event.type} />
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-white/70 text-xs font-medium truncate group-hover:text-white transition-colors">
                {event.media.title}
              </p>
              <div className="flex items-center gap-1 text-white/30 text-[10px] mt-0.5">
                {event.media.media_type === "movie" ? <Film className="size-2.5" /> : <Tv className="size-2.5" />}
                <span>{event.media.media_type === "movie" ? "Film" : "Série"}</span>
              </div>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}

interface ActivityFeedProps {
  filter?: string;
}

export function ActivityFeed({ filter }: ActivityFeedProps) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useFriendActivity(filter);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) observerRef.current.disconnect();
    if (!node) return;
    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        void fetchNextPage();
      }
    });
    observerRef.current.observe(node);
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const allEvents = data?.pages.flatMap((p) => p.events) ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 text-white/20 animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-20 text-white/40 text-sm">
        Erreur de chargement
      </div>
    );
  }

  if (allEvents.length === 0) {
    return (
      <div className="text-center py-20 space-y-3">
        <Eye className="size-12 text-white/8 mx-auto" />
        <p className="text-white/45 font-medium">Aucune activité</p>
        <p className="text-white/25 text-sm">L&apos;activité de vos amis apparaîtra ici</p>
      </div>
    );
  }

  // Groupe par jour
  const groups: Array<{ label: string; events: ActivityEvent[] }> = [];
  let currentLabel = "";
  let currentGroup: ActivityEvent[] = [];

  allEvents.forEach((event) => {
    const label = formatDayLabel(event.timestamp);
    if (label !== currentLabel) {
      if (currentGroup.length > 0) groups.push({ label: currentLabel, events: currentGroup });
      currentLabel = label;
      currentGroup = [event];
    } else {
      currentGroup.push(event);
    }
  });
  if (currentGroup.length > 0) groups.push({ label: currentLabel, events: currentGroup });

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <div key={group.label}>
          <div className="flex items-center gap-3 mb-5">
            <div className="h-px flex-1 bg-white/6" />
            <span className="text-xs font-semibold text-white/35 uppercase tracking-wider px-2">{group.label}</span>
            <div className="h-px flex-1 bg-white/6" />
          </div>
          <div className="space-y-6">
            {group.events.map((event, i) => (
              <ActivityItem key={`${event.user.id}-${event.type}-${event.timestamp}-${i}`} event={event} />
            ))}
          </div>
        </div>
      ))}

      {/* Sentinel pour infinite scroll */}
      <div ref={loadMoreRef} className="py-4 flex items-center justify-center">
        {isFetchingNextPage && <Loader2 className="size-5 text-white/25 animate-spin" />}
      </div>
    </div>
  );
}
